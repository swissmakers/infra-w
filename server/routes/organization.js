const express = require("express");
const { sendFailure } = require("../utils/error");
const logger = require("../utils/logger");
const app = express.Router();
const { validateSchema } = require("../utils/schema");
const organizationController = require("../controllers/organization");
const { auditRequest, exportAuditLogs, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const auditMember = (req, action, organizationId, accountId, details = {}) => auditRequest(req, {
    action, organizationId: Number(organizationId), resource: RESOURCE_TYPES.ORGANIZATION, resourceId: Number(organizationId),
    details: { ...details, ...(accountId && { accountId: Number(accountId) }) },
});
const {
    createOrganizationSchema,
    updateOrganizationSchema,
    inviteUserSchema,
    respondToInvitationSchema,
    memberRoleSchema,
    transferOwnershipSchema,
} = require("../validations/organization");

/**
 * PUT /organizations
 * @summary Create Organization
 * @description Creates a new organization with the authenticated user as the owner. Organizations allow multiple users to collaborate and share resources.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {CreateOrganizationSchema} request.body.required - Organization details including name and description
 * @return {object} 201 - Organization successfully created
 * @return {object} 400 - Invalid organization data
 */
app.put("/", async (req, res) => {
    try {
        if (validateSchema(res, createOrganizationSchema, req.body)) return;

        const result = await organizationController.createOrganization(req.user.id, req.body);

        if (result.code) {
            return sendFailure(res, result);
        }

        res.status(201).json(result);
    } catch (error) {
        logger.error("Error creating organization", { error: error.message, stack: error.stack });
        res.status(500).json({ message: "An error occurred while creating the organization" });
    }
});

/**
 * PATCH /organizations/{id}
 * @summary Update Organization
 * @description Updates an existing organization's details such as name or description. Owners and managers can perform this action.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {UpdateOrganizationSchema} request.body.required - Updated organization details
 * @return {object} 200 - Organization successfully updated
 * @return {object} 403 - Insufficient permissions
 * @return {object} 404 - Organization not found
 */
app.patch("/:id", async (req, res) => {
    try {
        if (validateSchema(res, updateOrganizationSchema, req.body)) return;

        const result = await organizationController.updateOrganization(req.user.id, req.params.id, req.body);

        if (result.code) {
            return sendFailure(res, result);
        }
        await auditRequest(req, { action: AUDIT_ACTIONS.ORGANIZATION_UPDATE, organizationId: result.id, resource: RESOURCE_TYPES.ORGANIZATION,
            resourceId: result.id, details: { name: result.name } });

        res.json(result);
    } catch (error) {
        logger.error("Error updating organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while updating the organization" });
    }
});

/**
 * DELETE /organizations/{id}
 * @summary Delete Organization
 * @description Permanently deletes an organization and all associated data. Only organization owners can perform this action.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {object} 200 - Organization successfully deleted
 * @return {object} 403 - Insufficient permissions
 * @return {object} 404 - Organization not found
 */
app.delete("/:id", async (req, res) => {
    try {
        const result = await organizationController.deleteOrganization(req.user.id, req.params.id);

        if (result.code) {
            return sendFailure(res, result);
        }
        await auditRequest(req, { action: AUDIT_ACTIONS.ORGANIZATION_DELETE, resource: RESOURCE_TYPES.ORGANIZATION,
            resourceId: Number(req.params.id), details: { name: result.name } });

        res.json(result);
    } catch (error) {
        logger.error("Error deleting organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while deleting the organization" });
    }
});

/**
 * GET /organizations/{id}
 * @summary Get Organization Details
 * @description Retrieves detailed information about a specific organization.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {object} 200 - Organization details
 * @return {object} 403 - Access denied to organization
 * @return {object} 404 - Organization not found
 */
app.get("/:id", async (req, res) => {
    try {
        const result = await organizationController.getOrganization(req.user.id, req.params.id);

        if (result.code) {
            return sendFailure(res, result);
        }

        res.json(result);
    } catch (error) {
        logger.error("Error fetching organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while fetching the organization" });
    }
});

