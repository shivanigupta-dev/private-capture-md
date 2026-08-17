#!/usr/bin/env node

import { loadConfiguration, initialiseRoot, defaultConfigPath, type AccessMode } from "../core/config.ts";
import { loadApprovedRoot, listApprovedFiles, verifyApprovedRoot } from "../core/safe-files.ts";
import { startServer } from "../server/server.ts";

function option(args: string[], name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function has(args: string[], name: string) {
  return args.includes(name);
}

function help() {
  console.log(`Private Capture

Usage:
  private-capture init --vault <path> [--folder <name>] [--config <path>] [--network]
  private-capture doctor [--config <path>]
  private-capture serve [--config <path>] [--host <address>] [--port <number>]

The default setup listens only on 127.0.0.1 and needs no account or cloud.
Use --network during init only when you plan to put the app behind HTTPS.`);
}

async function main() {
  const [, , command = "help", ...args] = process.argv;
  if (["help", "--help", "-h"].includes(command)) return help();

  if (command === "init") {
    const vaultPath = option(args, "--vault");
    if (!vaultPath) throw new Error("init requires --vault <path>.");
    const accessMode: AccessMode = has(args, "--network") ? "token" : "local";
    const result = await initialiseRoot({
      vaultPath,
      folderName: option(args, "--folder"),
      configPath: option(args, "--config"),
      accessMode,
    });
    console.log(`Created an approved capture root at ${result.rootPath}`);
    console.log(`Saved machine-local configuration at ${result.configPath}`);
    if (result.token) {
      console.log("\nSave this access token in your password manager. It will not be shown again:");
      console.log(result.token);
    }
    console.log("\nNext: private-capture doctor, then private-capture serve");
    return;
  }

  const configPath = option(args, "--config") || defaultConfigPath();
  const loaded = await loadConfiguration(configPath);

  if (command === "doctor") {
    const root = await loadApprovedRoot(loaded.value);
    await verifyApprovedRoot(root);
    const captures = await listApprovedFiles(root, "Inbox/Captures", ".md");
    const reviews = await listApprovedFiles(root, "Inbox/_review", ".json");
    console.log("Private Capture is ready.");
    console.log(`Root: ${root.marker.label}`);
    console.log(`Access: ${loaded.value.access_mode === "local" ? "this computer only" : "token-protected; HTTPS required for network use"}`);
    console.log(`Records: ${captures.length} capture${captures.length === 1 ? "" : "s"}, ${reviews.length} review proposal${reviews.length === 1 ? "" : "s"}`);
    console.log("Approval marker: valid");
    return;
  }

  if (command === "serve") {
    const host = option(args, "--host") || process.env.PRIVATE_CAPTURE_HOST || "127.0.0.1";
    const rawPort = option(args, "--port") || process.env.PRIVATE_CAPTURE_PORT || "3217";
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Choose a port between 1024 and 65535.");
    if (!["127.0.0.1", "localhost", "::1"].includes(host) && loaded.value.access_mode !== "token") throw new Error("Binding beyond localhost requires a token-protected configuration created with init --network.");
    const { server, root } = await startServer(loaded, { host, port });
    console.log(`Private Capture is ready at http://${host === "::1" ? "[::1]" : host}:${port}`);
    console.log(`Approved root: ${root.marker.label}; access: ${loaded.value.access_mode}`);
    const close = () => server.close(() => process.exit(0));
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Private Capture could not continue.");
  process.exitCode = 1;
});
