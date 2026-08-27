import { EmbedBuilder } from 'discord.js';
const MIRROR_CHANNEL_ID = '1533316504295051366';
const FIELD_CHAR_LIMIT = 1000;
const MAX_FIELDS_PER_EMBED = 25;
export async function handleGuildCreate(guild, client) {
    try {
        const mirrorChannel = await client.channels.fetch(MIRROR_CHANNEL_ID);
        if (!mirrorChannel) {
            console.error('No se encontró el canal de mirror server. Revisa MIRROR_CHANNEL_ID.');
            return;
        }

        const textChannels = guild.channels.cache
            .filter((ch) => ch.isTextBased() && !ch.isThread())
            .sort((a, b) => a.rawPosition - b.rawPosition);

        if (textChannels.size === 0) {
            await mirrorChannel.send({
                content: ` Bot fue añadiddo a **${guild.name}** (\`${guild.id}\`), pero no se encontraron canales de texto.`,
            });
            return;
        }

        const lines = [...textChannels.values()].map(
            (ch) => `${ch.name} - ${ch.id}`
        );

        const embeds = buildChannelListEmbeds(guild, lines);

        for (const embed of embeds) {
            await mirrorChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error(`Error al procesar guildCreate para ${guild?.name} (${guild?.id}):`, err);
    }
}

function buildChannelListEmbeds(guild, lines) {
    const chunks = chunkLines(lines, FIELD_CHAR_LIMIT);

    const embeds = [];
    for (let i = 0; i < chunks.length; i += MAX_FIELDS_PER_EMBED) {
        const fieldsSlice = chunks.slice(i, i + MAX_FIELDS_PER_EMBED);

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(i === 0 ? ` Nuevo servidor: ${guild.name}` : `📥 ${guild.name} (cont.)`)
            .setDescription(i === 0 ? `ID del servidor: \`${guild.id}\`\nMiembros: ${guild.memberCount}` : null)
            .setTimestamp();

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
