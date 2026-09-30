const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Account = require("../models/Account");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const EntryTag = require("../models/EntryTag");
const Folder = require("../models/Folder");
const Identity = require("../models/Identity");
const Credential = require("../models/Credential");
const Snippet = require("../models/Snippet");
const Script = require("../models/Script");
const Integration = require("../models/Integration");
const db = require("../utils/database");
const { Op } = require("sequelize");
const { getDisplayName } = require("../utils/displayName");

const ROLE_RANK = { member: 1, manager: 2, owner: 3 };

const effectiveRole = async (accountId, organizationId) => {
    const membership = await OrganizationMember.findOne({ where: { organizationId, accountId, status: "active" } });
    if (!membership) return null;
    if (membership.role !== "owner" && !(await OrganizationMember.findOne({ where: { organizationId, role: "owner", status: "active" } }))) {
        const account = await Account.findByPk(accountId);
        if (account?.role === "admin") return "owner";
    }
    return membership.role;
};

const hasRole = async (accountId, organizationId, minimum) => (ROLE_RANK[await effectiveRole(accountId, organizationId)] || 0) >= ROLE_RANK[minimum];

// not every table cascades from organizations
const removeOrganizationData = async (organizationId) => db.transaction(async (transaction) => {
    const ids = async (Model) => (await Model.findAll({ where: { organizationId }, attributes: ["id"], transaction })).map(row => row.id);
    const [entryIds, identityIds] = [await ids(Entry), await ids(Identity)];
    const options = where => ({ where, transaction });
    await EntryIdentity.destroy(options({ [Op.or]: [{ entryId: { [Op.in]: entryIds } }, { identityId: { [Op.in]: identityIds } }] }));
    await EntryTag.destroy(options({ entryId: { [Op.in]: entryIds } }));
    await Credential.destroy(options({ identityId: { [Op.in]: identityIds } }));
    for (const Model of [Entry, Folder, Identity, Snippet, Script, Integration, OrganizationMember]) await Model.destroy(options({ organizationId }));
    await Organization.destroy(options({ id: organizationId }));
});

module.exports.createOrganization = async (accountId, configuration) => {
    const organization = await Organization.create({
        name: configuration.name, description: configuration.description,
    });

    const existingMembership = await OrganizationMember.findOne({
        where: { organizationId: organization.id, accountId: accountId },
    });

    if (!existingMembership) {
        await OrganizationMember.create({
            organizationId: organization.id, accountId: accountId, role: "owner",
            status: "active", invitedBy: accountId,
        });
    }

    return organization;
};

module.exports.deleteOrganization = async (accountId, organizationId) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    if (!(await hasRole(accountId, orgId, "owner"))) {
        return { code: 403, message: "Only the owner can delete this organization" };
    }

    const { name } = await Organization.findByPk(orgId, { attributes: ["name"] });
    await removeOrganizationData(orgId);

    return { success: true, name };
};

module.exports.updateOrganization = async (accountId, organizationId, updates) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) {
        return { code: 400, message: "Invalid organization ID" };
    }

    if (!(await hasRole(accountId, orgId, "manager"))) {
        return { code: 403, message: "You don't have permission to update this organization" };
    }

    await Organization.update(updates, { where: { id: orgId } });

    return await Organization.findByPk(orgId);
};

module.exports.getOrganization = async (accountId, organizationId) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    const membership = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId, status: "active" } });

    if (!membership) {
        return { code: 403, message: "You don't have access to this organization" };
    }

    return await Organization.findByPk(orgId);
};

module.exports.listOrganizations = async (accountId) => {
    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });

    const organizationIds = memberships.map(m => m.organizationId);

    const organizations = await Organization.findAll({ where: { id: { [Op.in]: organizationIds } } });

    const roles = await Promise.all(organizations.map(org => effectiveRole(accountId, org.id)));
    return organizations.map((org, index) => ({ ...org, role: roles[index] }));
};

