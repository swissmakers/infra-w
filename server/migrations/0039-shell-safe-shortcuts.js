const MOVES = [["search", "ctrl+s", "ctrl+shift+f"], ["quick-action", "ctrl+p", "ctrl+shift+l"], ["broadcast", "ctrl+b", "ctrl+shift+b"]];

module.exports = {
    async up(queryInterface) {
        for (const [action, oldKey, newKey] of MOVES) {
            await queryInterface.sequelize.query(
                `UPDATE keymaps SET key = ? WHERE action = ? AND key = ?
                 AND NOT EXISTS (SELECT 1 FROM keymaps other WHERE other.accountId = keymaps.accountId AND other.key = ?)`,
                { replacements: [newKey, action, oldKey, newKey] },
            );
        }
    },
};
