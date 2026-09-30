import { useCallback, useEffect, useState } from "react";
import LoginDialog from "@/common/components/LoginDialog";
import { getRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast, UserContext } from "@/common/contexts";
import { getSessionToken } from "@/common/utils/sessionToken.js";

export const UserProvider = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const [sessionToken, setSessionToken] = useState(getSessionToken);
    const [firstTimeSetup, setFirstTimeSetup] = useState(false);
    const [user, setUser] = useState(null);
    const {sendToast} = useToast();
    const [handledLocation, setHandledLocation] = useState(null);

    // the SSO callback lands with ?token=
    if (location !== handledLocation) {
        setHandledLocation(location);
        const tokenFromUrl = new URLSearchParams(location.search).get("token");
        if (tokenFromUrl) setSessionToken(tokenFromUrl);
    }

    const checkFirstTimeSetup = useCallback(() => getRequest("service/is-fts")
        .then(setFirstTimeSetup)
        .catch(error => console.error(error)), []);

    const login = useCallback(() => getRequest("accounts/me")
        .then(setUser)
        .catch(error => {
            if (error.status !== 401) return;
            setUser(null);
            if (localStorage.getItem("overrideToken")) {
                localStorage.removeItem("overrideToken");
                setSessionToken(localStorage.getItem("sessionToken"));
                return;
            }
            setSessionToken(null);
            localStorage.removeItem("sessionToken");
            checkFirstTimeSetup();
        }), [checkFirstTimeSetup]);

    const updateSessionToken = (sessionToken) => {
        localStorage.setItem("sessionToken", sessionToken);
        setSessionToken(sessionToken);
    };

    const logout = async () => {
        await postRequest("auth/logout", { token: sessionToken });

        if (localStorage.getItem("overrideToken")) {
            localStorage.removeItem("overrideToken");
        }

        window.location.reload();
    };

    const overrideToken = (token) => {
        localStorage.setItem("overrideToken", token);
        setSessionToken(token);
    };

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tokenFromUrl = searchParams.get('token');
        const error = searchParams.get('error');

        if (tokenFromUrl) {
            localStorage.setItem("sessionToken", tokenFromUrl);
            navigate('/servers', { replace: true });
        } else if (error) {
            sendToast("Error", error);
        }
    }, [location, navigate, sendToast]);

    useEffect(() => {
        sessionToken ? login() : checkFirstTimeSetup();
    }, [sessionToken, login, checkFirstTimeSetup]);

    return (
        <UserContext.Provider value={{ updateSessionToken, user, sessionToken, firstTimeSetup, login, logout, overrideToken }}>
            <LoginDialog open={!sessionToken} />
            {children}
        </UserContext.Provider>
    );
};
