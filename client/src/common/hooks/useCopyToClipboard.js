import { useTranslation } from "react-i18next";
import { useToast } from "@/common/contexts";
import { copyText } from "@/common/utils/clipboard.js";

export const useCopyToClipboard = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    return async (text) => {
        try {
            await copyText(text);
            sendToast("Success", t("common.copied"));
        } catch {
            sendToast("Error", t("common.copyFailed"));
        }
    };
};
