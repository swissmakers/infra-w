import { useCallback, useContext, useEffect, useState } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { OrganizationContext, UserContext } from "@/common/contexts";

export const OrganizationProvider = ({ children }) => {
    const { user } = useContext(UserContext);
    const [organizations, setOrganizations] = useState([]);
    const [prevUser, setPrevUser] = useState(user);

    if (user !== prevUser) {
        setPrevUser(user);
        if (!user) setOrganizations([]);
    }

    const loadOrganizations = useCallback(() => getRequest("organizations")
        .then(result => setOrganizations(Array.isArray(result) ? result : []))
        .catch(error => console.error("Failed to load organizations", error.message)), []);

    useEffect(() => {
        if (user?.id) loadOrganizations();
    }, [user?.id, loadOrganizations]);

    return <OrganizationContext.Provider value={{ organizations, loadOrganizations }}>{children}</OrganizationContext.Provider>;
};
