# Roadmap

The roadmap is ordered by trust, not novelty.

## Hardening the alpha

- Exercise local mode on macOS, Windows, and Linux
- Exercise the installable web app on iOS Safari and Android Chrome
- Add an explicit token-rotation command
- Add backup create, verify, and restore-test commands
- Test full-disk, permission-denied, and virtual-filesystem failure cases
- Evaluate Docker packaging without making Docker the default
- Publish an OpenAPI document for `/api/v1`
- Add synthetic screenshots and a short screen recording
- Complete an outside security review of the file and network boundaries

## After 0.1.0

- Importable iOS Shortcut for capture and sharing
- Android share-target experiment with a documented fallback
- Encrypted offline outbox for interrupted mobile saves
- Optional Obsidian CLI hook to open a newly created file on desktop
- Installer packages and clearer background-startup helpers

## Deliberately not planned for the first release

- Full-vault editing or sync
- AI classification or automatic rewriting
- A general-purpose daily journal or full-vault editor
- Multi-user hosting
- Dashboards and productivity scoring
- Requiring an Obsidian plugin

These are not promises. A feature moves forward only when its file permissions, recovery behavior, and privacy cost are understandable.
