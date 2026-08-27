// commands/bancomer.js
// Comando /bancomer: banea a un usuario (por ID) en TODOS los servidores
// donde el bot esté presente y tenga permiso.
// Restringido a ACD y a usuarios con permiso de "Banear miembros" ahí.

import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';
import { setAppeal } from '../utils/appealsStore.js';
import { addEntry } from '../utils/blacklistStore.js';
import { updateBlacklistMessage } from '../utils/blacklistMessage.js';
import { getAllStaffChannels } from '../utils/staffChannelsStore.js';

export const HOME_GUILD_ID = '1529898873097687201'; // ACD
const BANCOMER_LOG_CHANNEL_ID = '1533595104575750356';

export const data = new SlashCommandBuilder()
    .setName('bancomer')
    .setDescription('Banea a un usuario en TODOS los servidores donde el bot esté presente.')
    .addStringOption((opt) =>
        opt.setName('user_id').setDescription('ID del usuario a banear').setRequired(true)
    )
    .addStringOption((opt) =>
        opt.setName('razon').setDescription('Razón del baneo (se registrará en el log)').setRequired(false)
    )
    .addAttachmentOption((opt) => opt.setName('evidencia1').setDescription('Evidencia del baneo (imagen/archivo)').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('evidencia2').setDescription('Evidencia del baneo (imagen/archivo)').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('evidencia3').setDescription('Evidencia del baneo (imagen/archivo)').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('evidencia4').setDescription('Evidencia del baneo (imagen/archivo)').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('evidencia5').setDescription('Evidencia del baneo (imagen/archivo)').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('evidencia6').setDescription('Evidencia del baneo (imagen/archivo)').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('evidencia7').setDescription('Evidencia del baneo (imagen/archivo)').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('evidencia8').setDescription('Evidencia del baneo (imagen/archivo)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction, client) {
    if (interaction.guildId !== HOME_GUILD_ID) {
        await interaction.reply({ content: '⛔ Este comando solo se puede usar en nuestro servidor.', ephemeral: true });
        return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        await interaction.reply({
            content: '⛔ Necesitas el permiso de "Banear miembros" en este servidor para usar este comando.',
            ephemeral: true,
        });
        return;
    }

    const userId = interaction.options.getString('user_id', true).trim();
    const reason = interaction.options.getString('razon') || 'No especificada';

    const attachments = [];
    for (let i = 1; i <= 8; i++) {
        const att = interaction.options.getAttachment(`evidencia${i}`);
        if (att) attachments.push(att);
    }

    if (!/^\d{17,20}$/.test(userId)) {
        await interaction.reply({ content: '⛔ Eso no parece un ID de usuario válido.', ephemeral: true });
        return;
    }

    let targetUser;
    try {
        targetUser = await client.users.fetch(userId);
    } catch {
        await interaction.reply({ content: '⛔ No se pudo encontrar un usuario con ese ID.', ephemeral: true });
        return;
    }

    // --- Confirmación explícita con botones ---
    const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bancomer_confirm').setLabel('Confirmar baneo masivo').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('bancomer_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
    );

    const totalGuilds = client.guilds.cache.size;

    const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirmar baneo masivo')
        .setDescription(
            `Estás a punto de banear a **${targetUser.tag}** (\`${targetUser.id}\`) ` +
            `en hasta **${totalGuilds}** servidor(es) donde el bot esté presente y tenga permiso.\n\n` +
            `**Razón:** ${reason}\n` +
            `**Adjuntos:** ${attachments.length}\n\n` +
            `Esta acción es **irreversible** vía este bot. ¿Confirmas?`
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(0xED4245);

    const confirmMsg = await interaction.reply({
        embeds: [confirmEmbed],
        components: [confirmRow],
        ephemeral: true,
        fetchReply: true,
    });

    let buttonInteraction;
    try {
        buttonInteraction = await confirmMsg.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 30_000,
        });
    } catch {
        await interaction.editReply({ content: '⌛ Tiempo agotado. Baneo cancelado.', embeds: [], components: [] });
        return;
    }

    if (buttonInteraction.customId === 'bancomer_cancel') {
        await buttonInteraction.update({ content: '❌ Baneo cancelado.', embeds: [], components: [] });
        return;
    }

    await buttonInteraction.update({ content: '⏳ Ejecutando baneo en todos los servidores...', embeds: [], components: [] });

    // --- DM al usuario ANTES de banearlo ---
    // Se manda primero porque, una vez baneado de todos los servidores
    // que comparte con el bot, es probable que el DM ya no se pueda enviar.
    let dmSent = false;
    try {
        const dmEmbed = new EmbedBuilder()
            .setTitle('Has sido baneado')
            .setDescription(
                `Vas a ser baneado de hasta **${totalGuilds}** servidor(es) donde este bot tiene presencia.`
            )
            .addFields({ name: 'Razón', value: reason })
            .setColor(0xED4245)
            .setTimestamp();

        const dmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`bancomer_apelar:${targetUser.id}`).setLabel('Apelar').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`bancomer_cerrar:${targetUser.id}`).setLabel('Cerrar').setStyle(ButtonStyle.Secondary)
        );

        await targetUser.send({ embeds: [dmEmbed], components: [dmRow] });
        dmSent = true;

        // Guarda contexto para cuando el usuario apele (puede ser mucho después).
        setAppeal(targetUser.id, {
            status: 'none',
            banReason: reason,
            bannedBy: interaction.user.tag,
        });
    } catch {
        dmSent = false;
    }

    // --- Ejecutar el baneo en cada servidor ---
    const results = [];

    for (const guild of client.guilds.cache.values()) {
        try {
            const me = await guild.members.fetchMe();

            if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
                results.push({ guild, ok: false, detail: 'Sin permiso de banear' });
                continue;
            }

            const alreadyBanned = await guild.bans.fetch(userId).catch(() => null);
            if (alreadyBanned) {
                results.push({ guild, ok: true, detail: 'Ya estaba baneado' });
                continue;
            }

            await guild.bans.create(userId, {
                reason: `${reason} — ejecutado por ${interaction.user.tag} vía /bancomer`,
            });
            results.push({ guild, ok: true, detail: 'Baneado' });
        } catch (err) {
            results.push({ guild, ok: false, detail: err.message || 'Error desconocido' });
        }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.length - successCount;

    await interaction.editReply({
        content: `✅ Proceso terminado: **${successCount}** servidor(es) exitoso(s), **${failCount}** con error. Revisa el log para el detalle.` +
            (dmSent ? '' : '\n⚠️ No se pudo enviar el DM al usuario (tiene los DMs cerrados o no comparte servidor con el bot).'),
    });

    // --- Log minimalista en el canal dedicado ---
    if (BANCOMER_LOG_CHANNEL_ID) {
        try {
            const logChannel = await client.channels.fetch(BANCOMER_LOG_CHANNEL_ID);

            const causeCounts = new Map();
            for (const r of results) {
                causeCounts.set(r.detail, (causeCounts.get(r.detail) || 0) + 1);
            }
            const causesText = [...causeCounts.entries()]
                .map(([cause, count]) => `• ${cause}: **${count}**`)
                .join('\n') || 'Sin servidores.';

            const logEmbed = new EmbedBuilder()
                .setTitle('🔨 /bancomer')
                .addFields(
                    { name: 'Ejecutado por', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Usuario baneado', value: `${targetUser.tag}`, inline: true },
                    { name: 'DM enviado', value: dmSent ? 'Sí' : 'No', inline: true },
                    { name: 'Razón', value: reason },
                    { name: 'Servidores', value: `${successCount}/${results.length} baneados exitosamente` },
                    { name: 'Causas', value: causesText },
                )
                .setColor(failCount === 0 ? 0x57F287 : 0xFEE75C)
                .setTimestamp();

            await logChannel.send({
                embeds: [logEmbed],
                files: attachments.map((a) => a.url),
            });
        } catch (err) {
            console.error('Error enviando log de /bancomer:', err);
        }
    }

    // --- Actualiza el mensaje fijo de #blacklist ---
    if (successCount > 0) {
        addEntry({
            userId: targetUser.id,
            tag: targetUser.tag,
            reason,
            date: Date.now(),
        });
        await updateBlacklistMessage(client);
    }

    // --- Notifica a los canales de staff de cada servidor ---
    const staffChannels = getAllStaffChannels();
    if (staffChannels.length > 0) {
        const staffEmbed = new EmbedBuilder()
            .setTitle('🔨 Notificación de baneo')
            .addFields(
                { name: 'Usuario baneado', value: `${targetUser.tag} (\`${targetUser.id}\`)` },
                { name: 'Razón', value: reason },
                { name: 'Ejecutado por', value: interaction.user.tag },
            )
            .setColor(0xED4245)
            .setTimestamp();

        for (const { channelId } of staffChannels) {
            try {
                const ch = await client.channels.fetch(channelId);
                await ch.send({
                    embeds: [staffEmbed],
                    files: attachments.map((a) => a.url),
                });
            } catch (err) {
                console.error(`Error notificando canal de staff ${channelId}:`, err);
            }
        }
    }
}