const Script = require("../models/Script");
const { createCommandController } = require("./command");

module.exports = createCommandController(Script, "SCRIPTS", "Script");
