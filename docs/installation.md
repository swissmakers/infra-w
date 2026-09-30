# Installation

INFRA-W runs as a single container. This guide sets it up with Podman or Docker, persistent storage and the required encryption key.

## Prerequisites

- Linux host with Podman or Docker
- `openssl` to generate the encryption key
- A directory or volume for persistent data (mounted at `/app/data`)

The container starts as root only to prepare the data directory, then runs the server and guacd as the **owner of the data directory**: a bind-mounted directory keeps its owner, a new volume (owned by root) is given to the built-in `infra-w` user (UID 10001). Files in the data directory with a different owner are taken over at start. To choose the account yourself, create the directory with that owner, for example `chown 10001:10001 /opt/infra-w`. The container listens on 6989 (HTTP) and, with certificates, 5878 (HTTPS).
- For production: a reverse proxy with TLS, see [Reverse Proxy](./reverse-proxy.md)

## Encryption key

INFRA-W encrypts stored credentials with `ENCRYPTION_KEY` and does not start without it. The value is a 64-character hex string:

```sh
openssl rand -hex 32
```

Provide it as the environment variable `ENCRYPTION_KEY` or as the secret file `/run/secrets/encryption_key` (loaded automatically). Keep the key in your secrets store: backups do not contain it, and a database is unusable without the key it was written with.

## Podman

```sh
mkdir -p /opt/infra-w

podman run -d \
  --name infra-w \
  --network host \
  --restart always \
  -e ENCRYPTION_KEY="<replace-with-generated-key>" \
  -v /opt/infra-w:/app/data:Z \
  swissmakers/infra-w:latest
```

## Docker

::: code-group

```sh [Host network]
docker run -d \
  --name infra-w \
  --network host \
  --restart always \
  -e ENCRYPTION_KEY="<replace-with-generated-key>" \
  -v /opt/infra-w:/app/data \
  swissmakers/infra-w:latest
```

```sh [Bridge network]
docker run -d \
  --name infra-w \
  --restart always \
  -p 6989:6989 \
  -e ENCRYPTION_KEY="<replace-with-generated-key>" \
  -v /opt/infra-w:/app/data \
  swissmakers/infra-w:latest
```

:::

Use host networking when INFRA-W must reach hosts the same way the container host does (for example through host routes or VPNs).

Behind a reverse proxy, also set `TRUST_PROXY` (usually `1`) so audit entries and the sign-in rate limit see real client addresses; see [Reverse proxy](./reverse-proxy.md). Without a proxy, leave it unset: a trusted `X-Forwarded-For` header could otherwise be forged by any client.

## Docker Compose

::: code-group

```yaml [Environment variable]
services:
  infra-w:
    image: swissmakers/infra-w:latest
    container_name: infra-w
    restart: always
    network_mode: host
    environment:
      ENCRYPTION_KEY: "<replace-with-generated-key>"
    volumes:
      - infra-w-data:/app/data

volumes:
  infra-w-data:
```

```yaml [Secret file]
services:
  infra-w:
    image: swissmakers/infra-w:latest
    container_name: infra-w
    restart: always
    network_mode: host
    volumes:
      - infra-w-data:/app/data
      - ./secrets/encryption_key:/run/secrets/encryption_key:ro

volumes:
  infra-w-data:
```

:::

```sh
docker compose up -d
```

## First start

1. Open `http://<host>:6989` (or your reverse-proxy URL).
2. Create the first administrator account.
3. Check the container logs for `Starting INFRA-W version …` and successful migrations.
4. Behind a reverse proxy: sign in once and confirm that **Audit** shows your real client IP address. If it shows the proxy address, adjust `TRUST_PROXY`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ENCRYPTION_KEY` | required | 64-character hex key for stored credentials; also read from `/run/secrets/encryption_key`, see [Encryption key](#encryption-key) |
| `SERVER_PORT` | `6989` | HTTP port |
| `HTTPS_PORT` | `5878` | HTTPS port, only used when certificates are present, see [SSL/HTTPS](./ssl.md) |
| `TRUST_PROXY` | `false` | Which proxies to trust for client addresses: `true`, `false`, a hop count, or IP/CIDR list |
| `STRICT_TLS` | `true` | Verify certificates of LDAP, OIDC, NetBox, Proxmox and other outbound TLS connections |
| `LOG_LEVEL` | `system` | `error`, `warn`, `system`, `info`, `verbose` or `debug` |

To trust an internal certificate authority (for example for LDAPS), mount the CA file and set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem` instead of turning off `STRICT_TLS`.

Sign-in session lifetime, audit retention and status checks are not environment variables; administrators set them in the application, see [Users and sign-in](./administration.md).

## Upgrades

1. Create a backup (**Settings → Backup → Create backup now**, see [Backup and Restore](./backup.md)).
2. Pull the new image and recreate the container:

```sh
podman pull swissmakers/infra-w:latest
podman stop infra-w && podman rm infra-w
# start again with the same podman run command
```

With Compose: `docker compose pull && docker compose up -d`.

Database migrations run automatically on start. The server stops gracefully on `SIGTERM`, so regular `stop` commands close the database cleanly.

## Backup and restore

INFRA-W has built-in scheduled backups to a local folder, SMB or WebDAV, and restores from the same page. See [Backup and Restore](./backup.md). As an additional safeguard you can copy the data directory (`/opt/infra-w` above) while the container is stopped.

## Hardening checklist

- Expose INFRA-W only through a TLS reverse proxy, VPN or private network.
- Set `TRUST_PROXY` to your exact proxy setup so audit entries show real client addresses.
- Keep `STRICT_TLS=true`; add internal CAs with `NODE_EXTRA_CA_CERTS`.
- Enable two-factor authentication or passkeys for administrators.
- Keep the container host and image up to date.
