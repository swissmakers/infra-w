// navigator.clipboard only exists on HTTPS and localhost
export const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.cssText = "position:fixed;left:-9999px;top:-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw error;
    }
};
