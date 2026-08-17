# Health data and safety

The Health Journal is an optional way to organize personal notes about appointments, symptoms, therapy, medications, preventive care, and follow-up dates.

It records only what the user enters. It does not diagnose, rank symptoms, interpret measurements, recommend treatment, contact a clinician, or monitor emergencies. Do not rely on it as the only copy of information needed for urgent care.

## Storage model

Health entries use the same bounded root and append-only writer as ordinary captures:

```text
Private Capture/Inbox/Captures/
├── 2026-08-17--health--annual-physical--r1--a1b2c3d4.md
└── 2026-08-18--health--annual-physical--r2--e5f6a7b8.md
```

Editing creates a new Markdown revision. The prior file remains untouched. The timeline displays the highest valid revision for each event while preserving its earlier history.

Search, category filters, and date filters run in the browser after an authenticated or localhost-only fetch. Search text is not included in request URLs. API responses use `Cache-Control: no-store`, and the service worker does not cache them.

## Before entering real information

1. Enable full-disk encryption on every device that stores the vault.
2. Keep a separate, versioned, encrypted backup and test restoration.
3. If using a sync provider, understand who can access the account and its recovery methods.
4. If using the phone interface, require HTTPS and a private VPN.
5. Treat Obsidian community plugins as software with access to the vault.
6. Make one synthetic health entry, revise it, restore it from backup, and remove only the synthetic files.

This project is personal software, not a compliance service for clinicians or organizations. Anyone deploying it for other people must perform their own legal, privacy, security, accessibility, and operational review.
