const WINDOW_MS = 10_000; 
const THRESHOLD = 3; 

const actionLog = new Map();

export function registerAction(guildId, userId, actionType) {
    const key = `${guildId}:${userId}:${actionType}`;
    const now = Date.now();

    const timestamps = (actionLog.get(key) || []).filter((t) => now - t < WINDOW_MS);
    timestamps.push(now);
    actionLog.set(key, timestamps);

    if (timestamps.length >= THRESHOLD) {
        actionLog.delete(key);
        return true;
    }
    return false;
}
