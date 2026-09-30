# Reverse Proxy

This guide describes production-safe reverse proxy patterns for INFRA-W, including complete TLS configuration and WebSocket forwarding requirements.

## Prerequisites

- INFRA-W reachable on `http://127.0.0.1:6989`
- Reverse proxy with WebSocket support
- Correct `TRUST_PROXY` setting in INFRA-W runtime
- Certificate and private key available on the proxy host

## Critical Requirements

Your proxy configuration must:

- forward `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto`
- support `Upgrade` and `Connection` headers for WebSockets
- allow long-lived connections for terminal/session streams
- terminate TLS with a valid certificate chain

## `TRUST_PROXY` Guidance

Set `TRUST_PROXY` according to your topology:

- `TRUST_PROXY=1` for one trusted proxy hop
- `TRUST_PROXY=<n>` for multiple trusted hops
- `TRUST_PROXY=<cidr-or-ip-list>` for explicit trust boundaries
- `TRUST_PROXY=false` when no reverse proxy is used

> [!WARNING]
> Incorrect `TRUST_PROXY` values can produce wrong client IP attribution in audit and session records.

## NGINX (TLS Termination)

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name infra-w.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name infra-w.example.com;

    ssl_certificate     /etc/letsencrypt/live/infra-w.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/infra-w.example.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:6989;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

## Apache HTTPD (TLS Termination)

Enable modules:

```sh
sudo a2enmod ssl proxy proxy_http proxy_wstunnel headers rewrite
```

Virtual host:

```apache
<VirtualHost *:80>
    ServerName infra-w.example.com
    Redirect permanent / https://infra-w.example.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName infra-w.example.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/infra-w.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/infra-w.example.com/privkey.pem

    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"

    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) ws://127.0.0.1:6989/$1 [P,L]

    ProxyPass / http://127.0.0.1:6989/
    ProxyPassReverse / http://127.0.0.1:6989/
    ProxyTimeout 86400
</VirtualHost>
```

## Caddy

Caddy automatically provisions certificates when DNS and inbound access are correct:

```caddy
infra-w.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:6989
}
```

## Traefik (Container Deployments)

```yaml
services:
  infra-w:
    image: swissmakers/infra-w:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.infra-w.rule=Host(`infra-w.example.com`)"
      - "traefik.http.routers.infra-w.entrypoints=websecure"
      - "traefik.http.routers.infra-w.tls=true"
      - "traefik.http.routers.infra-w.tls.certresolver=letsencrypt"
      - "traefik.http.services.infra-w.loadbalancer.server.port=6989"
```

## Certificate Operations

- Use full certificate chain (`fullchain.pem`) for `ssl_certificate`/`SSLCertificateFile`
- Restrict private key permissions (`chmod 600`)
- Automate renewal (for example `certbot renew`)
- Reload proxy service after renewal

## Validation Checklist

1. Open `https://infra-w.example.com` and inspect certificate validity.
2. Login and open an interactive terminal session.
3. Confirm session remains stable for long-running commands.
4. Validate audit events include the real client IP.
5. Confirm HTTP requests are redirected to HTTPS.

## Troubleshooting

- **WebSocket disconnects**: verify upgrade headers and long timeout settings.
- **Wrong source IP in audit logs**: re-check `TRUST_PROXY` value.
- **TLS errors**: verify cert/key paths and file permissions on the proxy host.
- **Redirect loops**: ensure backend protocol is HTTP when TLS terminates at proxy.
