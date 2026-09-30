// each module opens its own instance, so a window also receives what its other modules post
export const createPopoutChannel = () =>
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("infra-w-popout") : null;
