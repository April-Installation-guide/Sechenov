// utils/appealsStore.js
// Almacenamiento simple en JSON para el estado de apelaciones de /bancomer.
// Persiste entre reinicios del bot (no es una base de datos real, pero
// es suficiente para este caso de uso).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'appeals.json');

function ensureFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, '{}', 'utf8');
}

function readAll() {
    ensureFile();
    try {
        return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function writeAll(data) {
    ensureFile();
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function getAppeal(userId) {
    const all = readAll();
    return all[userId] || null;
}

export function setAppeal(userId, patch) {
    const all = readAll();
    all[userId] = { ...(all[userId] || {}), ...patch };
    writeAll(all);
    return all[userId];
}

export function isBlocked(userId) {
    return getAppeal(userId)?.status === 'blocked';
}