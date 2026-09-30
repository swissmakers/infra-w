
export const getWebSocketUrl = (path, params = {}) => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}${path}`;
    const query = new URLSearchParams(params).toString();
    return query ? `${url}?${query}` : url;
};

export const getTabId = () => {
    let id = sessionStorage.getItem("infra-w-tab-id");
    if (!id) sessionStorage.setItem("infra-w-tab-id", id = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    return id;
};

export const getBrowserId = () => {
    let id = localStorage.getItem("infra-w-browser-id");
    if (!id) localStorage.setItem("infra-w-browser-id", id = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    return id;
};