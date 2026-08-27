// commands/desbanear.js
// Comando /desbanear: desbanea a un usuario (por ID) en TODOS los
// servidores donde el bot esté presente y tenga permiso.
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
import { removeEntry } from '../utils/blacklistStore.js';
import { updateBlacklistMessage } from '../utils/blacklistMessage.js';
import { HOME_GUILD_ID } from './bancomer.js';

const BANCOMER_LOG_CHANNEL_ID = '1533595104575750356';

export const data = new SlashCommandBuilder()
    .setName('desbanear')
    .setDescription('Desbanea a un usuario en TODOS los servidores donde el bot esté presente.')
    .addStringOption((opt) =>
        opt.setName('user_id').setDescription('ID del usuario a desbanear').setRequired(true)
    )
    .addStringOption((opt) =>
        opt.setName('razon').setDescription('Razón del desbaneo (se registrará en el log)').setRequired(false)
    )
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
        new ButtonBuilder().setCustomId('desbanear_confirm').setLabel('Confirmar desbaneo masivo').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('desbanear_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
    );

    const totalGuilds = client.guilds.cache.size;

    const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirmar desbaneo masivo')
        .setDescription(
            `Estás a punto de desbanear a **${targetUser.tag}** (\`${targetUser.id}\`) ` +
            `en hasta **${totalGuilds}** servidor(es) donde el bot esté presente y tenga permiso.\n\n` +
            `**Razón:** ${reason}\n\n¿Confirmas?`
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(0x57F287);

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
        await interaction.editReply({ content: '⌛ Tiempo agotado. Desbaneo cancelado.', embeds: [], components: [] });
        return;
    }

    if (buttonInteraction.customId === 'desbanear_cancel') {
        await buttonInteraction.update({ content: '❌ Desbaneo cancelado.', embeds: [], components: [] });
        return;
    }

    await buttonInteraction.update({ content: '⏳ Ejecutando desbaneo en todos los servidores...', embeds: [], components: [] });

    // --- Ejecutar el desbaneo en cada servidor ---
    const results = [];

    for (const guild of client.guilds.cache.values()) {
        try {
            const me = await guild.members.fetchMe();

            if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
                results.push({ guild, ok: false, detail: 'Sin permiso de banear' });
                continue;
            }

            const bannedEntry = await guild.bans.fetch(userId).catch(() => null);
            if (!bannedEntry) {
                results.push({ guild, ok: true, detail: 'No estaba baneado' });
                continue;
            }

            await guild.bans.remove(userId, `${reason} — ejecutado por ${interaction.user.tag} vía /desbanear`);
            results.push({ guild, ok: true, detail: 'Desbaneado' });
        } catch (err) {
            results.push({ guild, ok: false, detail: err.message || 'Error desconocido' });
        }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.length - successCount;

    // Resetea su estado de apelación: ya no está baneado, así que si vuelve
    // a ser baneado en el futuro podrá apelar normalmente de nuevo.
    setAppeal(targetUser.id, { status: 'none' });

    // --- DM notificando el desbaneo (best-effort, no rompe el flujo si falla) ---
    let dmSent = false;
    try {
        const dmEmbed = new EmbedBuilder()
            .setTitle('Has sido desbaneado')
            .setDescription(`Se levantó tu baneo en hasta **${totalGuilds}** servidor(es) donde este bot tiene presencia.`)
            .addFields({ name: 'Razón', value: reason })
            .setColor(0x57F287)
            .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
        dmSent = true;
    } catch {
        dmSent = false;
    }

    await interaction.editReply({
        content: `✅ Proceso terminado: **${successCount}** servidor(es) exitoso(s), **${failCount}** con error. Revisa el log para el detalle.`,
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
                .setTitle('🔓 /desbanear')
                .addFields(
                    { name: 'Ejecutado por', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Usuario desbaneado', value: `${targetUser.tag}`, inline: true },
                    { name: 'DM enviado', value: dmSent ? 'Sí' : 'No', inline: true },
                    { name: 'Razón', value: reason },
                    { name: 'Servidores', value: `${successCount}/${results.length} desbaneados exitosamente` },
                    { name: 'Causas', value: causesText },
                )
                .setColor(failCount === 0 ? 0x57F287 : 0xFEE75C)
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
        } catch (err) {
            console.error('Error enviando log de /desbanear:', err);
        }
    }

    // --- Actualiza el mensaje fijo de #blacklist ---
    if (successCount > 0) {
        removeEntry(targetUser.id);
        await updateBlacklistMessage(client);
    }
}