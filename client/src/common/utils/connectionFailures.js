const reported = new Set();

export const markConnectionFailure = (sessionId) => {
    reported.add(sessionId);
    setTimeout(() => reported.delete(sessionId), 60000);
};

export const isConnectionFailureReported = (sessionId) => reported.has(sessionId);
