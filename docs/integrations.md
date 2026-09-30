# Integrations

Integrations import hosts from NetBox and Proxmox VE, so the inventory does not have to be maintained twice.

## Where to set them up

- **Settings → Integrations** (administrators): lists all integrations with status, last sync and last message, and offers **Add Proxmox** and **Add NetBox**. Integrations created here are personal and import into the top level of your inventory.
- **Inventory sidebar**: right-click a folder or organization and choose **Import → NetBox** or **Import → PVE**. The imported hosts land in that folder or organization, and every member of the organization can use them.
- **Workspace overview**: **Connect NetBox** opens the same dialog.

Only administrators create, change, sync or delete integrations.

A new integration is saved only if its connection test succeeds, and it syncs immediately. Secrets (NetBox token, Proxmox password) are stored encrypted; the edit dialog shows `********` and keeps the stored value unless you enter a new one. When editing, **Test connection** and **Sync now** save pending changes first.

Personal integrations are visible only to the account that created them; organization integrations to the organization's members.

## NetBox

| Field | Notes |
|---|---|
| Name | Shown in the integration list |
| NetBox API URL | For example `https://netbox.example.com` |
| API token | Read access to devices and virtual machines is sufficient |
| Sync interval (minutes) | Default 15, from 1 to 1440 |
| Verify TLS certificates | On by default |
| Include/exclude device roles, VM roles, tags | Comma-separated; matching ignores case |
| Default protocol and port | SSH 22, RDP 3389 or VNC 5900 |
| Protocol rules | See below |

**What is imported:** devices and virtual machines. The host name is NetBox's display name, the address its primary IPv4 (otherwise the primary IP or IPv6) without prefix length. Hosts without a primary IP are imported with an empty address.

**Filters:** role filters apply to devices and VMs separately. With include tags a host needs at least one of them; any exclude tag removes it.

**Protocol rules** choose the protocol and port per host. They are checked from top to bottom and the first match wins; if none matches, the default protocol applies. A rule targets devices, VMs or both and has one condition: label/tag, device role, VM role, platform, name contains, or a custom field key with an exact value. Example: condition *Label/Tag* = `rdp` → protocol RDP.

**Synchronization:** NetBox integrations sync on their interval (checked every minute and at server start) and on **Sync now**. The result appears as the last message, for example *NetBox sync complete: created 3, updated 40, deleted 1.* A failed sync marks the integration offline with the error message and, for scheduled syncs, sends a [notification](./administration.md#notifications).

::: warning NetBox is the source of truth
Each sync overwrites name, address, port, protocol, folder and icon of imported hosts; edit these in NetBox. Tags and identities you assign in INFRA-W are kept. Hosts that disappear from NetBox or no longer match the filters are removed at the next sync, within the limits of the safeguard below.
:::

### Preview

**Preview sync** in the edit dialog lists what a sync would create, update and remove, without changing anything. Use it after changing filters or protocol rules.

### Removal safeguard

A sync that would remove **more than 5 hosts and more than 10 %** of the integration's hosts, or **all** of them, creates and updates as usual but holds the removals back:

- The last message reads *NetBox sync held back 20 of 40 removals for review; …*, and the edit dialog offers **Review held removals**, which opens the preview with the hosts in question.
- **Apply N removals** removes them after a confirmation; it is recorded in the audit log.
- Until then, every sync holds them again, and a [notification](./administration.md#notifications) is sent when removals are first held.

This protects the inventory from an empty or truncated NetBox answer, an expired token with reduced rights, or a filter typo.

## Proxmox VE

| Field | Notes |
|---|---|
| Name | Also used for the node folders |
| Server-IP, Port | Port 8006 by default |
| Username, Password | A Proxmox user such as `root@pam` or a dedicated user with the required privileges |

For each node, INFRA-W creates a folder *`<name> - <node>`* with the node's virtual machines, containers and a node shell:

- **Virtual machines (QEMU)** open the Proxmox console as a VNC session in the browser.
- **Containers (LXC)** and the **node shell** open in the terminal.
- Right-click a VM or container to **Start**, **Shutdown** (graceful) or **Stop** (forced).

The certificate of the Proxmox API is verified according to `STRICT_TLS`. With a self-signed certificate, add its CA through `NODE_EXTRA_CA_CERTS` (see [Installation](./installation.md#configuration)).

Proxmox integrations sync when created, when saved and with **Sync now**; there is no interval. A sync rebuilds the integration's folders and entries, so tags or other changes on Proxmox entries do not survive it. Moving the node folders to another parent folder is kept.

## Deleting an integration

Deleting removes the integration and its Proxmox folders and entries. Hosts imported from NetBox stay in the inventory as ordinary hosts.
