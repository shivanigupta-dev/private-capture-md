# Security

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose notes, bypass the approval marker, escape the approved root, or weaken authentication.

Use GitHub's private vulnerability reporting feature for this repository. Include a minimal reproduction, affected version, and expected impact. Do not include anyone's real notes or credentials.

## Supported versions

Until the first stable release, only the latest release receives security fixes.

## Boundaries

Private Capture protects against accidental writes outside its approved root and against common path/symlink mistakes. It does not encrypt the vault at rest, replace operating-system permissions, secure a compromised host, or make HTTP safe on an untrusted network.

Read the full [threat model](docs/threat-model.md) before enabling network access.
