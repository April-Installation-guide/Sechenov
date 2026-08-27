// deploy-commands.js
// Registra los slash commands en Discord.
// - Los comandos de moderación se registran SOLO en ACD (guild command,
//   aparecen en segundos, restringidos a ese servidor).
// - /enviar y /antinuke se registran de forma GLOBAL (tardan hasta ~1h
//   la primera vez, pero funcionan en cualquier servidor donde esté el bot).
//
// Uso: node deploy-commands.js

import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import { guildCommandsData, globalCommandsData } from './src/events/interactionCreate.js';

const HOME_GUILD_ID = '1529898873097687201'; // ACD

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

try {
    console.log(`Registrando ${guildCommandsData.length} comando(s) en ACD...`);
    await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, HOME_GUILD_ID),
        { body: guildCommandsData.map((c) => c.toJSON()) }
    );
    console.log('✅ Comandos de ACD registrados correctamente.');

    console.log(`Registrando ${globalCommandsData.length} comando(s) global(es)...`);
    await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: globalCommandsData.map((c) => c.toJSON()) }
    );
    console.log('✅ Comandos globales registrados correctamente (pueden tardar hasta 1h en aparecer en todos los servidores).');
} catch (err) {
    console.error('❌ Error registrando slash commands:', err);
}