/**
 * GET /organizations
 * @summary List Organizations
 * @description Retrieves a list of all organizations that the authenticated user is a member of or owns.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of organizations
 */
app.get("/", async (req, res) => {
    try {
        const result = await organizationController.listOrganizations(req.user.id);
        res.json(result);
    } catch (error) {
        logger.error("Error listing organizations", { error: error.message });
        res.status(500).json({ message: "An error occurred while listing organizations" });
    }
});

/**
 * GET /organizations/{id}/members
 * @summary List Organization Members
 * @description Retrieves a list of all members in a specific organization, including their roles and status.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {array} 200 - List of organization members
 * @return {object} 403 - Access denied to organization
 * @return {object} 404 - Organization not found
 */
app.get("/:id/members", async (req, res) => {
    try {
        const result = await organizationController.listMembers(req.user.id, req.params.id);

        if (result.code) {
            return sendFailure(res, result);
        }

        res.json(result);
    } catch (error) {
        logger.error("Error listing organization members", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while listing organization members" });
    }
});

/**
 * POST /organizations/{id}/invite
 * @summary Invite User to Organization
 * @description Sends an invitation to a user to join the organization. Owners and managers can send invitations.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {InviteUserSchema} request.body.required - Username of the user to invite
 * @return {object} 200 - Invitation successfully sent
 * @return {object} 403 - Insufficient permissions
 * @return {object} 404 - Organization or user not found
 */
app.post("/:id/invite", async (req, res) => {
    try {
        if (validateSchema(res, inviteUserSchema, req.body)) return;

        const result = await organizationController.inviteUser(req.user.id, req.params.id, req.body.username);

        if (result.code) {
            return sendFailure(res, result);
        }
        await auditMember(req, AUDIT_ACTIONS.MEMBER_INVITE, req.params.id, null, { username: req.body.username });

        res.json(result);
    } catch (error) {
        logger.error("Error inviting user to organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while sending the invitation" });
    }
});

/**
 * DELETE /organizations/{id}/members/{accountId}
 * @summary Remove Organization Member
 * @description Removes a member or a pending invitation. Owners remove managers and members, managers remove members.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {string} accountId.path.required - The unique identifier of the member to remove
 * @return {object} 200 - Member successfully removed
 * @return {object} 403 - Insufficient permissions
 * @return {object} 404 - Organization or member not found
 */
app.delete("/:id/members/:accountId", async (req, res) => {
    try {
        const result = await organizationController.removeMember(req.user.id, req.params.id, req.params.accountId);

        if (result.code) {
            return sendFailure(res, result);
        }
        await auditMember(req, AUDIT_ACTIONS.MEMBER_REMOVE, req.params.id, req.params.accountId);

        res.json(result);
    } catch (error) {
        logger.error("Error removing member from organization", { organizationId: req.params.id, accountId: req.params.accountId, error: error.message });
        res.status(500).json({ message: "An error occurred while removing the member" });
    }
});

/**
 * PATCH /organizations/{id}/members/{accountId}
 * @summary Change a Member's Role
 * @description The owner makes an active member a manager (invites and removes members, renames the organization) or a member again.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {string} accountId.path.required - The member's account ID
 * @param {object} request.body.required - { "role": "manager" } or { "role": "member" }
 * @return {object} 200 - Role changed
 * @return {object} 403 - Only the owner can change roles
 * @return {object} 404 - Member not found
 */
app.patch("/:id/members/:accountId", async (req, res) => {
    if (validateSchema(res, memberRoleSchema, req.body)) return;
    const result = await organizationController.setMemberRole(req.user.id, req.params.id, req.params.accountId, req.body.role);
    if (result.code) return sendFailure(res, result);
    await auditMember(req, AUDIT_ACTIONS.MEMBER_ROLE_CHANGE, req.params.id, req.params.accountId, { role: result.role, previousRole: result.previousRole });
    res.json(result);
});

