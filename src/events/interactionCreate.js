// events/interactionCreate.js
// Enruta las interacciones de Discord: slash commands, el selector de
// /showme, el flujo de apelaciones de /bancomer, y el sistema de
// denuncias de /enviar denuncia (botones + modales).

import * as showmeCommand from '../commands/showme.js';
import * as bancomerCommand from '../commands/bancomer.js';
import * as desbanearCommand from '../commands/desbanear.js';
import * as setCommand from '../commands/set.js';
import * as enviarCommand from '../commands/enviar.js';
import { HOME_GUILD_ID } from '../commands/bancomer.js';
import { buildChannelListEmbeds } from '../utils/guildChannelsEmbed.js';
import { getAppeal, setAppeal, isBlocked } from '../utils/appealsStore.js';
import { takePending } from '../utils/pendingDenunciasStore.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';

const APPEALS_CHANNEL_ID = '1533598900823392376';
const DENUNCIAS_CHANNEL_ID = '1534021942724661278';

// Comandos registrados como guild commands (solo ACD, rápidos, restringidos).
const guildCommands = new Map([
    [showmeCommand.data.name, showmeCommand],
    [bancomerCommand.data.name, bancomerCommand],
    [desbanearCommand.data.name, desbanearCommand],
    [setCommand.data.name, setCommand],
]);

// Comando(s) registrados de forma global (cualquier servidor, sin restricción).
const globalCommands = new Map([
    [enviarCommand.data.name, enviarCommand],
]);

const commands = new Map([...guildCommands, ...globalCommands]);

export const guildCommandsData = [...guildCommands.values()].map((c) => c.data);
export const globalCommandsData = [...globalCommands.values()].map((c) => c.data);

// Solo quienes tengan permiso de banear en ACD pueden moderar denuncias/apelaciones.
function canModerate(interaction) {
    return interaction.guildId === HOME_GUILD_ID && interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers);
}

