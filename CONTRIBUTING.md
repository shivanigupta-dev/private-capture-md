# Contributing

Private Capture should stay small enough that a person can understand what it does to their files.

Before proposing a feature, ask whether it belongs in the capture path. Full-vault editing, AI classification, dashboards, and a new sync service are intentionally outside the first release.

## Development

Requirements:

- Node.js 24.12 or newer
- Git

There are no runtime or development package dependencies. The repository pins Node.js 24.14 for reproducible contributor and CI environments.

```bash
npm test
npm run check
```

Use synthetic notes and temporary directories in tests. Never add real vault paths, root IDs, captures, health information, access tokens, private URLs, backup manifests, or screenshots containing personal data.

## Pull requests

- Keep the change focused.
- Explain the user problem before the implementation.
- Add tests for file-safety and failure behavior.
- Preserve append-only capture semantics.
- Update the threat model when the trust boundary changes.

By contributing, you certify the [Developer Certificate of Origin 1.1](https://developercertificate.org/) with a `Signed-off-by` line in your commit message.
