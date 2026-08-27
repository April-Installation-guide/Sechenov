// commands/enviar.js
// Comando /enviar denuncia: cualquier persona, en cualquier servidor
// donde esté el bot, puede reportar algo con texto largo (vía modal)
// y hasta 5 adjuntos. Se envía al canal de denuncias de ACD con
// botones "Revisado" y "Responder" para el staff.

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
    // Sin .setDefaultMemberPermissions() a propósito: cualquiera puede usarlo.

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'denuncia') return;

    // Discord no permite adjuntar archivos directamente en un modal, así
    // que guardamos los adjuntos aquí y los recuperamos cuando el usuario
    // envíe el texto de la denuncia.
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