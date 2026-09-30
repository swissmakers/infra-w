import { createPopoutChannel } from "@/common/utils/popoutChannel.js";

const channel = createPopoutChannel();

// overrideToken is set by "Login as" and sits next to the administrator's own token
export const getSessionToken = () => localStorage.getItem("overrideToken") || localStorage.getItem("sessionToken");

let ending = false;

// both the sign-out message and the closing socket call this, only the first call counts
export const endLocalSession = () => {
    if (ending) return;
    ending = true;
    channel?.postMessage({ type: "force_close" });
    if (localStorage.getItem("overrideToken")) localStorage.removeItem("overrideToken");
    else localStorage.removeItem("sessionToken");
    window.location.reload();
};