module.exports.listPendingInvitations = async (accountId) => {
    const pendingInvites = await OrganizationMember.findAll({ where: { accountId, status: "pending" } });

    const organizationIds = pendingInvites.map(invite => invite.organizationId);

    const organizations = await Organization.findAll({ where: { id: { [Op.in]: organizationIds } } });

    const inviterIds = [...new Set(pendingInvites.map(invite => invite.invitedBy))];
    const inviters = await Account.findAll({
        where: { id: { [Op.in]: inviterIds } },
        attributes: ["id", "firstName", "lastName", "username"],
    });

    return pendingInvites.map(invite => {
        const org = organizations.find(o => o.id === invite.organizationId);
        const inviter = inviters.find(i => i.id === invite.invitedBy);

        return {
            id: invite.organizationId,
            organization: { id: org.id, name: org.name, description: org.description },
            invitedBy: {
                id: inviter.id,
                name: getDisplayName(inviter),
                username: inviter.username,
            },
            createdAt: invite.createdAt,
        };
    });
};

module.exports.inviteUser = async (accountId, organizationId, username) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    if (!(await hasRole(accountId, orgId, "manager"))) return { code: 403, message: "You don't have permission to invite users to this organization" };
    const invitedUser = await Account.findOne({ where: { username: username } });

    if (!invitedUser) return { code: 404, message: "User not found" };

    const existingMembership = await OrganizationMember.findOne({
        where: { organizationId: orgId, accountId: invitedUser.id },
    });

    if (existingMembership) {
        if (existingMembership.status === "active") {
            return { code: 409, message: "User is already a member of this organization" };
        } else {
            return { code: 409, message: "User already has a pending invitation" };
        }
    }

    await OrganizationMember.create({
        organizationId: orgId, accountId: invitedUser.id, role: "member",
        status: "pending", invitedBy: accountId,
    });

    return { success: true, message: "Invitation sent successfully" };
};

module.exports.respondToInvitation = async (accountId, organizationId, accept) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    const invitation = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId, status: "pending" } });

    if (!invitation) return { code: 404, message: "Invitation not found" };

    if (accept) {
        await OrganizationMember.update({ status: "active" }, { where: { organizationId: orgId, accountId } });
        return { success: true, message: "Invitation accepted" };
    } else {
        await OrganizationMember.destroy({ where: { organizationId: orgId, accountId } });
        return { success: true, message: "Invitation declined" };
    }
};

module.exports.removeMember = async (accountId, organizationId, memberAccountId) => {
    const orgId = parseInt(organizationId, 10);
    const memberId = parseInt(memberAccountId, 10);

    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };
    if (isNaN(memberId) || memberId <= 0) return { code: 400, message: "Invalid member account ID" };

    const role = await effectiveRole(accountId, orgId);
    if ((ROLE_RANK[role] || 0) < ROLE_RANK.manager) {
        return { code: 403, message: "You don't have permission to remove members from this organization" };
    }

    const memberToRemove = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId: memberId } });

    if (!memberToRemove) {
        return { code: 404, message: "Member not found in this organization" };
    }

    if (ROLE_RANK[memberToRemove.role] >= ROLE_RANK[role]) {
        return { code: 403, message: memberToRemove.role === "owner" ? "Cannot remove the organization owner" : "Only the owner can remove managers" };
    }

    await OrganizationMember.destroy({ where: { organizationId: orgId, accountId: memberId } });

    return { success: true, message: "Member removed successfully" };
};

module.exports.listMembers = async (accountId, organizationId) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };
    const membership = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId, status: "active" } });

    if (!membership) {
        return { code: 403, message: "You don't have access to this organization" };
    }

    const members = await OrganizationMember.findAll({ where: { organizationId: orgId } });

    const memberAccountIds = members.map(m => m.accountId);
    const accounts = await Account.findAll({
        where: { id: { [Op.in]: memberAccountIds } },
        attributes: ["id", "firstName", "lastName", "username"],
    });

    return members
        .map(member => {
            const account = accounts.find(a => a.id === member.accountId);
            if (!account) return null;
            return {
                accountId: account.id, name: getDisplayName(account),
                username: account.username, role: member.role, status: member.status,
            };
        })
        .filter(Boolean);
};

