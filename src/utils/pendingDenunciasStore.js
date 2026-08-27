// utils/pendingDenunciasStore.js
// Almacenamiento temporal en memoria para pasar datos (adjuntos, canal
// de origen) entre el comando /enviar denuncia y el modal de texto,
// ya que un modal no puede llevar archivos adjuntos directamente.

const pending = new Map();

export function createPending(data) {
    const id = `${data.userId}_${Date.now()}`;
    pending.set(id, data);
    // Auto-limpieza: si el usuario nunca completa el modal, se borra en 10 min.
    setTimeout(() => pending.delete(id), 10 * 60 * 1000);
    return id;
}

export function takePending(id) {
    const data = pending.get(id);
    pending.delete(id);
    return data || null;
}