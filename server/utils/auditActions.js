const AUDIT_ACTIONS = {
    SSH_CONNECT: "entry.ssh_connect",
    SFTP_CONNECT: "entry.sftp_connect",
    PVE_CONNECT: "entry.pve_connect",
    RDP_CONNECT: "entry.rdp_connect",
    VNC_CONNECT: "entry.vnc_connect",
    TELNET_CONNECT: "entry.telnet_connect",
    SHARE_START: "entry.share_start",
    SHARE_STOP: "entry.share_stop",
    SHARE_UPDATE: "entry.share_update",

    FILE_UPLOAD: "file.upload",
    FILE_DOWNLOAD: "file.download",
    FILE_CREATE: "file.create",
    FILE_DELETE: "file.delete",
    FILE_RENAME: "file.rename",
    FILE_CHMOD: "file.chmod",

    FOLDER_CREATE: "folder.create",
    FOLDER_DELETE: "folder.delete",
    FOLDER_DOWNLOAD: "folder.download",

    ENTRY_CREATE: "entry.create",
    ENTRY_UPDATE: "entry.update",
    ENTRY_DELETE: "entry.delete",
    ENTRY_POWER: "entry.power",
    ENTRY_WAKE: "entry.wake",

    IDENTITY_CREATE: "identity.create",
    IDENTITY_UPDATE: "identity.update",
    IDENTITY_DELETE: "identity.delete",
    IDENTITY_CREDENTIALS_ACCESS: "identity.credentials_access",

    FOLDER_CREATE_MGMT: "folder_mgmt.create",
    FOLDER_UPDATE_MGMT: "folder_mgmt.update",
    FOLDER_DELETE_MGMT: "folder_mgmt.delete",

    SCRIPT_EXECUTE: "script.execute",

    SIGN_IN: "auth.sign_in",
    SIGN_IN_FAILED: "auth.sign_in_failed",
    SIGN_OUT: "auth.sign_out",
    IMPERSONATE: "auth.impersonate",
    API_TOKEN_CREATE: "auth.token_create",
    API_TOKEN_REVOKE: "auth.token_revoke",

    ACCOUNT_CREATE: "account.create",
    ACCOUNT_DELETE: "account.delete",
    ACCOUNT_ROLE_CHANGE: "account.role_change",
    ACCOUNT_PASSWORD_CHANGE: "account.password_change",
    ACCOUNT_PASSWORD_RESET: "account.password_reset",
    ACCOUNT_LOCK: "account.lock",
    ACCOUNT_UNLOCK: "account.unlock",
    ACCOUNT_MFA_RESET: "account.mfa_reset",
    SESSION_REVOKE: "auth.session_revoke",
    AUDIT_EXPORT: "audit.export",
    ORGANIZATION_UPDATE: "organization.update",
    ORGANIZATION_TRANSFER: "organization.transfer",
    ORGANIZATION_DELETE: "organization.delete",
    MEMBER_ROLE_CHANGE: "organization.member_role",
    MEMBER_INVITE: "organization.member_invite",
    MEMBER_JOIN: "organization.member_join",
    MEMBER_REMOVE: "organization.member_remove",
    AUTH_PROVIDER_CREATE: "auth_provider.create",
    AUTH_PROVIDER_UPDATE: "auth_provider.update",
    AUTH_PROVIDER_DELETE: "auth_provider.delete",
    SETTINGS_UPDATE: "settings.update",
    HOST_KEY_TRUST: "host_key.trust",
    HOST_KEY_MISMATCH: "host_key.mismatch",
    HOST_KEY_ACCEPT: "host_key.accept",
    HOST_KEY_FORGET: "host_key.forget",
    INTEGRATION_REMOVALS_APPLY: "integration.removals_apply",
    BACKUP_CREATE: "backup.create",
    BACKUP_RESTORE: "backup.restore",
    DATABASE_DOWNLOAD: "backup.database_download",
};

