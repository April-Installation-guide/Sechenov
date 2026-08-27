import { EmbedBuilder } from 'discord.js';

const FIELD_CHAR_LIMIT = 1000; 
const MAX_FIELDS_PER_EMBED = 25; // límite
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
