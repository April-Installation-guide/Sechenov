// utils/blacklistMessage.js
// Mantiene un único mensaje fijo en #blacklist, actualizándolo cada
// vez que alguien es baneado o desbaneado vía /bancomer y /desbanear.

import { EmbedBuilder } from 'discord.js';
import { getEntries, getMessageId, setMessageId } from './blacklistStore.js';

const BLACKLIST_CHANNEL_ID = '1533652817732960416';

function formatDate(date) {
    return new Date(date).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildEmbed() {
    const entries = getEntries();

    let description;
    if (entries.length === 0) {
        description = `nadie - ${formatDate(new Date())}`;
    } else {
        description = entries
            .map((e) => `**${e.tag}** (\`${e.userId}\`) — ${formatDate(e.date)}\n> ${e.reason}`)
            .join('\n\n');
    }

    return new EmbedBuilder()
        .setTitle('📋 Blacklist')
        .setDescription(description)
        .setColor(0x2B2D31)
        .setFooter({ text: `${entries.length} usuario(s) en la lista` })
        .setTimestamp();
}

export async function updateBlacklistMessage(client) {
    try {
        const channel = await client.channels.fetch(BLACKLIST_CHANNEL_ID);
        const embed = buildEmbed();
        const existingId = getMessageId();

        if (existingId) {
            try {
                const msg = await channel.messages.fetch(existingId);
                await msg.edit({ embeds: [embed] });
                return;
            } catch {
                // El mensaje fue borrado o no se encontró — creamos uno nuevo.
            }
        }

        const newMsg = await channel.send({ embeds: [embed] });
        setMessageId(newMsg.id);
    } catch (err) {
        console.error('Error actualizando mensaje de blacklist:', err);
    }
}