import { useEffect, useState } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";

let serverVersion = null;

export const useServerVersion = () => {
    const [version, setVersion] = useState(serverVersion);
    useEffect(() => {
        if (serverVersion) return;
        getRequest("service/version").then(result => {
            serverVersion = result.version;
            setVersion(result.version);
        }).catch(() => {});
    }, []);
    return version;
};
