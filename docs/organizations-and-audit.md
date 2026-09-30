# Organizations and Audit

Organizations let a team share hosts and credentials. The audit log records who connected where and what was changed; organizations can also record sessions for later replay.

## Organizations

Create and manage organizations under **Settings → Organizations**.

- **Inviting:** **Invite** → search a user → **Send invitation**. The invited user accepts or declines under **Pending invitations** and joins as a member.
- **LDAP and OIDC:** a sign-in provider can add its users to organizations automatically, see [LDAP](./ldap.md) and [OIDC](./oidc.md#group-mapping).

Everything created inside an organization is shared with its active members: hosts and folders, identities (credentials), snippets, scripts and integrations. Deleting an organization deletes all of these, its members' memberships and pending invitations; its audit entries stay.

### Roles

| | Member | Manager | Owner |
|---|---|---|---|
| Use and change hosts, identities, snippets and scripts | ✓ | ✓ | ✓ |
| Rename the organization, invite users | | ✓ | ✓ |
| Remove members and pending invitations | | ✓ | ✓ |
| Remove managers, make members managers and back | | | ✓ |
| Transfer the ownership, delete the organization | | | ✓ |
| [Export the audit log](#export) of the organization | | | ✓ |

The creator is the owner, and each organization has exactly one. In the **Members** tab, the owner changes roles and chooses **Transfer ownership** for an active member; the previous owner becomes a manager. The owner cannot leave; transfer the ownership first or delete the organization. When the owner's account is deleted, the ownership passes to a manager, else to the longest-standing member.

An administrator who is a member of an organization without an owner acts as its owner and can transfer the ownership to someone.

## Audit settings

Administrators find the **Audit settings** tab when they open an organization they belong to. Other members, including owners without administrator rights, do not see it.

| Group | Setting | Default |
|---|---|---|
| Session recording | Record sessions (SSH, Telnet, RDP and VNC) | off |
| Session recording | Recording retention (days, 1-365) | 90 |
| Connection requirements | Require connection reason | off |
| Activity logging | File operations, server connections, identity management, password paste, server management, folder management, script execution | on |
| Session sharing | Allow share links | on |
| Session sharing | Allow typing through share links | on |
| Session sharing | Maximum link lifetime (hours, 1-168) | 24 |

- **Recordings** are only made for hosts that belong to an organization with recording turned on; personal hosts are never recorded. File-manager (SFTP) sessions are not recorded.
- **Connection reason:** before connecting to a host of the organization, users enter a reason (up to 500 characters). It is stored with the connection in the audit log.
- **Activity logging** switches apply to the organization's audit entries; entries for personal hosts are always written.
- **Session sharing** applies to [share links](./workspace.md#sharing) of the organization's hosts. Without typing, links are always read-only; a link stops working after its chosen lifetime and never outlives the maximum. Personal hosts use the defaults.

## Audit log

The **Audit** page is available to administrators and covers the whole instance: every account and every organization, whether or not the administrator is a member.

**Filters:** organization (all, personal only, or one organization), activity, action, actor, and a start and end date. The activities are the same groups as in the organization's audit settings (for example *Server connections* or *File operations*); once an activity is chosen, the action list only offers its actions. 50 entries are shown per page.

**Logged actions:**

| Activity | Actions |
|---|---|
| Server connections | SSH, Telnet, SFTP, Proxmox, RDP and VNC connections; session shared, share permissions changed, sharing stopped |
| File operations | upload, download, create, delete, rename, change permissions; folder create, delete and download |
| Server management | host created, changed, deleted; VM power actions; Wake-on-LAN sent |
| Identity management | identity created, changed, deleted |
| Password paste | password pasted into a session |
| Folder management | inventory folder created, changed, deleted |
| Script execution | script run |
| Sign-in | signed in (with the method), sign-in failed (wrong password, wrong code, locked account), signed out, "Login as", API token created or revoked |
| Administration | users created, deleted, locked, unlocked; role changes; password changes and resets; two-factor resets; devices signed out by an administrator; organization changes, memberships, role changes, ownership transfers and deletions; sign-in providers; system settings; SSH host keys trusted, changed, accepted and forgotten; held integration removals applied; backups, restores and database downloads; audit exports |

Sign-in and Administration entries are always written; the organization switches do not apply to them. Changes made with an [API token](./administration.md#api-tokens) name the token in their details.

Expand an entry to see the connection reason, the user agent and further details such as the session duration.

### Export

**Export CSV** downloads every entry that matches the current filters (not only the visible page, at most 100,000 entries) with time, actor, action, activity, resource, organization, address, reason and details. The export itself is recorded (*Audit log exported*). Values that a spreadsheet would run as a formula are prefixed with `'`.

The owner of an organization, administrator or not, exports all of its entries from **Settings → Organizations** with **Export audit log**, in the same format.

### Retention

**Keep entries** sets how long the audit log is kept for the whole instance: forever (the default), 90 or 180 days, or 1, 2, 5 or 10 years. A shorter period asks for confirmation, deletes older entries at once and then every day. Export the entries first if you need them. Recordings follow the organization's own recording retention.

## Recordings

Entries with a recording have a **Replay session recording** button. Terminal sessions (SSH, Telnet, Proxmox containers and shells) and desktop sessions (RDP, VNC, Proxmox VMs) replay in the browser with play/pause, 10-second skips, a seek bar and fullscreen. Keyboard: Space plays or pauses, ←/→ skip 5 seconds, F toggles fullscreen.

Recordings are stored compressed in `data/recordings/` of the data directory. An hourly cleanup deletes recordings older than the organization's retention; the audit entry itself stays. Administrators can also browse and delete recording files under **Settings → Backup → Storage → Browse files**, and include recordings in [backups](./backup.md).
