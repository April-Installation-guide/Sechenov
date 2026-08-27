import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

const HOME_GUILD_ID = '1529898873097687201';

export const data = new SlashCommandBuilder()
    .setName('showme')
    .setDescription('Muestra los canales y sus IDs de cualquier servidor donde esté el bot.');

export async function execute(interaction, client) {
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
        ? `\n\n Hay ${guilds.length} servidores en total, solo se muestran los primeros 25.`
        : '';

    await interaction.reply({
        content: `Elige el servidor que quieres inspeccionar:${truncatedNote}`,
        components: [row],
        ephemeral: true, // solo lo ve quien lo ejecuta
    });
}
