const pending = new Map();

export function createPending(data) {
    const id = `${data.userId}_${Date.now()}`;
    pending.set(id, data);
    setTimeout(() => pending.delete(id), 10 * 60 * 1000);
    return id;
}

export function takePending(id) {
    const data = pending.get(id);
    pending.delete(id);
    return data || null;
}
