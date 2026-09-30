const { Router } = require("express");
const { sendFailure } = require("../utils/error");
const { validateSchema } = require("../utils/schema");
const { hasOrganizationAccess } = require("../utils/permission");

module.exports.createCommandRouter = (controller, validations, noun) => {
    const app = Router();
    const organizationOf = req => (req.query.organizationId ? parseInt(req.query.organizationId) : null);
    const denied = async (req, res, organizationId) => {
        if (!organizationId || await hasOrganizationAccess(req.user.id, organizationId)) return false;
        res.status(403).json({ code: 403, message: "Access denied to this organization" });
        return true;
    };

    app.get("/all", async (req, res) => {
        res.json(await controller.listAccessible(req.user.id));
    });

    app.get("/:id", async (req, res) => {
        const organizationId = organizationOf(req);
        if (await denied(req, res, organizationId)) return;
        const item = await controller.get(req.user.id, req.params.id, organizationId);
        if (item?.code) return sendFailure(res, item);
        res.json(item);
    });

    app.put("/", async (req, res) => {
        if (validateSchema(res, validations.creation, req.body)) return;
        if (await denied(req, res, req.body.organizationId)) return;
        const item = await controller.create(req.user.id, req.body);
        res.status(201).json({ message: `${noun} created successfully`, id: item.id });
    });

    app.patch("/:id", async (req, res) => {
        if (validateSchema(res, validations.edit, req.body)) return;
        const organizationId = organizationOf(req);
        if (await denied(req, res, organizationId)) return;
        const result = await controller.edit(req.user.id, req.params.id, req.body, organizationId);
        if (result?.code) return sendFailure(res, result);
        res.json({ message: `${noun} updated successfully` });
    });

    app.delete("/:id", async (req, res) => {
        const organizationId = organizationOf(req);
        if (await denied(req, res, organizationId)) return;
        const result = await controller.remove(req.user.id, req.params.id, organizationId);
        if (result?.code) return sendFailure(res, result);
        res.json({ message: `${noun} deleted successfully` });
    });

    app.patch("/:id/reposition", async (req, res) => {
        if (validateSchema(res, validations.reposition, req.body)) return;
        const organizationId = organizationOf(req);
        if (await denied(req, res, organizationId)) return;
        const result = await controller.reposition(req.user.id, req.params.id, req.body, organizationId);
        if (result?.code) return sendFailure(res, result);
        res.json({ message: `${noun} repositioned successfully` });
    });

    return app;
};
