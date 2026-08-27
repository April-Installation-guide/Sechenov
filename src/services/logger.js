
const FLUSH_INTERVAL_MS = 3000;
const DISCORD_MAX_MESSAGE_LENGTH = 2000;
const CHUNK_SOFT_LIMIT = 1800; // margen de seguridad bajo el límite de Discord
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const GUILDS_CONFIG = [

        guildId: '1533219731904135369',
        logChannelId: '1533220067582672937',
        watchedChannels: [], // la CIA
    },
    {
        guildId: '1527701416699891742',
        logChannelId: '1533181704984854758',
        watchedChannels: [], // Oddity
    },
     {
        guildId: '1533319534428160121',
        logChannelId: '1533320403085168712',
        watchedChannels: ['1533319535556427841'], // Prueba server
    },
];
// =============================================================

let clientRef = null;
let intervalHandle = null;
let isFlushing = false;

const guildConfigs = new Map();

const logBuffers = new Map();

export function initLogger(client, guildsOverride = null) {
    clientRef = client;

    const guilds = guildsOverride || GUILDS_CONFIG;
    for (const g of guilds) {
        setGuildConfig(g.guildId, {
            logChannelId: g.logChannelId,
            watchedChannels: g.watchedChannels || [],
        });
    }

    if (intervalHandle) {
        return; 
    }

    intervalHandle = setInterval(() => {
        flushLogs().catch((err) => {
            console.error('Error inesperado en flushLogs:', err);
        });
    }, FLUSH_INTERVAL_MS);
}


export function setGuildConfig(guildId, { logChannelId, watchedChannels = [] }) {
    guildConfigs.set(guildId, {
        logChannelId,
        watchedChannelIds: new Set(watchedChannels),
    });
}

export function removeGuildConfig(guildId) {
    guildConfigs.delete(guildId);
    logBuffers.delete(guildId);
}

export async function shutdownLogger() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
    await flushLogs();
}

function isChannelWatched(guildConfig, channelId) {
    if (guildConfig.watchedChannelIds.size === 0) return true; 
    return guildConfig.watchedChannelIds.has(channelId);
}

export function queueLog(message) {
    const guildId = message.guild?.id;
    if (!guildId) return; 

    const config = guildConfigs.get(guildId);
    if (!config || !config.logChannelId) return; 
    if (!isChannelWatched(config, message.channel.id)) return;

    const time = new Date(message.createdTimestamp).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const channelTag = `<#${message.channel.id}>`;
    const userTag = `<@${message.author.id}>`;

    let text = message.content ? ` ${message.content}` : '';

    if (message.attachments.size > 0) {
        const attachmentLines = [...message.attachments.values()]
            .map((att) => formatAttachmentLine(att))
            .join('\n');
        text = text ? `${text}\n${attachmentLines}` : attachmentLines;
    }

    const line = `**[${time}]** ${channelTag} | ${userTag}:\n${text}`;

    if (!logBuffers.has(guildId)) logBuffers.set(guildId, []);
    logBuffers.get(guildId).push(...splitOversizedLine(line));
}


function formatAttachmentLine(att) {
    if (att.spoiler) {
        const displayName = att.name.replace(/^SPOILER_/i, '');
        return ` ||[Spoiler: ${displayName}](${att.url})||`;
    }
    return ` [${att.name}](${att.url})`;
}


function splitOversizedLine(line) {
    if (line.length <= CHUNK_SOFT_LIMIT) return [line];

    const parts = [];
    let remaining = line;
    while (remaining.length > CHUNK_SOFT_LIMIT) {
        parts.push(remaining.slice(0, CHUNK_SOFT_LIMIT) + ' …(cont.)');
        remaining = remaining.slice(CHUNK_SOFT_LIMIT);
    }
    if (remaining.length > 0) parts.push(remaining);
    return parts;
}


async function flushLogs() {
    if (isFlushing) return; 
    if (!clientRef) return;

    const guildIdsWithLogs = [...logBuffers.entries()]
        .filter(([, lines]) => lines.length > 0)
        .map(([guildId]) => guildId);

    if (guildIdsWithLogs.length === 0) return;

    isFlushing = true;
    try {
        for (const guildId of guildIdsWithLogs) {
            await flushGuild(guildId);
        }
    } finally {
        isFlushing = false;
    }
}

async function flushGuild(guildId) {
    const config = guildConfigs.get(guildId);
    const lines = logBuffers.get(guildId);
    if (!config || !lines || lines.length === 0) return;

    try {
        const logChannel = await clientRef.channels.fetch(config.logChannelId);
        if (!logChannel) {
            console.error(`Canal de logs no encontrado para el servidor ${guildId}.`);
            return;
        }

        const chunks = buildChunks(lines);
        logBuffers.set(guildId, []); 

        for (const chunk of chunks) {
            const sent = await sendWithRetry(logChannel, chunk.text);
            if (!sent) {
                logBuffers.get(guildId).unshift(...chunk.lines);
            }
        }
    } catch (err) {
        console.error(`Error enviando lote de logs del servidor ${guildId}:`, err);
    }
}


function buildChunks(lines) {
    const chunks = [];
    let currentText = '';
    let currentLines = [];

    for (const rawLine of lines) {
        const line = rawLine + '\n\n';

        if (currentText.length > 0 && (currentText + line).length > CHUNK_SOFT_LIMIT) {
            chunks.push({ text: currentText, lines: currentLines });
            currentText = '';
            currentLines = [];
        }

        currentText += line;
        currentLines.push(rawLine);
    }

    if (currentText.trim().length > 0) {
        chunks.push({ text: currentText, lines: currentLines });
    }

    return chunks;
}


async function sendWithRetry(channel, text) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await channel.send({
                content: text.slice(0, DISCORD_MAX_MESSAGE_LENGTH),
                allowedMentions: { parse: [] },
            });
            return true;
        } catch (err) {
            console.error(`Intento ${attempt}/${MAX_RETRIES} fallido al enviar log:`, err.message);
            if (attempt < MAX_RETRIES) {
                await sleep(RETRY_BASE_DELAY_MS * attempt);
            }
        }
    }
    return false;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
