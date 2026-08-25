# Privacy

Private Capture is designed to work without a product account, hosted database, analytics service, advertising system, or AI provider.

## What stays on your devices

- Captures, Health Journal entries, vehicle profiles, maintenance records, and workout entries are Markdown files in the approved root you choose.
- Review proposals are JSON files in that same root.
- Unsaved drafts and save-retry identifiers use the current browser tab's session storage.
- Writing-size and first-visit preferences use local storage.
- Network mode stores only a SHA-256 hash of the access token in machine-local configuration.
- Voice audio is held transiently in browser and server memory, then forwarded only to the loopback speech endpoint you configure. A transcript becomes a Markdown record only after you review and submit a destination form.

Private Capture does not put access tokens, note contents, health, vehicle, or workout filters, or search terms in browser URLs. Its service worker caches the application shell only and excludes every `/api/` response.

The vehicle log does not request or store VINs or license plates. Recall lookup is an ordinary link to the official NHTSA website; the app does not transmit vehicle data to NHTSA or another vehicle API.

## What the project does not collect

The application contains no telemetry, analytics, advertising, crash-reporting SDK, tracking pixel, hosted font, or third-party API call. The optional speech endpoint must resolve to loopback, so Private Capture will not send recordings directly to a hosted transcription API. The maintainers do not receive your notes or usage data merely because you use the software.

## Where copies can still go

Privacy depends on the system you choose around the application. Data may be copied by:

- your operating system, disk snapshots, swap, and backups;
- a vault application or plugin with access to the same folder;
- Google Drive, Dropbox, OneDrive, iCloud, Syncthing, or another sync provider you configure;
- reverse-proxy or system logs you enable;
- temporary files or logs created by a local speech engine you install;
- another person or process with access to your user account or server.

The app does not encrypt files at rest. Use full-disk encryption, encrypted backups, restrictive file permissions, HTTPS, and a private VPN where appropriate.

## Public repository data

Bug reports, discussions, and pull requests are public. Never attach real captures, health information, vehicle or workout records, recordings, transcripts, access tokens, root markers, configuration files, absolute vault paths, or screenshots containing personal data. Use synthetic examples.