/**
 * POST /organizations/{id}/transfer
 * @summary Transfer Ownership
 * @description The owner hands the organization to an active member and becomes a manager.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {object} request.body.required - { "accountId": 12 }
 * @return {object} 200 - Ownership transferred
 * @return {object} 403 - Only the owner can transfer the ownership
 * @return {object} 404 - The new owner is not an active member
 */
app.post("/:id/transfer", async (req, res) => {
    if (validateSchema(res, transferOwnershipSchema, req.body)) return;
    const result = await organizationController.transferOwnership(req.user.id, req.params.id, req.body.accountId);
    if (result.code) return sendFailure(res, result);
    await auditMember(req, AUDIT_ACTIONS.ORGANIZATION_TRANSFER, req.params.id, req.body.accountId);
    res.json(result);
});

/**
 * GET /organizations/{id}/audit/export
 * @summary Export the Organization's Audit Log
 * @description The owner downloads the organization's audit entries (all of them, at most 100000) as CSV, in the same format as the administrators' export. The export is audited.
 * @tags Organization
 * @produces text/csv
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {file} 200 - CSV file
 * @return {object} 403 - Only the owner can export
 */
app.get("/:id/audit/export", async (req, res) => {
    const organizationId = Number(req.params.id);
    if (await organizationController.effectiveRole(req.user.id, organizationId) !== "owner") {
        return res.status(403).json({ code: 403, message: "Only the owner can export the organization's audit log" });
    }
    const { csv, rows } = await exportAuditLogs({ organizationId });
    await auditRequest(req, { action: AUDIT_ACTIONS.AUDIT_EXPORT, organizationId, resource: RESOURCE_TYPES.AUDIT, details: { rows, organizationId } });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="infra-w-audit-organization-${organizationId}.csv"`);
    res.send(csv);
});

/**
 * GET /organizations/invitations/pending
 * @summary List Pending Invitations
 * @description Retrieves a list of all pending organization invitations for the authenticated user.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of pending invitations
 */
app.get("/invitations/pending", async (req, res) => {
    try {
        const result = await organizationController.listPendingInvitations(req.user.id);
        res.json(result);
    } catch (error) {
        logger.error("Error listing pending invitations", { error: error.message });
        res.status(500).json({ message: "An error occurred while listing pending invitations" });
    }
});

/**
 * POST /organizations/invitations/{id}/respond
 * @summary Respond to Organization Invitation
 * @description Accepts or declines a pending organization invitation.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the invitation
 * @param {RespondToInvitationSchema} request.body.required - Response containing accept boolean value
 * @return {object} 200 - Response processed successfully
 * @return {object} 404 - Invitation not found
 */
app.post("/invitations/:id/respond", async (req, res) => {
    try {
        if (validateSchema(res, respondToInvitationSchema, req.body)) return;

        const result = await organizationController.respondToInvitation(req.user.id, req.params.id, req.body.accept);

        if (result.code) {
            return sendFailure(res, result);
        }
        if (req.body.accept) await auditMember(req, AUDIT_ACTIONS.MEMBER_JOIN, req.params.id, req.user.id);

        res.json(result);
    } catch (error) {
        logger.error("Error responding to invitation", { invitationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while processing your response" });
    }
});

/**
 * POST /organizations/{id}/leave
 * @summary Leave Organization
 * @description Allows a user to leave an organization they are a member of. Organization owners cannot leave their own organization.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {object} 200 - Successfully left organization
 * @return {object} 403 - Cannot leave organization (e.g., owner trying to leave)
 * @return {object} 404 - Organization not found
 */
app.post("/:id/leave", async (req, res) => {
    try {
        const result = await organizationController.leaveOrganization(req.user.id, req.params.id);

        if (result.code) {
            return sendFailure(res, result);
        }
        await auditMember(req, AUDIT_ACTIONS.MEMBER_REMOVE, req.params.id, req.user.id, { left: true });

        res.json(result);
    } catch (error) {
        logger.error("Error leaving organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while leaving the organization" });
    }
});

module.exports = app;