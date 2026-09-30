import { useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { IdentityContext } from "@/common/contexts";

export const useIdentityName = () => {
    const { identities } = useContext(IdentityContext);
    const { t } = useTranslation();
    return useCallback(id => identities?.find(identity => identity.id === id)?.name ?? t("servers.contextMenu.unknownIdentity", { id }),
        [identities, t]);
};
