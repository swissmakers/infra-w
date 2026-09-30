const crypto = require("crypto");
const stateBroadcaster = require("../lib/StateBroadcaster");
const { EVENT_TYPES } = require("../lib/StateBroadcaster");

const ANSWER_TIMEOUT = 2 * 60 * 1000;
const pending = new Map();

// answers can be one-time codes or passwords, never log them
const askAccount = (accountId, { sessionId = null, title, instructions = "", prompts }) => new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const settle = (callback, value) => {
        clearTimeout(pending.get(id)?.timer);
        pending.delete(id);
        stateBroadcaster.notify(accountId, EVENT_TYPES.CONNECTION_PROMPT_DONE, { id });
        callback(value);
    };
    pending.set(id, {
        accountId,
        answer: answers => settle(resolve, answers),
        cancel: () => settle(reject, new Error("The sign-in prompt was cancelled")),
        timer: setTimeout(() => settle(reject, new Error("The sign-in prompt was not answered in time")), ANSWER_TIMEOUT),
    });
    stateBroadcaster.notify(accountId, EVENT_TYPES.CONNECTION_PROMPT, { id, sessionId, title, instructions, prompts });
});

const answerPrompt = (accountId, id, { answers, cancel }) => {
    const prompt = pending.get(id);
    if (!prompt || prompt.accountId !== accountId) return { code: 404, message: "The sign-in prompt is no longer open" };
    if (cancel) prompt.cancel();
    else prompt.answer(answers);
    return { success: true };
};

module.exports = { askAccount, answerPrompt };
