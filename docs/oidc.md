# OIDC / SSO Authentication

Use OpenID Connect (OIDC) to authenticate users with a centralized identity provider.

## Prerequisites

- OIDC-compatible IdP (for example Keycloak, Entra ID, Authentik, Google)
- Public URL for INFRA-W
- Registered OIDC client/application in your IdP
- Redirect URI configured in IdP and INFRA-W

## Required Provider Fields

Configure in **Settings -> Authentication -> Add OIDC Provider**:

- `name`
- `issuer` (must match IdP metadata exactly)
- `clientId`
- `clientSecret` (if confidential client)
- `redirectUri`
- `scope` (default: `openid profile`)

Recommended baseline scope:

`openid profile email`

## Redirect URI

Use the callback endpoint exposed by INFRA-W:

`https://<infra-w-host>/api/auth/oidc/callback`

> [!WARNING]
> Redirect URI mismatch is the most common cause of failed OIDC sign-in.

## Claim Mapping

Default mappings:

| INFRA-W Field | OIDC Claim |
|---|---|
| Username | `preferred_username` |
| First Name | `given_name` |
| Last Name | `family_name` |

Adjust `usernameAttribute`, `firstNameAttribute`, and `lastNameAttribute` if your IdP uses non-standard claim names.

## Group Mapping

The **Group mapping** section of the provider reads the user's groups from a token claim at every sign-in:

| Field | Effect |
|---|---|
| Groups claim | The claim with the groups, default `groups`. A list or a comma-separated string; names compare case-insensitively. |
| Administrator groups | One per line. When set, members of one of them become administrators and everybody else a normal user, at every sign-in. Left empty, INFRA-W does not change roles. |
| Organizations by group | Pairs of group and organization. Members of the group are added to the organization as members at sign-in; existing roles stay, and nobody is removed when they leave the group. |

Add the scope that provides the claim (often `groups`) and check in your IdP that the claim reaches the ID token or the userinfo endpoint. The last active administrator is never demoted by the mapping, so a wrong claim name cannot lock everybody out; keep a local or second administrator anyway.

## Provider Examples

- **Entra ID** issuer: `https://login.microsoftonline.com/<tenant-id>/v2.0`
- **Google** issuer: `https://accounts.google.com`
- **Keycloak** issuer: `https://<host>/realms/<realm>`
- **Authentik** issuer: `https://<host>/application/o/<slug>/`

Always verify the issuer and endpoints through:

`<issuer>/.well-known/openid-configuration`

## Validation Workflow

1. Save provider configuration.
2. Enable provider.
3. Confirm login page displays provider button.
4. Complete login flow and return to INFRA-W.
5. Verify mapped user profile fields after first login.

## Security Guidance

- Keep INFRA-W behind HTTPS when using OIDC.
- Use confidential clients where supported.
- Restrict client redirect URIs to exact production URLs.
- Rotate client secrets according to security policy.

## Troubleshooting

- **Issuer mismatch**: use exact `issuer` from metadata.
- **Callback error**: check redirect URI and proxy forwarding.
- **Missing username/name fields**: adjust scope and claim mapping.
- **Groups ignored**: the claim name must match exactly (for example `groups` or `roles`), and the IdP must include it for this client.
- **Login loop**: verify system clock synchronization on both IdP and INFRA-W hosts.