module.exports.leaveOrganization = async (accountId, organizationId) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    const membership = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId, status: "active" } });

    if (!membership) {
        return { code: 404, message: "You are not a member of this organization" };
    }

    if (membership.role === "owner") {
        return { code: 403, message: "As the owner, you cannot leave the organization. Transfer the ownership or delete it instead" };
    }

    await OrganizationMember.destroy({ where: { organizationId: orgId, accountId } });

    return { success: true, message: "You have left the organization" };
};

module.exports.setMemberRole = async (accountId, organizationId, memberAccountId, role) => {
    const orgId = parseInt(organizationId, 10), memberId = parseInt(memberAccountId, 10);
    if (!(await hasRole(accountId, orgId, "owner"))) return { code: 403, message: "Only the owner can change roles" };
    const member = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId: memberId, status: "active" } });
    if (!member) return { code: 404, message: "Member not found in this organization" };
    if (member.role === "owner") return { code: 400, message: "Transfer the ownership to change the owner's role" };
    await OrganizationMember.update({ role }, { where: { organizationId: orgId, accountId: memberId } });
    return { accountId: memberId, role, previousRole: member.role };
};

module.exports.transferOwnership = async (accountId, organizationId, newOwnerId) => {
    const orgId = parseInt(organizationId, 10);
    if (!(await hasRole(accountId, orgId, "owner"))) return { code: 403, message: "Only the owner can transfer the ownership" };
    if (newOwnerId === accountId) return { code: 400, message: "You already own this organization" };
    const successor = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId: newOwnerId, status: "active" } });
    if (!successor) return { code: 404, message: "The new owner must be an active member" };
    await db.transaction(async (transaction) => {
        await OrganizationMember.update({ role: "manager" }, { where: { organizationId: orgId, role: "owner" }, transaction });
        await OrganizationMember.update({ role: "owner" }, { where: { organizationId: orgId, accountId: newOwnerId }, transaction });
    });
    return { newOwnerId };
};

// an organization without other members would be unreachable, so it is deleted
module.exports.handOverOrganizations = async (accountId) => {
    const owned = await OrganizationMember.findAll({ where: { accountId, role: "owner", status: "active" } });
    const result = { transferred: [], deleted: [] };
    for (const { organizationId } of owned) {
        const others = await OrganizationMember.findAll({ where: { organizationId, status: "active", accountId: { [Op.ne]: accountId } } });
        const successor = others.sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || new Date(a.createdAt) - new Date(b.createdAt))[0];
        if (successor) {
            await OrganizationMember.update({ role: "owner" }, { where: { organizationId, accountId: successor.accountId } });
            result.transferred.push({ organizationId, newOwnerId: successor.accountId });
        } else {
            await removeOrganizationData(organizationId);
            result.deleted.push(organizationId);
        }
    }
    return result;
};

module.exports.joinOrganizations = async (accountId, organizationIds = []) => {
    if (!organizationIds.length) return;

    const uniqueOrgIds = [...new Set(
        organizationIds
            .map((orgId) => Number(orgId))
            .filter((orgId) => Number.isInteger(orgId) && orgId > 0)
    )];
    if (!uniqueOrgIds.length) return;

    const organizations = await Organization.findAll({ where: { id: uniqueOrgIds } });
    const existingOrganizationIds = new Set(organizations.map((org) => org.id));

    for (const organizationId of uniqueOrgIds) {
        if (!existingOrganizationIds.has(organizationId)) continue;

        const existingMember = await OrganizationMember.findOne({ where: { organizationId, accountId } });
        if (existingMember) {
            await OrganizationMember.update(
                { status: "active", role: existingMember.role || "member", invitedBy: existingMember.invitedBy || accountId },
                { where: { organizationId, accountId } }
            );
            continue;
        }

        await OrganizationMember.create({
            organizationId,
            accountId,
            role: "member",
            status: "active",
            invitedBy: accountId,
        });
    }
};

module.exports.effectiveRole = effectiveRole;
