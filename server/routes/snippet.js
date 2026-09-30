const { createCommandRouter } = require("./command");
const controller = require("../controllers/snippet");
const { snippetCreationValidation, snippetEditValidation, snippetRepositionValidation } = require("../validations/snippet");

/**
 * GET /snippets/all
 * @summary List Snippets
 * @description Lists the personal snippets of the account and the snippets of its organizations, in their manual order.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - Accessible snippets
 */

/**
 * GET /snippets/{id}
 * @summary Get Snippet
 * @description Returns one snippet; organization snippets need the organizationId query parameter.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Snippet ID
 * @param {number} organizationId.query - Organization of the snippet
 * @return {object} 200 - The snippet
 * @return {object} 404 - Snippet not found
 */

/**
 * PUT /snippets
 * @summary Create Snippet
 * @description Creates a personal snippet, or an organization snippet when organizationId is set.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {SnippetCreation} request.body.required - name, command, description, organizationId and osFilter
 * @return {object} 201 - Snippet created with its id
 */

/**
 * PATCH /snippets/{id}
 * @summary Update Snippet
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Snippet ID
 * @param {number} organizationId.query - Organization of the snippet
 * @param {SnippetEdit} request.body.required - Changed fields
 * @return {object} 200 - Snippet updated
 */

/**
 * DELETE /snippets/{id}
 * @summary Delete Snippet
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Snippet ID
 * @param {number} organizationId.query - Organization of the snippet
 * @return {object} 200 - Snippet deleted
 */

/**
 * PATCH /snippets/{id}/reposition
 * @summary Reorder Snippet
 * @description Moves the snippet to the position of the target snippet.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Snippet ID
 * @param {number} organizationId.query - Organization of the snippet
 * @param {SnippetReposition} request.body.required - targetId
 * @return {object} 200 - Snippet moved
 */
module.exports = createCommandRouter(controller, {
    creation: snippetCreationValidation, edit: snippetEditValidation, reposition: snippetRepositionValidation,
}, "Snippet");
