const Snippet = require("../models/Snippet");
const { createCommandController } = require("./command");

module.exports = createCommandController(Snippet, "SNIPPETS", "Snippet");
