const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const REPORT_CHANNEL_ID = '1534021942724661278';
const pendingReports = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enviar-denuncia')
    .setDescription('Envía una denuncia formal sobre un usuario a moderación')
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuario que estás reportando')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('razon')
        .setDescription('Motivo breve de la denuncia (ej: acoso, spam, amenazas)')
        .setRequired(true)
        .setMaxLength(150))
    .addAttachmentOption(opt =>
      opt.setName('archivo1')
        .setDescription('Evidencia (captura, imagen, video, etc.)')
        .setRequired(false))
    .addAttachmentOption(opt =>
      opt.setName('archivo2')
        .setDescription('Evidencia adicional')
        .setRequired(false))
    .addAttachmentOption(opt =>
      opt.setName('archivo3')
        .setDescription('Evidencia adicional')
        .setRequired(false)),

  async execute(interaction) {
    const usuarioReportado = interaction.options.getUser('usuario');
    const razon = interaction.options.getString('razon');
    const archivos = [
      interaction.options.getAttachment('archivo1'),
      interaction.options.getAttachment('archivo2'),
      interaction.options.getAttachment('archivo3'),
    ].filter(Boolean);

    pendingReports.set(interaction.user.id, {
      usuarioReportado,
      razon,
      archivos,
      guildId: interaction.guildId,
      timestamp: Date.now(),
    });

    const modal = new ModalBuilder()
      .setCustomId('modal-denuncia')
      .setTitle('Detalle de la denuncia');

    const detalleInput = new TextInputBuilder()
      .setCustomId('detalle')
      .setLabel('Describe lo sucedido con el mayor detalle posible')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(4000)
      .setRequired(true)
      .setPlaceholder('Fecha, contexto, qué ocurrió, si hay más testigos, etc.');

    modal.addComponents(new ActionRowBuilder().addComponents(detalleInput));

    await interaction.showModal(modal);
  },

  async handleModalSubmit(interaction) {
    if (interaction.customId !== 'modal-denuncia') return;

    const pending = pendingReports.get(interaction.user.id);
    if (!pending) {
      return interaction.reply({
        content: '⚠️ No se encontró la información de tu denuncia. Por favor vuelve a intentarlo con /enviar-denuncia.',
        ephemeral: true,
      });
    }
    pendingReports.delete(interaction.user.id);

    const detalle = interaction.fields.getTextInputValue('detalle');

    const embed = new EmbedBuilder()
      .setTitle('🚨 Nueva denuncia recibida')
      .setColor(0xE74C3C)
      .addFields(
        { name: 'Denunciante', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
        { name: 'Usuario reportado', value: `${pending.usuarioReportado.tag} (${pending.usuarioReportado.id})`, inline: false },
        { name: 'Razón', value: pending.razon, inline: false },
        { name: 'Detalle', value: detalle.length > 1024 ? detalle.slice(0, 1021) + '...' : detalle, inline: false },
      )
      .setTimestamp();

    let extraFile = null;
    if (detalle.length > 1024) {
      extraFile = {
        attachment: Buffer.from(detalle, 'utf-8'),
        name: 'detalle-completo.txt',
      };
    }

    try {
      const reportChannel = await interaction.client.channels.fetch(REPORT_CHANNEL_ID);

      const files = [...pending.archivos.map(a => a.url)];
      if (extraFile) files.push(extraFile);

      await reportChannel.send({
        embeds: [embed],
        files,
      });

      await interaction.reply({
        content: '✅ Tu denuncia fue enviada correctamente al equipo de moderación. Gracias por ayudarnos a mantener la comunidad segura.',
        ephemeral: true,
      });
    } catch (err) {
      console.error('Error al enviar denuncia:', err);
      await interaction.reply({
        content: '❌ Hubo un error al enviar tu denuncia. Por favor contacta directamente a un moderador.',
        ephemeral: true,
      });
    }
  },
};
