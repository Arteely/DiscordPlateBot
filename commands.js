// commands.js - Registering Discord slash commands for the license plate bot
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// Define the commands
const commands = [
  new SlashCommandBuilder()
    .setName('addplate')
    .setDescription('Add a license plate to your collection')
    .addStringOption(option => 
      option.setName('plate')
        .setDescription('The license plate (e.g., 34ABC123)')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('mycollection')
    .setDescription('View your license plate collection and stats'),
  
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top license plate collectors'),
  
  new SlashCommandBuilder()
    .setName('plateinfo')
    .setDescription('View information about a specific plate')
    .addStringOption(option => 
      option.setName('plate')
        .setDescription('The license plate to lookup (e.g., 34ABC123)')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('provinces')
    .setDescription('View your plates grouped by province'),
  
  new SlashCommandBuilder()
    .setName('types')
    .setDescription('View your plates grouped by plate type'),
  
  new SlashCommandBuilder()
    .setName('rare')
    .setDescription('See the highest-scoring plates collected so far'),
  
  new SlashCommandBuilder()
    .setName('platehelp')
    .setDescription('Get help with using the License Plate Collector bot')
];

// Convert to JSON
const commandsData = commands.map(command => command.toJSON());

// Deploy the commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

/**
 * Register slash commands with Discord's API
 */
async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    // For global commands (all servers the bot is in)
    if (process.env.CLIENT_ID) {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commandsData },
      );
      console.log('Successfully registered global application commands.');
    } else {
      console.warn('CLIENT_ID not set in environment variables. Skipping global command registration.');
    }

    // For guild-specific commands (testing in a specific server)
    if (process.env.GUILD_ID && process.env.CLIENT_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commandsData },
      );
      console.log(`Successfully registered guild commands for guild ID: ${process.env.GUILD_ID}`);
    }

    console.log('Command registration complete!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Help text for the bot's commands
const helpText = {
  title: 'License Plate Collector - Help',
  description: 'Collect license plates and earn points based on rarity!',
  fields: [
    {
      name: '!addplate <plate>',
      value: 'Add a plate to your collection\nExample: !addplate 34ABC123 Istanbul'
    },
    {
      name: '!mycollection',
      value: 'View your plate collection and stats'
    },
    {
      name: '!leaderboard',
      value: 'See top collectors ranked by score'
    },
    {
      name: '!plateinfo <plate>',
      value: 'Get info about a specific plate\nExample: !plateinfo 06XYZ789'
    },
    {
      name: '!provinces',
      value: 'View your collection by province'
    },
    {
      name: '!types',
      value: 'View your collection by plate type'
    },
    {
      name: '!rare',
      value: 'See the highest-scoring plates collected so far'
    },
    {
      name: 'Special Plate Types',
      value: 'The bot automatically detects plate types based on letter patterns:\n• AA - Universities\n• A/AAA - Police\n• JAA - Gendarmerie\n• SGH - Coast Guard\n• CD - Diplomatic\n• CC - Consulates\n• MA-MZ - Foreign residents\n• TAA-TKZ - Taxis'
    },
    {
      name: 'Scoring System',
      value: 'Score = ((Letter + Digit score) × Province factor) × Special type multiplier\n• Province: 1-10× multiplier\n• Letters: 0-30 points\n• Digits: 0-20 points\n• Special types: 1-30× multiplier'
    }
  ],
  color: '#2ECC71',
  footer: 'Happy plate hunting!'
};

module.exports = { registerCommands, commands, helpText };