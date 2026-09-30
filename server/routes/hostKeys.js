const { Router } = require("express");
const { sendFailure } = require("../utils/error");
const { listHostKeys, acceptHostKey, forgetHostKey } = require("../controllers/hostKey");
const { auditRequest, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const app = Router();

/**
 * GET /host-keys
 * @summary List SSH Host Keys
 * @description Lists the trusted SSH host keys (trust on first use) with the servers at each address; keys that changed and wait for approval come first. Administrators only.
 * @tags Host Keys
 * @produces application/json
 * @security BearerAuth
 * @return {array<object>} 200 - Host keys: host, port, keyType, fingerprint, pending key, first and last seen, servers
 */
app.get("/", async (req, res) => {
    res.json(await listHostKeys());
});

/**
 * POST /host-keys/{id}/accept
 * @summary Accept a Changed Host Key
 * @description Trusts the changed key a host presented; connections to it work again.
 * @tags Host Keys
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Host key ID
 * @return {object} 200 - Key accepted
 * @return {object} 404 - Host key not found
 * @return {object} 409 - The key has not changed
 */
app.post("/:id/accept", async (req, res) => {
    const result = await acceptHostKey(Number(req.params.id));
    if (result?.code) return sendFailure(res, result);
    await auditRequest(req, { action: AUDIT_ACTIONS.HOST_KEY_ACCEPT, resource: RESOURCE_TYPES.HOST_KEY, resourceId: Number(req.params.id), details: result });
    res.json({ message: "Host key accepted" });
});

/**
 * DELETE /host-keys/{id}
 * @summary Forget a Host Key
 * @description Removes the trusted key; the next connection trusts the key the host presents then.
 * @tags Host Keys
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Host key ID
 * @return {object} 200 - Key forgotten
 * @return {object} 404 - Host key not found
 */
app.delete("/:id", async (req, res) => {
    const result = await forgetHostKey(Number(req.params.id));
    if (result?.code) return sendFailure(res, result);
    await auditRequest(req, { action: AUDIT_ACTIONS.HOST_KEY_FORGET, resource: RESOURCE_TYPES.HOST_KEY, resourceId: Number(req.params.id), details: result });
    res.json({ message: "Host key forgotten" });
});

module.exports = app;
