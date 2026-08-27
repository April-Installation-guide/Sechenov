import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'staffChannels.json');

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

export function setStaffChannel(guildId, channelId) {
    const all = readAll();
    all[guildId] = channelId;
    writeAll(all);
}

export function getStaffChannel(guildId) {
    return readAll()[guildId] || null;
}

export function getAllStaffChannels() {
    const all = readAll();
    return Object.entries(all).map(([guildId, channelId]) => ({ guildId, channelId }));
}

export function removeStaffChannel(guildId) {
    const all = readAll();
    delete all[guildId];
    writeAll(all);
}
