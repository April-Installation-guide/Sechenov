import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'antinuke.json');

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

function defaultConfig() {
    return { enabled: false, logChannelId: null, whitelist: [] };
}

export function getConfig(guildId) {
    const all = readAll();
    return all[guildId] || defaultConfig();
}

export function setConfig(guildId, patch) {
    const all = readAll();
    all[guildId] = { ...defaultConfig(), ...(all[guildId] || {}), ...patch };
    writeAll(all);
    return all[guildId];
}

export function addToWhitelist(guildId, userId) {
    const cfg = getConfig(guildId);
    if (!cfg.whitelist.includes(userId)) cfg.whitelist.push(userId);
    setConfig(guildId, cfg);
}

export function removeFromWhitelist(guildId, userId) {
    const cfg = getConfig(guildId);
    cfg.whitelist = cfg.whitelist.filter((id) => id !== userId);
    setConfig(guildId, cfg);
}
