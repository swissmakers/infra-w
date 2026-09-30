# Backup and Restore

INFRA-W backs up its own data to a local folder, an SMB share or a WebDAV server, on a schedule or on demand. Backups and restores are managed by administrators under **Settings → Backup**.

## What a backup contains

A backup is a gzip-compressed tar archive named `backup-<timestamp>.tar.gz`. Under **Include in backups** you choose what goes into it:

| Item | Content | Default |
|---|---|---|
| Database | the SQLite database (`infra-w.db`): users, inventory, identities, snippets, settings | included |
| Recordings | recorded SSH and desktop sessions | included |
| Logs | server log files | not included |

::: warning Keep the encryption key separately
Stored credentials in the database are encrypted with `ENCRYPTION_KEY`. The key is **not** part of a backup. A restored database only works with the same key, so keep it in your secrets store.
:::

## Storage providers

Add a destination with **Add provider**. The connection is tested when you save; a provider that cannot be reached is not saved.

| Type | Fields |
|---|---|
| Local | Backup path (created if missing). Use a path on a mounted volume, not inside the container only. |
| SMB share | Share (`\\server\share`), optional folder, username, password, optional domain. Without credentials the share is accessed anonymously. |
| WebDAV | Server URL (for example `https://cloud.example.com/remote.php/dav/files/user`), optional folder, username, password. |

Passwords are stored encrypted and never sent back to the browser. When you edit a provider, leave the password empty to keep the stored one. Deleting a provider does not delete the backups it holds.

## Schedule and retention

- **Automatic backup**: disabled (default), every hour, every 6 or 12 hours, daily or weekly. The interval starts when the server starts or when you save the setting; each run writes to every configured provider. A failing provider is logged and does not stop the others.
- **Retention policy**: how many backups to keep per provider (1 to 50, default 5). Older backups are removed right after a new one is written.
- **Create backup now** on a provider row starts a backup immediately.

## Restore

1. Expand the provider under **Providers** to list its backups.
2. Choose **Restore** on a backup and confirm.
3. INFRA-W replaces the data contained in the archive (database, recordings and logs, each only if present) and restarts.

The server exits after the restore and relies on the container restart policy (`--restart always` or your systemd unit) to come back. Sign in again afterwards.

Archives are checked before anything is replaced: only the database file and the recordings and logs folders are accepted; links, absolute paths, `..` components and oversized archives are rejected.

## Storage overview and downloads

The **Storage** section shows how much space the database, recordings and logs use. Administrators can

- download the current database with the button in the **Database** row (a consistent snapshot of the running database; the download is recorded in the audit log), and
- browse, download and delete individual recording and log files with **Browse files**.

## Before upgrades

Create a backup with **Create backup now** and check that it appears in the provider's list before you pull a new image. If you run the container with a bind-mounted data directory (see [Installation](./installation.md)), a copy of that directory taken while the container is stopped is an additional safe fallback.
