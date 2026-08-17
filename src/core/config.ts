import { createHash, randomBytes, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { lstat, mkdir, open, readFile, realpath, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { createApprovalMarker, MARKER_FILE, markerText, sha256Text } from "./marker.ts";

export type AccessMode = "local" | "token";

export type AppConfiguration = {
  format: "private-capture.config";
  version: 1;
  root_path: string;
  expected_root_id: string;
  expected_marker_sha256: string;
  access_mode: AccessMode;
  token_sha256: string | null;
};

export type LoadedConfiguration = {
  path: string;
  value: AppConfiguration;
};

function configDirectory() {
  if (process.platform === "darwin") return path.join(homedir(), "Library", "Application Support", "Private Capture");
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"), "Private Capture");
  return path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"), "private-capture");
}

export function defaultConfigPath() {
  return process.env.PRIVATE_CAPTURE_CONFIG || path.join(configDirectory(), "config.json");
}

function parseConfiguration(value: unknown): AppConfiguration {
  if (!value || typeof value !== "object") throw new Error("The local configuration is not an object.");
  const config = value as Partial<AppConfiguration>;
  if (config.format !== "private-capture.config" || config.version !== 1) throw new Error("The local configuration has an unsupported format.");
  if (typeof config.root_path !== "string" || !path.isAbsolute(config.root_path)) throw new Error("The local configuration needs an absolute root path.");
  if (typeof config.expected_root_id !== "string" || !/^pcr_[0-9a-f-]{36}$/i.test(config.expected_root_id)) throw new Error("The local configuration has an invalid root identity.");
  if (typeof config.expected_marker_sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(config.expected_marker_sha256)) throw new Error("The local configuration has an invalid marker fingerprint.");
  if (config.access_mode !== "local" && config.access_mode !== "token") throw new Error("The local configuration has an invalid access mode.");
  if (config.access_mode === "local" && config.token_sha256 !== null) throw new Error("Local-only configuration must not contain a token hash.");
  if (config.access_mode === "token" && (typeof config.token_sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(config.token_sha256))) throw new Error("Network-capable configuration needs a valid token hash.");
  return config as AppConfiguration;
}

async function syncDirectory(directory: string) {
  const handle = await open(directory, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && ["EINVAL", "ENOTSUP", "EBADF"].includes(String(error.code)))) throw error;
  } finally {
    await handle.close();
  }
}

async function writeNewFile(filePath: string, content: string, mode = 0o600) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const handle = await open(filePath, "wx", mode);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(filePath, { force: true }).catch(() => undefined);
    throw error;
  }
  await handle.close();
  await syncDirectory(path.dirname(filePath));
}

export async function loadConfiguration(configPath = defaultConfigPath()): Promise<LoadedConfiguration> {
  const resolved = path.resolve(configPath);
  const stat = await lstat(resolved).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error(`Private Capture configuration is missing or unsafe: ${resolved}`);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("The local configuration is not valid JSON.");
  }
  return { path: resolved, value: parseConfiguration(value) };
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function initialiseRoot(options: {
  vaultPath: string;
  folderName?: string;
  configPath?: string;
  accessMode?: AccessMode;
}) {
  const vaultInput = path.resolve(options.vaultPath);
  const vaultStat = await lstat(vaultInput).catch(() => null);
  if (!vaultStat?.isDirectory() || vaultStat.isSymbolicLink()) throw new Error("The selected vault is not a regular local directory.");
  const vault = await realpath(vaultInput);
  if (path.basename(vault).toLowerCase() === ".obsidian") throw new Error("Choose the vault folder, not its .obsidian settings folder.");

  const folderName = (options.folderName || "Private Capture").trim();
  if (!folderName || folderName === "." || folderName === ".." || folderName.includes("/") || folderName.includes("\\") || folderName.toLowerCase() === ".obsidian") throw new Error("Choose a simple folder name inside the vault.");
  const rootPath = path.join(vault, folderName);
  if (await lstat(rootPath).catch(() => null)) throw new Error(`Refusing to adopt an existing folder: ${rootPath}`);

  const configPath = path.resolve(options.configPath || defaultConfigPath());
  if (await lstat(configPath).catch(() => null)) throw new Error(`Refusing to replace an existing configuration: ${configPath}`);

  const marker = createApprovalMarker(folderName);
  const renderedMarker = markerText(marker);
  const staging = path.join(vault, `.${folderName}.private-capture-init-${randomUUID()}`);
  await mkdir(path.join(staging, "Inbox", "Captures"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(staging, "Inbox", "_review"), { recursive: true, mode: 0o700 });
  try {
    await writeNewFile(path.join(staging, MARKER_FILE), renderedMarker);
    await syncDirectory(path.join(staging, "Inbox", "Captures"));
    await syncDirectory(path.join(staging, "Inbox", "_review"));
    await syncDirectory(staging);
    await rename(staging, rootPath);
    await syncDirectory(vault);
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }

  const accessMode = options.accessMode || "local";
  const token = accessMode === "token" ? randomBytes(32).toString("base64url") : null;
  const config: AppConfiguration = {
    format: "private-capture.config",
    version: 1,
    root_path: rootPath,
    expected_root_id: marker.root_id,
    expected_marker_sha256: sha256Text(renderedMarker),
    access_mode: accessMode,
    token_sha256: token ? tokenHash(token) : null,
  };
  try {
    await writeNewFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  } catch (error) {
    throw new Error(`The approved root was created at ${rootPath}, but the local configuration could not be written. ${error instanceof Error ? error.message : ""}`.trim());
  }
  return { rootPath, configPath, marker, token };
}

export async function directoryIsEmpty(directory: string) {
  return (await readdir(directory)).length === 0;
}
