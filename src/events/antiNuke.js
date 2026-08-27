import { AuditLogEvent, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { getConfig } from '../utils/antiNukeStore.js';
import { registerAction } from '../utils/antiNukeTracker.js';

const QUARANTINE_MS = 2 * 60 * 60 * 1000; // 2 horas CSKJFKSJFKSJF

async function findExecutor(guild, auditLogType, targetId) {
    try {
        const logs = await guild.fetchAuditLogs({ type: auditLogType, limit: 5 });
        const entry = logs.entries.find((e) => e.target?.id === targetId || !targetId);
        if (!entry) return null;
        if (Date.now() - entry.createdTimestamp > 5000) return null;
        return entry.executor;
    } catch {
        return null;
    }
}

async function handleSuspiciousActivity(guild, client, executor, actionLabel) {
    if (!executor || executor.bot) return;

    const cfg = getConfig(guild.id);
    if (!cfg.enabled) return;
    if (executor.id === guild.ownerId) return;
    if (cfg.whitelist.includes(executor.id)) return;

    const member = await guild.members.fetch(executor.id).catch(() => null);
    if (!member) return;

    try {
        await member.timeout(QUARANTINE_MS, `Anti-nuke: actividad sospechosa (${actionLabel})`);
    } catch (err) {
        console.error('Anti-nuke: no se pudo aplicar timeout:', err);
    }

    const logChannelId = cfg.logChannelId;
    if (!logChannelId) return;

    try {
        const logChannel = await client.channels.fetch(logChannelId);

        const embed = new EmbedBuilder()
            .setTitle('🚨 Actividad sospechosa detectada')
            .setDescription(
                `**${executor.tag}** (\`${executor.id}\`) realizó múltiples acciones de tipo **${actionLabel}** en pocos segundos.\n\n` +
                `Se aplicó **cuarentena automática (timeout 2h)**. ¿Qué desean hacer?`
            )
            .setColor(0xED4245)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`antinuke_ban:${executor.id}`).setLabel('Banear').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`antinuke_kick:${executor.id}`).setLabel('Expulsar').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`antinuke_release:${executor.id}`).setLabel('Quitar cuarentena').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`antinuke_ignore:${executor.id}`).setLabel('Ignorar').setStyle(ButtonStyle.Secondary)
        );

        await logChannel.send({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error('Anti-nuke: error enviando alerta:', err);
    }
}

export function registerAntiNukeListeners(client) {
    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        const executor = await findExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
        if (!executor) return;
        if (registerAction(channel.guild.id, executor.id, 'channelDelete')) {
            await handleSuspiciousActivity(channel.guild, client, executor, 'eliminación de canales');
        }
    });

    client.on('roleDelete', async (role) => {
        const executor = await findExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
        if (!executor) return;
        if (registerAction(role.guild.id, executor.id, 'roleDelete')) {
            await handleSuspiciousActivity(role.guild, client, executor, 'eliminación de roles');
        }
    });

    client.on('guildBanAdd', async (ban) => {
        const executor = await findExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        if (!executor) return;
        if (registerAction(ban.guild.id, executor.id, 'ban')) {
            await handleSuspiciousActivity(ban.guild, client, executor, 'baneos masivos');
        }
    });

    client.on('guildMemberRemove', async (member) => {
        const executor = await findExecutor(member.guild, AuditLogEvent.MemberKick, member.id);
        if (!executor) return;
        if (registerAction(member.guild.id, executor.id, 'kick')) {
            await handleSuspiciousActivity(member.guild, client, executor, 'expulsiones masivas');
        }
    });
}

// Exportado para que interactionCreate.js valide permisos de forma consistente.
export function canManageAntiNuke(interaction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}
