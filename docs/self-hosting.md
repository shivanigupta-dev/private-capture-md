# Optional self-hosting

You do not need a server to use Private Capture. Self-hosting is for people who want the phone interface to work while their laptop is asleep.

The recommended shape is:

```text
phone → private VPN → HTTPS reverse proxy → Private Capture on localhost → local vault
```

Do not expose the Node process directly to the public internet.

## Before you begin

You need:

- an always-on Linux machine;
- Node.js 24.12 or newer;
- a vault or capture folder stored locally on that machine;
- a working private VPN such as OpenVPN or WireGuard;
- an HTTPS reverse proxy such as Caddy or nginx;
- full-disk encryption and a tested backup.

## Create a dedicated account

Use a non-login operating-system user that can read and create files only in the approved capture root. Do not run the service as root.

Clone or copy the repository to a read-only application directory, then initialize network mode as the service user:

```bash
node src/cli/main.ts init \
  --vault /srv/notes/vault \
  --config /etc/private-capture/config.json \
  --network
```

Save the one-time token in your password manager. Keep the configuration readable only by the service user.

## Keep the app on loopback

Start Private Capture on `127.0.0.1:3217`. The example [systemd unit](../deploy/systemd/private-capture.service) includes a restrictive umask and service sandbox. Replace every example path and user before installing it.

## Add HTTPS

The [Caddy example](../deploy/caddy/Caddyfile) uses Caddy's private certificate authority. Your phone must trust that CA, and the chosen hostname must resolve only inside the VPN. A publicly trusted certificate on a private hostname is another option if you control DNS.

Forward the original `Host` and protocol headers. The app uses them for same-origin checks and marks its session cookie Secure when the public request is HTTPS.

## Firewall

- Allow the VPN port from the internet if this machine is the VPN endpoint.
- Allow HTTPS to the reverse proxy only from the VPN interface/subnet.
- Do not allow port `3217` from the LAN, VPN, or WAN; it belongs on loopback.
- Test from cellular data with the VPN disconnected: the capture site should be unreachable.
- Connect the VPN and test again: the site should load over HTTPS and request the access token.

## Updating

Read the changelog, make a backup, stop the service, replace the application files, run the test suite, run `doctor`, and start the service. Do not run setup again over an existing root.

## Logs

The application logs startup state and operational errors, not request bodies. Reverse proxies often log full paths, user agents, and IP addresses by default. Disable access logs or configure redaction if that metadata is sensitive.
