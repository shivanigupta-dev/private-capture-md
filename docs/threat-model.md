# Threat model

This document says what Private Capture tries to protect, what it assumes, and where it stops.

## Assets

- The words in captures, Health Journal entries, and review proposals
- The integrity of the rest of the vault
- The network access token
- The location and identity of the approved root

## Security goals

Private Capture should:

- fail closed when approval is missing or inconsistent;
- never follow a symlink out of its boundary;
- never replace or delete a capture;
- make retries safe;
- avoid putting note contents, titles, URLs, tokens, or absolute paths in routine logs;
- keep Health Journal search and filter text out of URLs, logs, analytics, and third-party services;
- require authentication and HTTPS for network use;
- remain useful without sending data to a third party.

## Assumptions

The host operating system, Node.js runtime, and local user account are trusted. The approved root is on a filesystem that supports normal file permissions and atomic hard links. Mirrored cloud folders generally meet that requirement; virtual or streamed filesystems may not.

The reverse proxy is trusted to set `X-Forwarded-Proto` correctly. Only the reverse proxy should be able to reach the loopback server in a network deployment.

## Out of scope

Private Capture does not protect against:

- malware or another process running as the same operating-system user;
- a compromised server, browser, reverse proxy, VPN, or sync provider;
- someone with physical access to an unlocked device;
- disclosure from unencrypted disks, swap, backups, or synced copies;
- a malicious Obsidian plugin that can read the vault;
- traffic sent over plain HTTP outside localhost.

“Private” means self-controlled storage, bounded access, and no product telemetry. It does not mean end-to-end encryption. Use full-disk encryption and encrypted backups for data at rest.

The app has one owner per configured instance. Health APIs use the same local-host boundary or authenticated session as capture APIs. The Health Journal is an organizational record only; it does not make clinical interpretations, diagnoses, or treatment recommendations.

## Network profiles

### Local mode

Local mode accepts only `localhost`, `127.0.0.1`, and `::1` host headers. It has no login because other sites are blocked by host and origin checks, and the listener stays on loopback.

### Token mode

Token mode stores only the token's SHA-256 in machine-local configuration. Login compares hashes in constant time and creates a random, expiring, HTTP-only, SameSite session. The session is lost on server restart by design.

The token is still a bearer secret. Keep it in a password manager, rotate it if exposed, and never place it in a URL, Git, screenshots, shell history, a public reverse-proxy configuration, or a vault note.

## Sync risks

Sync tools can propagate deletion and corruption. They are not backups. Prefer mirrored or always-offline folders, wait for synchronization before changing providers, and do not run two independent bidirectional sync engines over the same vault.

Unique append-only filenames reduce ordinary conflicts, but they cannot make a broken sync provider safe.
