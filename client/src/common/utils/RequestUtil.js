import i18n from "@/i18n.js";
import { getSessionToken } from "@/common/utils/sessionToken.js";

const requestError = (status, data) => Object.assign(
    new Error(data?.message || i18n.t("common.requestErrors.status", { status })), { status, code: data?.code ?? status });

export const uploadFile = async (url, file, { onProgress, timeout = 300000 } = {}) => {
    const fullUrl = url;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        if (onProgress) {
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            });
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ success: true }); }
            } else {
                let errorMsg = i18n.t("common.requestErrors.status", { status: xhr.status });
                try { errorMsg = JSON.parse(xhr.responseText).message || errorMsg; } catch {}
                reject(new Error(errorMsg));
            }
        };
        xhr.onerror = () => reject(new Error(i18n.t("common.requestErrors.network")));
        xhr.onabort = () => reject(new Error(i18n.t("common.requestErrors.cancelled")));
        xhr.ontimeout = () => reject(new Error(i18n.t("common.requestErrors.timeout")));
        xhr.timeout = timeout;

        xhr.open("POST", fullUrl, true);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.send(file);
    });
};

export const request = async (url, method, body, headers) => {
    url = url.startsWith("/") ? url.substring(1) : url;

    const fullUrl = `/api/${url}`;

    const response = await fetch(fullUrl, {
        method: method,
        headers: {...headers, "Content-Type": "application/json"},
        body: body ? JSON.stringify(body) : undefined
    });

    const rawData = await response.text();
    let data = rawData;
    try { data = rawData ? JSON.parse(rawData) : rawData; } catch {}

    if (!response.ok) throw requestError(response.status, data);

    return data;
}

export const downloadRequest = async (url) => {
    const fullUrl = url;

    const response = await fetch(fullUrl, {
        method: "GET",
        headers: {"Content-Type": "application/json"},
    });

    if (!response.ok) throw requestError(response.status);

    return response.blob();
}

export const sessionRequest = (url, method, token, body) => {
    return request(url, method, body, {"Authorization": `Bearer ${token}`});
}

export const getRequest = (url) => {
    return sessionRequest(url, "GET", getSessionToken());
}

export const postRequest = (url, body) => {
    return sessionRequest(url, "POST", getSessionToken(), body);
}

export const putRequest = (url, body) => {
    return sessionRequest(url, "PUT", getSessionToken(), body);
}

export const deleteRequest = (url) => {
    return sessionRequest(url, "DELETE", getSessionToken());
}

export const patchRequest = (url, body) => {
    return sessionRequest(url, "PATCH", getSessionToken(), body);
}

export const triggerDownload = (href, fileName = "") => {
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// header auth keeps the token out of URLs and proxy logs
export const saveDownload = async (url, fileName) => {
    const response = await fetch(`/api/${url}`, { headers: { Authorization: `Bearer ${getSessionToken()}` } });
    if (!response.ok) throw requestError(response.status, await response.json().catch(() => null));
    const href = URL.createObjectURL(await response.blob());
    triggerDownload(href, fileName);
    setTimeout(() => URL.revokeObjectURL(href), 60000);
};

// the browser fetches these itself, so the token has to go in the query
export const downloadFile = (url) => {
    url = url.startsWith("/") ? url.substring(1) : url;
    const separator = url.includes("?") ? "&" : "?";
    triggerDownload(`/api/${url}${separator}token=${encodeURIComponent(getSessionToken())}`);
};

export const sftpUrl = (sessionId, { action = "", path, preview = false } = {}) => {
    const params = new URLSearchParams({ sessionId, sessionToken: getSessionToken() });
    if (path !== undefined) params.set("path", path);
    if (preview) params.set("preview", "true");
    return `/api/entries/sftp${action}?${params}`;
};

export const getRawRequest = async (url) => {
    url = url.startsWith("/") ? url.substring(1) : url;
    const fullUrl = `/api/${url}`;

    const response = await fetch(fullUrl, {
        method: "GET",
        headers: { "Authorization": `Bearer ${getSessionToken()}` },
    });

    if (!response.ok) throw requestError(response.status);

    return response;
}