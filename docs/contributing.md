# Contributing

How to set up INFRA-W locally and what a change needs before it is proposed.

## Prerequisites

- [Node.js](https://nodejs.org/en/download/) 24 or later
- [Yarn](https://yarnpkg.com/getting-started/install) 1.x for the server, client and documentation
- [pnpm](https://pnpm.io/installation) 10 for the landing page only (`landing/`), which has its own lockfile
- [Git](https://git-scm.com/downloads)
- For RDP and VNC during development: the build tools used by `scripts/build-guacd.sh`

## Local setup

```sh
git clone https://github.com/swissmakers/infra-w.git
cd infra-w
yarn install
cd client && yarn install && cd ..
```

Create a `.env` with at least `ENCRYPTION_KEY` (see [Installation](./installation.md#configuration)), then start server, client and guacd together:

```sh
yarn dev
```

The client runs on port 5173 and the API on 6989. Documentation: `yarn docs:dev`; landing page: `cd landing && pnpm install && pnpm dev`.

## Checks

Run these before opening a pull request:

| Command | What it checks |
|---|---|
| `yarn lint` | Server, test and client lint, must report 0 errors and 0 warnings |
| `yarn build` | Production build of the client |
| `yarn test` | Server and utility tests (`tests/*.test.cjs`, in-memory SQLite, no network) |
| `yarn test:ui` | Browser smoke test against the running client (see below) |
| `yarn docs:build` | Documentation build, including dead-link checks |
| `cd landing && pnpm lint && pnpm build` | Landing page lint and build, when it changed |

The browser smoke test and the screenshot script need the client dev server on `127.0.0.1:4173`:

```sh
cd client && npx vite --host 127.0.0.1 --port 4173 --strictPort
```

They drive the real client with Playwright and answer every API request and WebSocket from the fixtures in `tests/support/ui-fixtures.cjs`. No server or real infrastructure is needed or contacted.

## Screenshots

If a change is visible in the interface, regenerate the repository screenshots with `yarn screenshots` and commit them together with the change. See [Screenshots](./screenshots.md#regenerating).

## Pull requests

1. Create a focused branch: `git checkout -b feature/<short-description>`.
2. Keep changes small and reviewable; update the documentation with functional changes.
3. Reuse the shared components (`client/src/common/components`, the settings layout primitives) instead of adding page-specific variants, and remove code a change makes unused.
4. Describe the purpose, how you validated it, and any migration or compatibility impact.

Avoid new dependencies unless they are clearly needed.

## Security

Report vulnerabilities privately to Swissmakers GmbH through the contact details on [swissmakers.ch/infra-w](https://swissmakers.ch/infra-w/) instead of opening a public issue. Dependency and image checks:

```sh
make security-update
make security-audit
make security-all
make security-sbom
```
