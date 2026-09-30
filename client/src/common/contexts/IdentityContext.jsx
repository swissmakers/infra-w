import { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { getRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { UserContext, StateStreamContext, IdentityContext } from "@/common/contexts";
import { STATE_TYPES } from "@/common/hooks/useStateStream.js";

export const IdentityProvider = ({ children }) => {
    const { user, sessionToken } = useContext(UserContext);
    const { registerHandler } = useContext(StateStreamContext);
    const [identities, setIdentities] = useState(() => sessionToken ? null : []);
    const [prevSessionToken, setPrevSessionToken] = useState(sessionToken);

    if (sessionToken !== prevSessionToken) {
        setPrevSessionToken(sessionToken);
        if (!sessionToken) setIdentities([]);
    }

    useEffect(() => {
        if (user) return registerHandler(STATE_TYPES.IDENTITIES, setIdentities);
    }, [user, registerHandler]);

    const loadIdentities = useCallback(async () => {
        try {
            setIdentities(await getRequest("/identities/list"));
        } catch {}
    }, []);

    const personalIdentities = useMemo(() => identities?.filter(i => i.scope === 'personal') || [], [identities]);
    const organizationIdentities = useMemo(() => identities?.filter(i => i.scope === 'organization') || [], [identities]);
    const getOrganizationIdentities = (orgId) => organizationIdentities.filter(i => i.organizationId === orgId);

    const moveIdentityToOrganization = async (identityId, organizationId) => {
        try {
            const result = await postRequest(`/identities/${identityId}/move`, { organizationId });
            return result.identity ? { success: true, identity: result.identity } : { success: false, error: result.message };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    return (
        <IdentityContext.Provider value={{ identities, personalIdentities, organizationIdentities, loadIdentities, getOrganizationIdentities, moveIdentityToOrganization }}>
            {children}
        </IdentityContext.Provider>
    );
};