export async function handleInteractionCreate(interaction, client) {
    try {
        if (interaction.isChatInputCommand()) {
            const command = commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction, client);
            return;
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'showme_select_guild') {
            const guildId = interaction.values[0];
            const guild = client.guilds.cache.get(guildId);

            if (!guild) {
                await interaction.update({ content: 'No se encontró ese servidor (¿el bot salió de ahí?).', components: [] });
                return;
            }

            const embeds = buildChannelListEmbeds(guild);
            await interaction.update({ content: null, embeds: [embeds[0]], components: [] });

            for (const extraEmbed of embeds.slice(1)) {
                await interaction.followUp({ embeds: [extraEmbed], ephemeral: true });
            }
            return;
        }

        // --- Botones ---
        if (interaction.isButton()) {
            const [action, ...rest] = interaction.customId.split(':');

            // -- Flujo de apelaciones de /bancomer --
            if (action === 'bancomer_apelar') {
                const targetUserId = rest[0];
                if (isBlocked(targetUserId)) {
                    await interaction.reply({ content: 'Error 404' });
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`bancomer_apelar_modal:${targetUserId}`)
                    .setTitle('Apelación de baneo');

                const input = new TextInputBuilder()
                    .setCustomId('appeal_reason')
                    .setLabel('¿Por qué el baneo fue injustificado?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(1000)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
                return;
            }

            if (action === 'bancomer_cerrar') {
                await interaction.update({ components: [] });
                return;
            }

            if (action === 'bancomer_responder') {
                const targetUserId = rest[0];
                if (!canModerate(interaction)) {
                    await interaction.reply({ content: '⛔ No tienes permiso para usar este botón.', ephemeral: true });
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`bancomer_responder_modal:${targetUserId}`)
                    .setTitle('Responder apelación');

                const input = new TextInputBuilder()
                    .setCustomId('response_text')
                    .setLabel('Tu respuesta (se enviará por DM)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(1000)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
                return;
            }

            if (action === 'bancomer_prohibicion') {
                const targetUserId = rest[0];
                if (!canModerate(interaction)) {
                    await interaction.reply({ content: '⛔ No tienes permiso para usar este botón.', ephemeral: true });
                    return;
                }

                setAppeal(targetUserId, { status: 'blocked' });

                const oldButtons = interaction.message.components[0]?.components || [];
                const disabledRow = new ActionRowBuilder().addComponents(
                    oldButtons.map((b) => ButtonBuilder.from(b).setDisabled(true))
                );

                await interaction.update({ components: [disabledRow] });
                return;
            }

            // -- Flujo de denuncias --
            if (action === 'denuncia_revisado') {
                if (!canModerate(interaction)) {
                    await interaction.reply({ content: '⛔ No tienes permiso para usar este botón.', ephemeral: true });
                    return;
                }

                const embed = EmbedBuilder.from(interaction.message.embeds[0]).addFields({
                    name: 'Estado',
                    value: `✅ Revisado por ${interaction.user.tag}`,
                });

                const oldRow = interaction.message.components[0];
                const newRow = new ActionRowBuilder().addComponents(
                    oldRow.components.map((b) =>
                        b.customId?.startsWith('denuncia_revisado')
                            ? ButtonBuilder.from(b).setDisabled(true)
                            : ButtonBuilder.from(b)
                    )
                );

                await interaction.update({ embeds: [embed], components: [newRow] });
                return;
            }

            if (action === 'denuncia_responder') {
                if (!canModerate(interaction)) {
                    await interaction.reply({ content: '⛔ No tienes permiso para usar este botón.', ephemeral: true });
                    return;
                }

                const [originGuildId, originChannelId, reporterUserId] = rest;

                const modal = new ModalBuilder()
                    .setCustomId(`denuncia_responder_modal:${originGuildId}:${originChannelId}:${reporterUserId}`)
                    .setTitle('Responder denuncia');

                const input = new TextInputBuilder()
                    .setCustomId('denuncia_respuesta')
                    .setLabel('Tu respuesta')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(2000)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
                return;
            }

            return;
        }

        // --- Modales ---
        if (interaction.isModalSubmit()) {
            const [action, ...rest] = interaction.customId.split(':');

            if (action === 'bancomer_apelar_modal') {
                const targetUserId = rest[0];
                const reasonText = interaction.fields.getTextInputValue('appeal_reason');
                const appeal = getAppeal(targetUserId);

                try {
                    const appealsChannel = await client.channels.fetch(APPEALS_CHANNEL_ID);
                    const user = await client.users.fetch(targetUserId);

                    const embed = new EmbedBuilder()
                        .setTitle('Nueva apelación de baneo')
                        .addFields(
                            { name: 'Usuario', value: `${user.tag} (\`${user.id}\`)` },
                            { name: 'Razón original del baneo', value: appeal?.banReason || 'Desconocida' },
                            { name: 'Argumento del usuario', value: reasonText },
                        )
                        .setColor(0xFEE75C)
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`bancomer_responder:${targetUserId}`).setLabel('Responder').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`bancomer_prohibicion:${targetUserId}`).setLabel('Prohibición').setStyle(ButtonStyle.Danger)
                    );

                    const sentMsg = await appealsChannel.send({ embeds: [embed], components: [row] });
                    setAppeal(targetUserId, { status: 'pending', appealMessageId: sentMsg.id });

                    await interaction.reply({ content: '✅ Tu apelación fue enviada. Un moderador la revisará pronto.' });
                } catch (err) {
                    console.error('Error enviando apelación:', err);
                    await interaction.reply({ content: '⛔ Hubo un error enviando tu apelación. Intenta más tarde.' });
                }
                return;
            }

            if (action === 'bancomer_responder_modal') {
                const targetUserId = rest[0];
                const responseText = interaction.fields.getTextInputValue('response_text');

                try {
                    const user = await client.users.fetch(targetUserId);

                    const embed = new EmbedBuilder()
                        .setTitle('Respuesta a tu apelación')
                        .setDescription(responseText)
                        .setColor(0x5865F2)
                        .setTimestamp();

                    await user.send({ embeds: [embed] });
                    await interaction.reply({ content: `✅ Respuesta enviada a ${user.tag}.`, ephemeral: true });
                } catch (err) {
                    console.error('Error respondiendo apelación:', err);
                    await interaction.reply({ content: '⛔ No se pudo enviar el DM (tal vez tiene los DMs cerrados).', ephemeral: true });
                }
                return;
            }

            if (action === 'denuncia_modal') {
                const pendingId = rest[0];
                const denunciaTexto = interaction.fields.getTextInputValue('denuncia_texto');
                const pending = takePending(pendingId);

                if (!pending) {
                    await interaction.reply({ content: '⛔ La sesión de esta denuncia expiró. Intenta de nuevo con /enviar denuncia.', ephemeral: true });
                    return;
                }

                try {
                    const denunciasChannel = await client.channels.fetch(DENUNCIAS_CHANNEL_ID);

                    const embed = new EmbedBuilder()
                        .setTitle('📢 Nueva denuncia')
                        .addFields(
                            { name: 'Enviado por', value: `${pending.userTag} (\`${pending.userId}\`)` },
                            { name: 'Servidor de origen', value: `\`${pending.guildId}\`` },
                            { name: 'Descripción', value: denunciaTexto },
                        )
                        .setColor(0xFEE75C)
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('denuncia_revisado').setLabel('Revisado').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`denuncia_responder:${pending.guildId}:${pending.channelId}:${pending.userId}`)
                            .setLabel('Responder')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    await denunciasChannel.send({
                        embeds: [embed],
                        components: [row],
                        files: pending.attachments,
                    });

                    await interaction.reply({ content: '✅ Tu denuncia fue enviada al staff. Gracias por reportar.', ephemeral: true });
                } catch (err) {
                    console.error('Error enviando denuncia:', err);
                    await interaction.reply({ content: '⛔ Hubo un error enviando tu denuncia. Intenta más tarde.', ephemeral: true });
                }
                return;
            }

            if (action === 'denuncia_responder_modal') {
                const [originGuildId, originChannelId, reporterUserId] = rest;
                const responseText = interaction.fields.getTextInputValue('denuncia_respuesta');

                try {
                    const originGuild = client.guilds.cache.get(originGuildId);
                    if (!originGuild) throw new Error('El bot ya no está en el servidor de origen.');

                    const originChannel = await originGuild.channels.fetch(originChannelId);

                    const embed = new EmbedBuilder()
                        .setTitle('Respuesta del staff a tu denuncia')
                        .setDescription(responseText)
                        .addFields({ name: 'Respondido por', value: interaction.user.tag })
                        .setColor(0x5865F2)
                        .setTimestamp();

                    await originChannel.send({ content: `<@${reporterUserId}>`, embeds: [embed] });

                    await interaction.reply({ content: '✅ Respuesta enviada al canal de origen.', ephemeral: true });
                } catch (err) {
                    console.error('Error respondiendo denuncia:', err);
                    await interaction.reply({ content: '⛔ No se pudo enviar la respuesta (¿el canal o servidor ya no existe?).', ephemeral: true });
                }
                return;
            }

            return;
        }
    } catch (err) {
        console.error('Error manejando interacción:', err);
    }
}