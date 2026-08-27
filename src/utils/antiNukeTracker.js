// utils/antiNukeTracker.js
// Ventana deslizante en memoria: cuenta acciones destructivas por
// usuario+servidor en los últimos N segundos, para detectar patrones
// de nukeo (varias acciones idénticas en muy poco tiempo).

const WINDOW_MS = 10_000; // 10 segundos
const THRESHOLD = 3; // 3 acciones del mismo tipo en la ventana = trigger

// Map<`${guildId}:${userId}:${actionType}`, number[]> (timestamps)
const actionLog = new Map();

export function registerAction(guildId, userId, actionType) {
    const key = `${guildId}:${userId}:${actionType}`;
    const now = Date.now();

    const timestamps = (actionLog.get(key) || []).filter((t) => now - t < WINDOW_MS);
    timestamps.push(now);
    actionLog.set(key, timestamps);

    if (timestamps.length >= THRESHOLD) {
        actionLog.delete(key); // evita re-disparar inmediatamente tras la cuarentena
        return true;
    }
    return false;
}