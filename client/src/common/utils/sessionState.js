export const upsertSession = (sessions, session) => sessions.some(item => item.id === session.id)
    ? sessions.map(item => item.id === session.id ? { ...item, ...session } : item)
    : [...sessions, session];
