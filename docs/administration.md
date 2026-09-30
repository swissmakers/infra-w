# Users and Sign-in

Administrators manage accounts, sign-in sessions, status checks, SSH host keys and notifications. Users manage their own devices, password and API tokens.

## Version

The **Settings** overview shows administrators the INFRA-W version running on the server, for example *INFRA-W v2.0.1*, with a link to its release notes on GitHub. The version also appears at the bottom of the settings navigation for every user.

## Users

**Settings → Users** lists all accounts with their role and second factor, and a **Locked** badge for locked accounts. Search by username, first or last name.

**Create new user** adds a local account: a username of 3-15 letters and digits, first and last name, and a password of at least 12 characters. Accounts from [LDAP](./ldap.md) and [OIDC](./oidc.md) are created at their first sign-in.

The actions menu of a user offers:

| Action | What it does |
|---|---|
| Change password | Local accounts only. Sets a new password and signs the account out everywhere. |
| Promote to admin / Demote to user | Changes the role. You cannot change your own role. |
| Reset two-factor authentication | Shown when the user has an authenticator app or passkeys. Removes both, for a user who lost the device; they set up new ones after signing in with the password. |
| Lock account / Unlock account | See [Locking accounts](#locking-accounts). |
| Login as user | Opens the application as that user after a confirmation. A banner shows *You are working as … on behalf of …* until you choose **Return to my account**. Not available for locked accounts. |
| Delete user | Deletes the account with all its personal data: hosts, folders, identities, snippets, scripts, tags, shortcuts, passkeys and API tokens. Items of organizations stay with the organization. Organizations the user owns pass to a manager, else to the longest-standing member; an organization without other members is deleted with its content. |

Every action is recorded in the [audit log](./organizations-and-audit.md#audit-log) under *Administration*; "Login as" is recorded under *Sign-in*.

### Locking accounts

A locked account keeps its data, memberships and hosts but cannot use INFRA-W:

- Locking signs the account out on every device and closes its connections.
- Every sign-in method refuses it: password, LDAP, OIDC and passkeys. The message *This account is locked* only appears after correct credentials, and the attempt is logged as a failed sign-in.
- "Login as" is not offered for it.

You cannot lock your own account, so at least one administrator always stays active. **Unlock account** lets the user sign in again.

### Signed-in devices

Below the user list, **Signed-in devices** shows every browser signed in to the instance: user, browser and system, last activity with its address, and sign-in time. Sessions opened with "Login as" name the administrator who opened them. **Sign out** ends one session; its browser tabs return to the sign-in page. The user can sign in again unless the account is locked.

**API tokens** lists every user's tokens with their access and expiry; **Revoke** stops a token at once.

## Sign-in session lifetime

**Settings → Authentication → Sign-in session lifetime** sets for the whole instance:

| Setting | Range | Default |
|---|---|---|
| Sign out after inactivity | 1-720 hours | 12 hours |
| Maximum session age | 1-365 days | 30 days |

Changes apply to existing sessions within a minute; expired sessions are signed out in the browser as well. Terminal and desktop sessions count as activity.

## Your own devices and password

**Settings → Sign-in devices** lists the browsers signed in to your account. **Sign out** ends one of them; **Sign out all other devices** keeps only the current one.

**Settings → Account → Change password** (local accounts only) needs the current password and a new one of at least 12 characters. Changing it signs out your other devices. Accounts from LDAP or OIDC change their password at the identity provider.

## API tokens

Scripts and tools use the [API](./api-reference.md) with a token instead of your password. **Settings → API tokens → Create token** asks for:

| Field | Options |
|---|---|
| Name | What the token is for, shown in the list and in the audit log |
| Access | **Read only** (only reading requests) or **Read and write** |
| Expires after | 30, 90 or 365 days |

The token is shown once, right after creating it; INFRA-W only keeps a hash. It acts with your rights, and changes made with it name the token in the audit log. A token cannot see or change passwords, second factors, passkeys, sign-in devices or tokens (neither its own account's nor, for administrators, other users'), cannot use "Login as", and cannot open terminals, desktops or the file manager. It stops working when it expires, is revoked, or the account is locked or deleted.

## Status checks

**Settings → Status checks** controls the online/offline dots in the inventory:

- Servers are checked by opening a TCP connection to their address and port; Proxmox entries are asked through the Proxmox API.
- **Interval**: 10-300 seconds (default 30).
- Turned off, no host is contacted and every status shows as unknown.
- A host that stops answering or comes back can send a [notification](#notifications).

## Host keys

INFRA-W checks the host key of every SSH server (terminal, file manager and jump hosts):

- The first connection to an address and port trusts the key the server presents and records it.
- A later connection with a different key is refused with *The host key of … has changed*. Nothing is sent to the server, and the attempt is logged as *Host key changed*.

**Settings → Host keys** (administrators) lists the known keys with their servers, fingerprint and first and last use; changed keys come first. **Accept new key** trusts the presented key, for example after the server was reinstalled; only do this when you know why it changed. **Forget key** removes a key, and the next connection trusts whatever the host presents.

RDP servers are checked only when you pin their certificate, see [Workspace](./workspace.md#inventory).

## Notifications

**Settings → Notifications** (administrators) sends events to a webhook:

| Event | Sent when |
|---|---|
| A scheduled backup failed | A backup run by the schedule fails |
| An integration sync failed | A scheduled NetBox sync fails (a manual sync shows the error in the dialog) |
| A NetBox sync held back removals for review | See [Integrations](./integrations.md#removal-safeguard) |
| Hosts stopped answering | A status check finds hosts offline that were online |
| Hosts are reachable again | Such hosts answer again |

Each event is a JSON `POST`:

```json
{
  "source": "INFRA-W",
  "event": "hosts.offline",
  "time": "2026-09-30T08:15:00.000Z",
  "title": "Hosts offline",
  "message": "1 host stopped answering: web-01",
  "text": "Hosts offline: 1 host stopped answering: web-01",
  "details": { "hosts": [{ "name": "web-01", "address": "10.0.0.1" }] }
}
```

The `text` field suits Slack-style receivers (Slack, Mattermost, Google Chat); ntfy, Gotify, n8n or Teams workflows can read the rest. With a **Signing secret**, each request carries `X-INFRA-W-Signature: sha256=<HMAC-SHA256 of the body>`. The secret is stored encrypted and never shown again. **Send test** sends a test event. A failing webhook is logged and never stops the backup, sync or status check that triggered it.
