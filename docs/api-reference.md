# API Reference

INFRA-W exposes a REST API under `/api`. The sidebar operation pages are generated from the live OpenAPI specification.

## Base URL

- Local install: `http://<host>:6989/api`
- Reverse proxy: `https://<your-domain>/api`

## Authentication Model

Most endpoints require a bearer token:

`Authorization: Bearer <token>`

For scripts and tools, create an **API token** under **Settings → API tokens** (see [API tokens](./administration.md#api-tokens)). API tokens start with `infw_`, act with the rights of their account and expire after at most a year. A read-only token is limited to `GET` requests; other methods answer `403`.

```sh
curl -H "Authorization: Bearer infw_…" https://infra-w.example.com/api/entries/list
```

Sign-in sessions of the browser use the same header with the session token that the sign-in endpoints return. Endpoints for passwords, second factors, passkeys, sign-in devices, API tokens and "Login as" only accept a browser session and answer `403` to an API token; terminal, desktop and file-manager connections need a browser session too.

## Public vs Protected Endpoints

- **Typically public**: selected service and authentication bootstrap endpoints (for example login/startup checks)
- **Protected**: operational resources such as entries, sessions, scripts, identities, organizations, and audit data

## How To Use This Section

1. Open an operation in the API sidebar.
2. Review request schema, auth requirements, and response schema.
3. Execute requests against your environment base URL.

## Regenerating OpenAPI Documentation

If operation docs are stale or missing:

```sh
yarn docs:openapi
yarn docs:dev
```

For static docs build:

```sh
yarn docs:build
```

## Troubleshooting

- **401/invalid token**: the token expired, was revoked or its account is locked; create a new one.
- **403 with an API token**: a read-only token sent a changing request, or the endpoint needs a browser session.
- **400 schema error**: compare payload with endpoint validation schema in API docs.
- **Missing endpoints in docs**: regenerate OpenAPI and rebuild docs.
