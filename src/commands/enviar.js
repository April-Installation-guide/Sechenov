import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { createPending } from '../utils/pendingDenunciasStore.js';

export const data = new SlashCommandBuilder()
    .setName('enviar')
    .setDescription('Envía contenido al staff.')
    .addSubcommand((sub) =>
        sub
            .setName('denuncia')
            .setDescription('Envía una denuncia con evidencia.')
            .addAttachmentOption((opt) => opt.setName('imagen1').setDescription('Evidencia (imagen/archivo)').setRequired(false))
            .addAttachmentOption((opt) => opt.setName('imagen2').setDescription('Evidencia (imagen/archivo)').setRequired(false))
            .addAttachmentOption((opt) => opt.setName('imagen3').setDescription('Evidencia (imagen/archivo)').setRequired(false))
            .addAttachmentOption((opt) => opt.setName('imagen4').setDescription('Evidencia (imagen/archivo)').setRequired(false))
            .addAttachmentOption((opt) => opt.setName('imagen5').setDescription('Evidencia (imagen/archivo)').setRequired(false))
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'denuncia') return;

    const attachments = [];
    for (let i = 1; i <= 5; i++) {
        const att = interaction.options.getAttachment(`imagen${i}`);
        if (att) attachments.push(att.url);
    }

    const pendingId = createPending({
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        attachments,
    });

    const modal = new ModalBuilder()
        .setCustomId(`denuncia_modal:${pendingId}`)
        .setTitle('Enviar denuncia');

    const input = new TextInputBuilder()
        .setCustomId('denuncia_texto')
        .setLabel('Describe tu denuncia')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(20)
        .setMaxLength(4000)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}
