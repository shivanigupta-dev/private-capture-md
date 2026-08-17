import { randomUUID } from "node:crypto";
import { link, lstat, open, readFile, realpath, readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { AppConfiguration } from "./config.ts";
import { MARKER_FILE, parseApprovalMarker, sha256Text, type ApprovalMarker, type CapabilityOperation } from "./marker.ts";

export type ApprovedRoot = {
  path: string;
  marker: ApprovalMarker;
  markerSha256: string;
  rootDevice: number;
  rootInode: number;
  markerDevice: number;
  markerInode: number;
};

async function inspectRoot(rootPath: string) {
  const input = path.resolve(rootPath);
  const inputStat = await lstat(input).catch(() => null);
  if (!inputStat?.isDirectory() || inputStat.isSymbolicLink()) throw new Error("The approved root is missing or is not a regular directory.");
  const resolved = await realpath(input);
  if (path.basename(resolved).toLowerCase() === ".obsidian") throw new Error("The approved root cannot be .obsidian.");
  const markerPath = path.join(resolved, MARKER_FILE);
  const markerStat = await lstat(markerPath).catch(() => null);
  if (!markerStat?.isFile() || markerStat.isSymbolicLink()) throw new Error("The approval marker is missing or unsafe.");
  const text = await readFile(markerPath, "utf8");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("The approval marker is not valid JSON.");
  }
  const marker = parseApprovalMarker(value);
  if (marker.root_name !== path.basename(resolved)) throw new Error("The approval marker names a different root.");
  return { resolved, inputStat, markerStat, marker, markerSha256: sha256Text(text) };
}

export async function loadApprovedRoot(config: AppConfiguration): Promise<ApprovedRoot> {
  const inspected = await inspectRoot(config.root_path);
  if (inspected.marker.root_id !== config.expected_root_id || inspected.markerSha256 !== config.expected_marker_sha256) throw new Error("The approval marker was changed or replaced.");
  return {
    path: inspected.resolved,
    marker: inspected.marker,
    markerSha256: inspected.markerSha256,
    rootDevice: inspected.inputStat.dev,
    rootInode: inspected.inputStat.ino,
    markerDevice: inspected.markerStat.dev,
    markerInode: inspected.markerStat.ino,
  };
}

export async function verifyApprovedRoot(root: ApprovedRoot) {
  const inspected = await inspectRoot(root.path);
  if (inspected.resolved !== root.path || inspected.inputStat.dev !== root.rootDevice || inspected.inputStat.ino !== root.rootInode) throw new Error("The approved root was replaced while Private Capture was running.");
  if (inspected.markerStat.dev !== root.markerDevice || inspected.markerStat.ino !== root.markerInode) throw new Error("The approval marker was replaced while Private Capture was running.");
  if (inspected.marker.root_id !== root.marker.root_id || inspected.markerSha256 !== root.markerSha256) throw new Error("The approval marker was changed while Private Capture was running.");
  return inspected.marker;
}

function capabilityFor(root: ApprovedRoot, relativePath: string, operation: CapabilityOperation) {
  const normalized = relativePath.replaceAll("\\", "/");
  const capability = root.marker.capabilities.find((candidate) => normalized === candidate.path || normalized.startsWith(`${candidate.path}/`));
  if (!capability || !capability.operations.includes(operation)) throw new Error("The approval marker does not authorize this operation.");
  const remainder = normalized.slice(capability.path.length).replace(/^\//, "");
  if (remainder.includes("/")) throw new Error("Nested record paths are not authorized.");
  if (remainder && capability.path === "Inbox/Captures" && !remainder.toLowerCase().endsWith(".md")) throw new Error("Capture records must be Markdown files.");
  if (remainder && capability.path === "Inbox/_review" && !remainder.toLowerCase().endsWith(".json")) throw new Error("Review records must be JSON files.");
  return capability;
}

function resolveInsideRoot(root: ApprovedRoot, relativePath: string) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes("\0")) throw new Error("The requested relative path is invalid.");
  const normalized = relativePath.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.toLowerCase() === ".obsidian")) throw new Error("The requested path is not allowed.");
  const target = path.resolve(root.path, ...segments);
  if (!target.startsWith(`${root.path}${path.sep}`)) throw new Error("The requested path leaves the approved root.");
  return { normalized, target };
}

async function approvedPath(root: ApprovedRoot, relativePath: string, operation: CapabilityOperation) {
  await verifyApprovedRoot(root);
  const { normalized, target } = resolveInsideRoot(root, relativePath);
  capabilityFor(root, normalized, operation);
  let cursor = root.path;
  for (const segment of path.relative(root.path, path.dirname(target)).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    const stat = await lstat(cursor).catch(() => null);
    if (!stat?.isDirectory() || stat.isSymbolicLink()) throw new Error("An unsafe or missing directory blocks the requested operation.");
  }
  return { normalized, target, parent: path.dirname(target) };
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

export async function readApprovedText(root: ApprovedRoot, relativePath: string) {
  const { target } = await approvedPath(root, relativePath, "read");
  const stat = await lstat(target).catch(() => null);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("The requested record is not a regular file.");
  return readFile(target, "utf8");
}

export async function listApprovedFiles(root: ApprovedRoot, relativeDirectory: string, extension: ".md" | ".json") {
  const { target } = await approvedPath(root, relativeDirectory, "read");
  const stat = await lstat(target).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) throw new Error("The approved record directory is missing or unsafe.");
  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.toLowerCase().endsWith(extension))
    .map((entry) => `${relativeDirectory}/${entry.name}`)
    .sort();
}

export async function createApprovedText(root: ApprovedRoot, relativePath: string, content: string) {
  const { target, parent, normalized } = await approvedPath(root, relativePath, "create");
  const temporary = path.join(parent, `.private-capture-${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  await handle.close();
  try {
    await verifyApprovedRoot(root);
    await link(temporary, target);
    await syncDirectory(parent);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
  return { relativePath: normalized, sha256: sha256Text(content) };
}
