import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { initLogger } from './services/logger.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleGuildCreate } from './events/guildCreate.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { registerAntiNukeListeners } from './events/antiNuke.js';

// 1) Primero se crea el cliente
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 2) Después se registran los listeners que usan "client"
client.once('ready', () => {
    console.log(`Online ${client.user.tag}`);
    initLogger(client);
});

client.on('messageCreate', (message) => handleMessageCreate(message, client));
client.on('guildCreate', (guild) => handleGuildCreate(guild, client));
client.on('interactionCreate', (interaction) => handleInteractionCreate(interaction, client));


// 3) Al final, login
client.login(process.env.DISCORD_TOKEN);