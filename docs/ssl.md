# SSL/HTTPS

Use this guide if you want INFRA-W itself to expose HTTPS. If TLS is terminated at a reverse proxy, keep INFRA-W on HTTP and follow [Reverse Proxy](./reverse-proxy.md).

## How INFRA-W Enables HTTPS

INFRA-W starts an HTTPS listener automatically when these files exist:

- `/app/data/certs/cert.pem` (certificate chain)
- `/app/data/certs/key.pem` (private key)

When present, HTTP (`SERVER_PORT`, default `6989`) and HTTPS (`HTTPS_PORT`, default `5878`) can run in parallel.

## Container Example

```yaml
services:
  infra-w:
    image: swissmakers/infra-w:latest
    container_name: infra-w
    restart: always
    environment:
      ENCRYPTION_KEY: "<replace-with-generated-key>"
      HTTPS_PORT: "5878"
    ports:
      - "6989:6989"
      - "5878:5878"
    volumes:
      - ./data:/app/data
      - ./certs/cert.pem:/app/data/certs/cert.pem:ro
      - ./certs/key.pem:/app/data/certs/key.pem:ro
```

## Certificate Sources

### Let's Encrypt (Recommended)

```sh
sudo certbot certonly --standalone -d infra-w.example.com
install -m 644 /etc/letsencrypt/live/infra-w.example.com/fullchain.pem ./certs/cert.pem
install -m 600 /etc/letsencrypt/live/infra-w.example.com/privkey.pem ./certs/key.pem
```

### Self-Signed (Testing Only)

```sh
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 \
  -nodes \
  -keyout key.pem \
  -out cert.pem \
  -subj "/CN=infra-w.local"
```

> [!WARNING]
> Self-signed certificates are suitable only for development and isolated test environments.

## File Permissions

- `key.pem`: readable only by the runtime account (recommended mode `600`)
- `cert.pem`: world-readable is acceptable (`644`)
- Store cert material outside source control and managed backups where possible

## Renewal and Rotation

1. Renew certificate from your PKI provider.
2. Replace `cert.pem` and `key.pem`.
3. Restart or recreate container to reload TLS material.
4. Validate expiration date and chain from a client endpoint.

## Verification

- Open `https://<host>:5878` (or configured `HTTPS_PORT`).
- Verify browser trust chain and certificate subject/SAN.
- Confirm login and interactive sessions operate correctly over TLS.

## Common Issues

- **HTTPS not starting**: verify both `cert.pem` and `key.pem` exist in `/app/data/certs`.
- **Invalid certificate in browser**: ensure SAN/CN matches requested hostname.
- **Permission denied**: check private key ownership and mode on mounted file.
