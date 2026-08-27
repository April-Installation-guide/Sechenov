import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { getConfig, setConfig, addToWhitelist, removeFromWhitelist } from '../utils/antiNukeStore.js';

export const data = new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configura el sistema anti-nuke de este servidor.')
    .addSubcommand((sub) => sub.setName('activar').setDescription('Activa el anti-nuke en este servidor.'))
    .addSubcommand((sub) => sub.setName('desactivar').setDescription('Desactiva el anti-nuke en este servidor.'))
    .addSubcommand((sub) =>
        sub
            .setName('canal')
            .setDescription('Define el canal donde llegarán las alertas.')
            .addChannelOption((opt) =>
                opt.setName('canal').setDescription('Canal de alertas').addChannelTypes(ChannelType.GuildText).setRequired(true)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName('whitelist_add')
            .setDescription('Exenta a un usuario de la detección anti-nuke.')
            .addUserOption((opt) => opt.setName('usuario').setDescription('Usuario a exentar').setRequired(true))
    )
    .addSubcommand((sub) =>
        sub
            .setName('whitelist_quitar')
            .setDescription('Quita a un usuario de la lista blanca.')
            .addUserOption((opt) => opt.setName('usuario').setDescription('Usuario a quitar').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('estado').setDescription('Muestra la configuración actual del anti-nuke.'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '⛔ Necesitas permiso de Administrador para usar este comando.', ephemeral: true });
        return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'activar') {
        setConfig(guildId, { enabled: true });
        await interaction.reply({ content: '✅ Anti-nuke activado.', ephemeral: true });
        return;
    }

    if (sub === 'desactivar') {
        setConfig(guildId, { enabled: false });
        await interaction.reply({ content: '✅ Anti-nuke desactivado.', ephemeral: true });
        return;
    }

    if (sub === 'canal') {
        const channel = interaction.options.getChannel('canal', true);
        setConfig(guildId, { logChannelId: channel.id });
        await interaction.reply({ content: `✅ Las alertas de anti-nuke se enviarán a ${channel}.`, ephemeral: true });
        return;
    }

    if (sub === 'whitelist_add') {
        const user = interaction.options.getUser('usuario', true);
        addToWhitelist(guildId, user.id);
        await interaction.reply({ content: `✅ ${user.tag} fue agregado a la lista blanca.`, ephemeral: true });
        return;
    }

    if (sub === 'whitelist_quitar') {
        const user = interaction.options.getUser('usuario', true);
        removeFromWhitelist(guildId, user.id);
        await interaction.reply({ content: `✅ ${user.tag} fue quitado de la lista blanca.`, ephemeral: true });
        return;
    }

    if (sub === 'estado') {
        const cfg = getConfig(guildId);
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Estado del Anti-Nuke')
            .addFields(
                { name: 'Activo', value: cfg.enabled ? 'Sí' : 'No', inline: true },
                { name: 'Canal de alertas', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'No configurado', inline: true },
                { name: 'Lista blanca', value: cfg.whitelist.length > 0 ? cfg.whitelist.map((id) => `<@${id}>`).join(', ') : 'Vacía' },
            )
            .setColor(cfg.enabled ? 0x57F287 : 0xFEE75C);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }
}
