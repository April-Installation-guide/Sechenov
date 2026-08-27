import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { initLogger } from './services/logger.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleGuildCreate } from './events/guildCreate.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { registerAntiNukeListeners } from './events/antiNuke.js';
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Online ${client.user.tag}`);
    initLogger(client);
});

client.on('messageCreate', (message) => handleMessageCreate(message, client));
client.on('guildCreate', (guild) => handleGuildCreate(guild, client));
client.on('interactionCreate', (interaction) => handleInteractionCreate(interaction, client));

client.login(process.env.DISCORD_TOKEN);
