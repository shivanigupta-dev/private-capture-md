# Changelog

All notable changes will be documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use semantic versioning.

## [Unreleased]

### Fixed

- Closing voice capture or leaving the page now cancels pending microphone permission and releases recordings, including delayed browser events
- Manual voice destination changes no longer carry unrelated extracted fields into the selected form

### Added

- Optional voice inbox with local transcription, editable destination proposals, and reviewed handoff to Capture, Health, Car, or Workout
- Loopback-only, provider-neutral speech endpoint with recording size, duration, and MIME limits
- Workout tab for lifts, climbs, and runs, with previous-set recall, climbing outcomes, automatic pace, local history filters, and progression charts
- Append-only workout Markdown records with idempotent writes and strict activity-specific validation
- Multi-vehicle Car tab with maintenance history, quick presets, cost and odometer tracking, owner-defined reminders, and client-side filters
- Append-only vehicle profiles and maintenance records with idempotent writes and vehicle referential-integrity checks
- Private Health Journal with chronological and upcoming timelines, 17 built-in categories, adaptive fields, client-side filters, and custom categories
- Append-only health-event revisions, idempotent writes, conflict detection, and focused therapy, symptom, dental, and preventive-care capture flows
- Local-only initialization, health check, and capture server commands
- Capability-scoped approval marker pinned by root identity and SHA-256
- Append-only Markdown captures and separate append-only review proposals
- Idempotent capture requests with stable durable-write receipts
- Mobile-first PWA shell with Markdown formatting and preview
- Small, medium, and large writing text settings
- Client-side Markdown download when direct vault writing is unavailable
- Optional token-protected network mode
- Linux, private-VPN, and HTTPS deployment examples
- Google Drive and provider-neutral folder-sync guidance
- Synthetic safety, concurrency, marker-failure, and server-authentication tests

### Changed

- Added a ceramic-inspired surface texture with mottled color, fine grain, speckles, and subtly irregular panels
- Reduced the default editor text to a normal reading size and placed small, standard, and large display controls inside the editor

[Unreleased]: https://github.com/shivanigupta-dev/private-capture-md/commits/main/
