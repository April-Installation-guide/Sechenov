// commands/set.js
// Comando /set: registra el canal de staff del servidor actual, donde
// se recibirán notificaciones de baneos ejecutados vía /bancomer.
// Cada servidor donde esté el bot puede configurar su propio canal.

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { setStaffChannel, removeStaffChannel } from '../utils/staffChannelsStore.js';

export const data = new SlashCommandBuilder()
    .setName('set')
    .setDescription('Configura el canal de staff de este servidor para recibir notificaciones de baneos.')
    .addSubcommand((sub) =>
        sub
            .setName('canal')
            .setDescription('Define el canal de staff de este servidor.')
            .addChannelOption((opt) =>
                opt
                    .setName('canal')
                    .setDescription('El canal donde se enviarán las notificaciones')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
    )
    .addSubcommand((sub) => sub.setName('quitar').setDescription('Elimina el canal de staff configurado en este servidor.'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
    // No restringido a ACD: cada servidor configura su propio canal.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
            content: '⛔ Necesitas el permiso de "Administrar servidor" para usar este comando.',
            ephemeral: true,
        });
        return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'canal') {
        const channel = interaction.options.getChannel('canal', true);
        setStaffChannel(interaction.guildId, channel.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Canal de staff configurado')
            .setDescription(`A partir de ahora, las notificaciones de baneos se enviarán a ${channel}.`)
            .setColor(0x57F287);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    if (sub === 'quitar') {
        removeStaffChannel(interaction.guildId);
        await interaction.reply({ content: '✅ Canal de staff eliminado. Ya no recibirán notificaciones de baneos.', ephemeral: true });
        return;
    }
}