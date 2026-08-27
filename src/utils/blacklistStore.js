// utils/blacklistStore.js
// Almacenamiento simple en JSON para la lista de baneados (#blacklist)
// y el ID del mensaje que se edita cada vez que hay un cambio.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'blacklist.json');

function ensureFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(FILE_PATH)) {
        fs.writeFileSync(FILE_PATH, JSON.stringify({ messageId: null, entries: [] }, null, 2), 'utf8');
    }
}

function readData() {
    ensureFile();
    try {
        return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    } catch {
        return { messageId: null, entries: [] };
    }
}

function writeData(data) {
    ensureFile();
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function getMessageId() {
    return readData().messageId;
}

export function setMessageId(id) {
    const data = readData();
    data.messageId = id;
    writeData(data);
}

export function getEntries() {
    return readData().entries;
}

// Agrega un baneado. Si ya existía (re-baneado), actualiza su entrada.
export function addEntry({ userId, tag, reason, date }) {
    const data = readData();
    const filtered = data.entries.filter((e) => e.userId !== userId);
    filtered.unshift({ userId, tag, reason, date });
    data.entries = filtered;
    writeData(data);
}

// Quita a alguien de la lista (al desbanearlo).
export function removeEntry(userId) {
    const data = readData();
    data.entries = data.entries.filter((e) => e.userId !== userId);
    writeData(data);
}