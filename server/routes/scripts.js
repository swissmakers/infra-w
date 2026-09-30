const { createCommandRouter } = require("./command");
const controller = require("../controllers/script");
const { scriptCreationValidation, scriptEditValidation, scriptRepositionValidation } = require("../validations/script");

/**
 * GET /scripts/all
 * @summary List Scripts
 * @description Lists the personal scripts of the account and the scripts of its organizations, in their manual order.
 * @tags Script
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - Accessible scripts
 */

/**
 * GET /scripts/{id}
 * @summary Get Script
 * @description Returns one script; organization scripts need the organizationId query parameter.
 * @tags Script
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Script ID
 * @param {number} organizationId.query - Organization of the script
 * @return {object} 200 - The script
 * @return {object} 404 - Script not found
 */

/**
 * PUT /scripts
 * @summary Create Script
 * @description Creates a personal script, or an organization script when organizationId is set.
 * @tags Script
 * @produces application/json
 * @security BearerAuth
 * @param {ScriptCreation} request.body.required - name, content, description, organizationId and osFilter
 * @return {object} 201 - Script created with its id
 */

/**
 * PATCH /scripts/{id}
 * @summary Update Script
 * @tags Script
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Script ID
 * @param {number} organizationId.query - Organization of the script
 * @param {ScriptEdit} request.body.required - Changed fields
 * @return {object} 200 - Script updated
 */

/**
 * DELETE /scripts/{id}
 * @summary Delete Script
 * @tags Script
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Script ID
 * @param {number} organizationId.query - Organization of the script
 * @return {object} 200 - Script deleted
 */

/**
 * PATCH /scripts/{id}/reposition
 * @summary Reorder Script
 * @description Moves the script to the position of the target script.
 * @tags Script
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Script ID
 * @param {number} organizationId.query - Organization of the script
 * @param {ScriptReposition} request.body.required - targetId
 * @return {object} 200 - Script moved
 */
module.exports = createCommandRouter(controller, {
    creation: scriptCreationValidation, edit: scriptEditValidation, reposition: scriptRepositionValidation,
}, "Script");
