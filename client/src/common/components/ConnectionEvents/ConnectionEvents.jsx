import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { mdiFormTextbox, mdiLockOutline } from "@mdi/js";
import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import Button from "@/common/components/Button";
import { StateStreamContext, useToast } from "@/common/contexts";
import { EVENT_TYPES } from "@/common/hooks/useStateStream.js";
import { postRequest } from "@/common/utils/RequestUtil.js";
import { markConnectionFailure } from "@/common/utils/connectionFailures.js";
import "./styles.sass";

export const ConnectionEvents = () => {
    const { t } = useTranslation();
    const { registerHandler } = useContext(StateStreamContext);
    const { sendToast, showError } = useToast();
    const [prompts, setPrompts] = useState([]);
    const [answers, setAnswers] = useState({ id: null, values: [] });
    const current = prompts[0];

    if (current && answers.id !== current.id) setAnswers({ id: current.id, values: current.prompts.map(() => "") });

    useEffect(() => {
        const unregister = [
            registerHandler(EVENT_TYPES.CONNECTION_FAILED, ({ sessionId, serverName, message }) => {
                markConnectionFailure(sessionId);
                sendToast("Error", t("servers.messages.connectionFailedReason", { name: serverName, message, interpolation: { escapeValue: false } }));
            }),
            registerHandler(EVENT_TYPES.CONNECTION_PROMPT, prompt => setPrompts(prev => [...prev, prompt])),
            registerHandler(EVENT_TYPES.CONNECTION_PROMPT_DONE, ({ id }) => setPrompts(prev => prev.filter(prompt => prompt.id !== id))),
        ];
        return () => unregister.forEach(off => off());
    }, [registerHandler, sendToast, t]);

    const respond = (body) => {
        const { id } = current;
        setPrompts(prev => prev.filter(prompt => prompt.id !== id));
        postRequest(`connections/prompts/${id}`, body).catch(error => error.status !== 404 && showError(error));
    };

    const submit = (event) => {
        event.preventDefault();
        respond({ answers: answers.values });
    };

    return <DialogProvider open={Boolean(current)} onClose={() => respond({ cancel: true })}>
        {current && <form className="connection-prompt" onSubmit={submit}>
            <h2>{t("servers.signInPrompt.title", { name: current.title })}</h2>
            {current.instructions && <p className="connection-prompt-instructions">{current.instructions}</p>}
            {current.prompts.map((prompt, index) => <div className="form-group" key={index}>
                <label htmlFor={`connection-prompt-${index}`}>{prompt.prompt.replace(/:\s*$/, "")}</label>
                <IconInput id={`connection-prompt-${index}`} icon={prompt.echo ? mdiFormTextbox : mdiLockOutline} type={prompt.echo ? "text" : "password"}
                    autoComplete="one-time-code" autoFocus={index === 0} value={answers.values[index] ?? ""}
                    setValue={value => setAnswers(prev => ({ ...prev, values: prev.values.map((old, position) => position === index ? value : old) }))} />
            </div>)}
            <div className="connection-prompt-actions">
                <Button type="secondary" buttonType="button" text={t("common.actions.cancel")} onClick={() => respond({ cancel: true })} />
                <Button buttonType="submit" text={t("servers.signInPrompt.continue")} />
            </div>
        </form>}
    </DialogProvider>;
};

export default ConnectionEvents;
