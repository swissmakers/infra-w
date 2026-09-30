# Screenshots

All screenshots show the current interface with invented example data (hosts, users and files). They are generated from the same fixtures as the browser tests, see [Regenerating](#regenerating).

## Workspace

The inventory on the left, recent connections and an inventory summary in the overview. Search matches names, IP addresses, protocols, operating systems and tags.

![Workspace in the dark theme](./assets/screenshots/workspace-dark.png)

![Workspace in the light theme](./assets/screenshots/workspace-light.png)

## Terminal

SSH sessions open in tabs and keep running while you switch to Snippets, Audit or Settings.

![SSH session to edge-zrh-01](./assets/screenshots/terminal-dark.png)

## File manager

Browse and edit files over SFTP. The file manager, previews and editors are movable, resizable windows, so two files can be compared side by side while the terminal stays usable. Images can be zoomed.

![File manager with two previews side by side](./assets/screenshots/file-manager-dark.png)

![File manager in the light theme](./assets/screenshots/file-manager-light.png)

## Snippets

Reusable commands for the terminal, optionally limited to operating systems.

![Snippets](./assets/screenshots/snippets-dark.png)

## Audit and recordings

Every connection and change is logged. Recorded SSH and desktop sessions replay in the browser.

![Replay of a recorded SSH session](./assets/screenshots/audit-replay-dark.png)

## Settings

![Account settings](./assets/screenshots/settings-account-light.png)

LDAP providers start from a FreeIPA or Active Directory preset:

![Add LDAP provider with the FreeIPA preset](./assets/screenshots/settings-ldap-dark.png)

NetBox and Proxmox integrations keep the inventory in sync:

![Integrations](./assets/screenshots/settings-integrations-dark.png)

## Sign-in and mobile

The sign-in page follows the light or dark setting of the operating system:

![Sign-in page](./assets/screenshots/login-dark.png)

<img src="./assets/screenshots/mobile-workspace-dark.png" alt="Workspace on a phone" width="390">

## Regenerating

The screenshots live in `docs/assets/screenshots/` and are used by the README, this documentation and the landing page. After a visible change, regenerate them:

```sh
cd client && yarn dev --host 127.0.0.1 --port 4173   # in a second terminal
yarn screenshots
```

`scripts/screenshots.cjs` drives the real client with the fixtures in `tests/support/ui-fixtures.cjs`, so no server or real infrastructure is contacted. The output is deterministic: running it again without interface changes produces identical files. The script fails if a page reports an error or an image exceeds 300 KB.
