// utils/guildChannelsEmbed.js
// Utilidad compartida para construir embeds con la lista de canales
// (nombre + ID) de un servidor. La usan tanto guildCreate.js (mirror
// server automático) como el comando /showme (selector manual).

import { EmbedBuilder } from 'discord.js';

const FIELD_CHAR_LIMIT = 1000; // margen bajo el límite real de 1024 de Discord
const MAX_FIELDS_PER_EMBED = 25; // límite real de Discord

/**
 * Construye uno o más embeds con la lista de canales de texto de un
 * servidor, respetando los límites de Discord (25 campos por embed,
 * ~1024 caracteres por campo). Si el servidor tiene muchísimos
 * canales, devuelve varios embeds en orden.
 *
 * @param {import('discord.js').Guild} guild
 * @returns {import('discord.js').EmbedBuilder[]}
 */
export function buildChannelListEmbeds(guild) {
    const textChannels = guild.channels.cache
        .filter((ch) => ch.isTextBased() && !ch.isThread())
        .sort((a, b) => a.rawPosition - b.rawPosition);

    if (textChannels.size === 0) {
        return [
            new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(guild.name)
                .setDescription(`ID del servidor: \`${guild.id}\`\n\nEste servidor no tiene canales de texto visibles para el bot.`)
                .setTimestamp(),
        ];
    }

    const lines = [...textChannels.values()].map((ch) => `${ch.name} - ${ch.id}`);
    const chunks = chunkLines(lines, FIELD_CHAR_LIMIT);

    const embeds = [];
    for (let i = 0; i < chunks.length; i += MAX_FIELDS_PER_EMBED) {
        const fieldsSlice = chunks.slice(i, i + MAX_FIELDS_PER_EMBED);
        const isFirstEmbed = i === 0;

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(isFirstEmbed ? `📋 ${guild.name}` : `📋 ${guild.name} (cont.)`)
            .setTimestamp();

        if (isFirstEmbed) {
            embed.setDescription(`ID del servidor: \`${guild.id}\`\nMiembros: ${guild.memberCount}`);
        }

        fieldsSlice.forEach((chunkText, idx) => {
            embed.addFields({
                name: chunks.length > 1 ? `Canales (parte ${i / MAX_FIELDS_PER_EMBED + idx + 1})` : 'Canales',
                value: chunkText,
            });
        });

        embeds.push(embed);
    }

    return embeds;
}

/**
 * Agrupa líneas de texto en bloques que no superen el límite de
 * caracteres por campo de embed.
 */
function chunkLines(lines, charLimit) {
    const chunks = [];
    let current = '';

    for (const line of lines) {
        const withNewline = line + '\n';
        if ((current + withNewline).length > charLimit) {
            if (current) chunks.push(current);
            current = withNewline;
        } else {
            current += withNewline;
        }
    }
    if (current) chunks.push(current);

    return chunks;
}