const RESOURCE_TYPES = {
    ENTRY: "entry", IDENTITY: "identity", FOLDER: "folder", FILE: "file", SCRIPT: "script",
    ACCOUNT: "account", ORGANIZATION: "organization", AUTH_PROVIDER: "auth_provider", SETTINGS: "settings", BACKUP: "backup", AUDIT: "audit", HOST_KEY: "host_key", INTEGRATION: "integration",
};

const A = AUDIT_ACTIONS;
const AUDIT_GROUPS = {
    connections: { setting: "enableServerConnectionAudit", actions: [A.SSH_CONNECT, A.SFTP_CONNECT, A.PVE_CONNECT, A.RDP_CONNECT,
        A.VNC_CONNECT, A.TELNET_CONNECT, A.SHARE_START, A.SHARE_STOP, A.SHARE_UPDATE] },
    files: { setting: "enableFileOperationAudit", actions: [A.FILE_UPLOAD, A.FILE_DOWNLOAD, A.FILE_CREATE, A.FILE_DELETE,
        A.FILE_RENAME, A.FILE_CHMOD, A.FOLDER_CREATE, A.FOLDER_DELETE, A.FOLDER_DOWNLOAD] },
    servers: { setting: "enableServerManagementAudit", actions: [A.ENTRY_CREATE, A.ENTRY_UPDATE, A.ENTRY_DELETE, A.ENTRY_POWER, A.ENTRY_WAKE] },
    identities: { setting: "enableIdentityManagementAudit", actions: [A.IDENTITY_CREATE, A.IDENTITY_UPDATE, A.IDENTITY_DELETE] },
    passwords: { setting: "enableIdentityCredentialsAccessAudit", actions: [A.IDENTITY_CREDENTIALS_ACCESS] },
    folders: { setting: "enableFolderManagementAudit", actions: [A.FOLDER_CREATE_MGMT, A.FOLDER_UPDATE_MGMT, A.FOLDER_DELETE_MGMT] },
    scripts: { setting: "enableScriptExecutionAudit", actions: [A.SCRIPT_EXECUTE] },
    signIn: { setting: null, actions: [A.SIGN_IN, A.SIGN_IN_FAILED, A.SIGN_OUT, A.IMPERSONATE, A.API_TOKEN_CREATE, A.API_TOKEN_REVOKE] },
    administration: { setting: null, actions: [A.ACCOUNT_CREATE, A.ACCOUNT_DELETE, A.ACCOUNT_ROLE_CHANGE, A.ACCOUNT_PASSWORD_CHANGE,
        A.ACCOUNT_PASSWORD_RESET, A.ACCOUNT_LOCK, A.ACCOUNT_UNLOCK, A.ACCOUNT_MFA_RESET, A.SESSION_REVOKE, A.AUDIT_EXPORT, A.ORGANIZATION_UPDATE, A.ORGANIZATION_TRANSFER, A.ORGANIZATION_DELETE, A.MEMBER_ROLE_CHANGE, A.MEMBER_INVITE, A.MEMBER_JOIN, A.MEMBER_REMOVE, A.AUTH_PROVIDER_CREATE, A.AUTH_PROVIDER_UPDATE,
        A.AUTH_PROVIDER_DELETE, A.SETTINGS_UPDATE, A.HOST_KEY_TRUST, A.HOST_KEY_MISMATCH, A.HOST_KEY_ACCEPT, A.HOST_KEY_FORGET, A.INTEGRATION_REMOVALS_APPLY, A.BACKUP_CREATE, A.BACKUP_RESTORE, A.DATABASE_DOWNLOAD] },
};

const auditGroupOf = (action) => Object.keys(AUDIT_GROUPS).find(key => AUDIT_GROUPS[key].actions.includes(action)) || null;

module.exports = { AUDIT_ACTIONS, RESOURCE_TYPES, AUDIT_GROUPS, auditGroupOf };
