export function createLdapPreset(kind, domain) {
    const normalized = String(domain).trim().toLowerCase();
    if (normalized.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
        throw new Error("Enter a directory domain such as corp.example.com.");
    }
    const suffix = normalized.split('.').map(part => `dc=${part}`).join(',');
    const common = { port: "636", useTLS: true, emailAttr: "mail", firstNameAttr: "givenName", lastNameAttr: "sn", groupNameAttribute: "cn", groupMemberAttribute: "member" };
    if (kind === 'freeipa') return {
        ...common, name: "FreeIPA", host: `ipa.${normalized}`,
        bindDN: `uid=infra-w,cn=sysaccounts,cn=etc,${suffix}`,
        baseDN: `cn=users,cn=accounts,${suffix}`, usernameAttr: "uid",
        userSearchFilter: "(&(objectClass=person)(uid={{username}})(!(nsaccountlock=TRUE)))",
        groupSearchBaseDN: `cn=groups,cn=accounts,${suffix}`, groupSearchFilter: "(member={{dn}})",
    };
    if (kind === 'ad') return {
        ...common, name: "Microsoft Active Directory", host: `dc01.${normalized}`,
        bindDN: `infra-w@${normalized}`, baseDN: suffix, usernameAttr: "sAMAccountName",
        userSearchFilter: "(&(objectCategory=person)(objectClass=user)(|(sAMAccountName={{username}})(userPrincipalName={{username}}))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
        groupSearchBaseDN: suffix, groupSearchFilter: "(&(objectClass=group)(member:1.2.840.113556.1.4.1941:={{dn}}))",
    };
    throw new Error("Unknown directory preset");
}
