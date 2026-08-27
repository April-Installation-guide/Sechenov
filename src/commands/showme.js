// commands/showme.js
// Comando /showme: muestra un selector con todos los servidores donde
// está el bot; al elegir uno, responde con sus canales y IDs.
// Restringido para que solo funcione dentro de "nuestro servidor".

import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

// Único servidor donde este comando debe poder usarse (ACD).
const HOME_GUILD_ID = '1529898873097687201';

export const data = new SlashCommandBuilder()
    .setName('showme')
    .setDescription('Muestra los canales y sus IDs de cualquier servidor donde esté el bot.');

export async function execute(interaction, client) {
    // Restricción: solo se puede usar dentro de nuestro servidor,
    // sin importar en cuántos servidores más esté el bot.
    if (interaction.guildId !== HOME_GUILD_ID) {
        await interaction.reply({
            content: '⛔ Este comando solo se puede usar en nuestro servidor.',
            ephemeral: true,
        });
        return;
    }

    const guilds = [...client.guilds.cache.values()].sort((a, b) => a.name.localeCompare(b.name));

    if (guilds.length === 0) {
        await interaction.reply({ content: 'El bot no está en ningún servidor.', ephemeral: true });
        return;
    }

    // Los select menus de Discord aceptan máximo 25 opciones.
    const limitedGuilds = guilds.slice(0, 25);
    const options = limitedGuilds.map((g) => ({
        label: g.name.slice(0, 100),
        description: `ID: ${g.id}`.slice(0, 100),
        value: g.id,
    }));

    const menu = new StringSelectMenuBuilder()
        .setCustomId('showme_select_guild')
        .setPlaceholder('Selecciona un servidor')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(menu);

    const truncatedNote = guilds.length > 25
        ? `\n\n⚠️ Hay ${guilds.length} servidores en total, solo se muestran los primeros 25.`
        : '';

    await interaction.reply({
        content: `Elige el servidor que quieres inspeccionar:${truncatedNote}`,
        components: [row],
        ephemeral: true, // solo lo ve quien lo ejecuta
    });
}