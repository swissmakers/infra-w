# LDAP Authentication

Sign in with accounts from FreeIPA, Microsoft Active Directory or another LDAP directory. Administrators configure providers under **Settings → Authentication**.

## How sign-in works

1. INFRA-W binds with the configured service account (**Bind identity**).
2. It searches the user below **Base DN** with the **User search filter**.
3. It verifies the password by binding as the user found. Empty passwords and ambiguous matches are rejected.
4. Name and email are updated from the directory attributes.
5. Membership in an **Admin group DN** makes the user an administrator; without it the user becomes a normal user at every sign-in. The last active administrator is never demoted this way, so a renamed group cannot lock everybody out.
6. The user is added to the **Organizations** selected for the provider.

Accounts that already exist locally or through OIDC are not taken over by LDAP. Two-factor authentication set up on an account also applies to LDAP sign-ins.

## Add a provider

1. Choose **Add LDAP**.
2. Under **Start with a directory preset**, pick **FreeIPA** or **Microsoft Active Directory**, enter the directory domain (for example `corp.example.com`) and choose **Apply defaults**.
3. Adjust the host and bind identity to your environment and enter the **Bind password**.
4. Choose **Test connection**. The test uses the values in the form, so you can test before saving.
5. Save with **Add provider**.

The presets fill in suggestions, not discovered values:

| | FreeIPA | Active Directory |
|---|---|---|
| Host | `ipa.<domain>` | `dc01.<domain>` |
| Port / TLS | 636, LDAPS | 636, LDAPS |
| Bind identity | `uid=infra-w,cn=sysaccounts,cn=etc,<suffix>` | `infra-w@<domain>` |
| Base DN | `cn=users,cn=accounts,<suffix>` | `<suffix>` |
| Username attribute | `uid` | `sAMAccountName` |
| User filter | active person with matching `uid` | active user with matching `sAMAccountName` or `userPrincipalName` |
| Group search | `member={{dn}}` below `cn=groups,cn=accounts` | nested membership (`LDAP_MATCHING_RULE_IN_CHAIN`) |

`<suffix>` is the domain written as `dc=` components. No password and no administrator group are filled in: create a dedicated read-only service account and set the admin groups yourself.

## Enable the provider

New providers are saved **disabled**. Enable a provider only after testing it with a normal user and an intended administrator.

::: warning One active sign-in method
Only one LDAP provider can be active. Enabling it disables the other LDAP providers **and the internal username/password sign-in**. At least one provider always stays enabled. Keep a tested administrator account in the directory before you switch.
:::

## Fields

| Field | Notes |
|---|---|
| Display name | Name in the provider list; users sign in with the normal username and password form |
| Host, Port | `636` for LDAPS, `389` for unencrypted LDAP (not recommended) |
| Use TLS/SSL | LDAPS; recommended |
| Bind identity (DN or UPN), Bind password | Service account; the password is stored encrypted and never shown again |
| Base DN, User search filter | The filter must contain `{{username}}` |
| Username, email, first and last name attributes | Defaults `uid`, `mail`, `givenName`, `sn` |
| Organizations | Users of this provider become members of these organizations |
| Admin group DNs | Full group DNs, one per line |
| Group search base DN, filter, name and member attributes | Defaults `(member={{dn}})`, `cn`, `member` |
| Connection and search timeout (ms) | Default 10000 each; raise for slow links or large directories |

Search filter examples:

| Directory | User search filter |
|---|---|
| Active Directory | `(sAMAccountName={{username}})` |
| OpenLDAP | `(uid={{username}})` |
| Sign-in with email | `(mail={{username}})` |

## Testing

- **Test connection** checks the bind and a search in the base DN and shows diagnostics (host, port, TLS, bind DN, duration, search probe). The saved bind password is never returned.
- **Test users** (saved providers) lists matched users and who would become an administrator, so you can check the group mapping before enabling the provider.

## Certificates

Keep `STRICT_TLS=true`. If your directory uses an internal CA, mount it and set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem` for the container, see [Installation](./installation.md#configuration).

## Troubleshooting

| Symptom | Check |
|---|---|
| `ECONNREFUSED` or timeout | Host, port, firewall; LDAPS usually needs port 636 |
| `INVALID_CREDENTIALS` | Bind identity and password of the service account |
| No users found | Base DN and user search filter; test with **Test users** |
| Administrator rights missing | Admin group DNs must be full DNs; check group search base and filter |
| TLS handshake failure | Certificate chain; add the CA with `NODE_EXTRA_CA_CERTS` |
