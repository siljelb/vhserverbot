// Import necessary modules
const { Client, GatewayIntentBits } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Create a new Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        // Add any other intents your bot needs
    ],
});

// Define the Discord channel ID where messages will be sent
const channelId = "1194941834447835146";

// Event handler for when the bot is ready
client.once('ready', () => {
    logMessageToConsole('Bot is ready');
});

// Define the path to the log file
const logFilePath = process.env.LOGFILE;

// Set up a cooldown for messages
const messageCooldown = new Set();

// Function to get the current timestamp in UTC
const getCurrentTimestamp = () => {
    const now = new Date();
    const timestamp = `${now.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
    return timestamp;
};

// Function to log messages to the console with timestamps
const logMessageToConsole = (message) => {
    const timestamp = getCurrentTimestamp();
    console.log(`[${timestamp}] ${message}`);
};

// Function to load existing player data from a file
const loadPlayerData = () => {
    try {
        const data = fs.readFileSync('playerData.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
};

// Function to save player data to a file
const savePlayerData = (playerData) => {
    fs.writeFileSync('playerData.json', JSON.stringify(playerData, null, 2), 'utf8');
};

// Load existing player data
let playerData = loadPlayerData();

// Function to load epithets from a file
const loadEpithets = () => {
    try {
        const data = fs.readFileSync('epithets.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

// Function to load event messages from a file
const loadEventMessages = () => {
    try {
        const data = fs.readFileSync('eventMessages.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

// Load epithets
const vikingEpithets = loadEpithets();

// Load event messages
const eventMessages = loadEventMessages();

// Function to replace a player's name with a random epithet
const replaceWithRandomEpithet = (playerName) => {
    const seed = playerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomIndex = seed % vikingEpithets.length;

    return vikingEpithets[randomIndex];
};

// Function to generate a login message for a player
const getPlayerLoginMessage = (playerName) => {
    // Check if the player has an assigned epithet
    if (playerData[playerName]) {
        const vikingEpithet = playerData[playerName];
        const message = `:sparkles: **${playerName} ${vikingEpithet} has joined the game. Come join them!**`;
        logMessageToConsole(message);
        return message;
    } else {
        // If not assigned, generate a new epithet and save it
        const vikingEpithet = replaceWithRandomEpithet(playerName);
        playerData[playerName] = vikingEpithet;
        savePlayerData(playerData);
        const message = `:sparkles: **${playerName} ${vikingEpithet} has joined the game. Come join them!**`;
        logMessageToConsole(message);
        return message;
    }
};

// Function to get an event message based on the event type
const getEventMessage = (event) => {
    const message = eventMessages[event] || `Unknown event: ${event}`;
    logMessageToConsole(message);
    return message;
};

// Function to post a message to the Discord channel with a cooldown
const postMessageWithCooldown = (pattern, key) => {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
        if (!messageCooldown.has(key)) {
            const message = pattern(key);
            channel.send(message);
            messageCooldown.add(key);

            setTimeout(() => {
                messageCooldown.delete(key);
            }, 60000);
        }
    }
};

// Function to parse and post messages from the log file
const parseAndPost = (line) => {
    if (line.match(/Got character ZDOID from [^\s]+ : (?![+-]?0$)[+-]?\d+:[1-9]\d*/)) {
        const playerNameMatch = line.match(/Got character ZDOID from ([^\s]+) : (?![+-]?0$)[+-]?\d+:[1-9]\d*/);
        const playerName = playerNameMatch ? playerNameMatch[1] : 'Unknown Player';
        postMessageWithCooldown(getPlayerLoginMessage, playerName);
    } else if (line.includes('Random event set:')) {
        const eventMatch = line.match(/Random event set:(\w+)/);
        const event = eventMatch ? eventMatch[1] : 'unknown';
        postMessageWithCooldown(getEventMessage, event);
    }
};

// Set up a child process to tail the log file
const tailProcess = spawn('tail', ['-n', '0', '-F', logFilePath]);

// Event listener for data from the tail process
tailProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
        if (line.trim() !== '') {
            parseAndPost(line);
        }
    });
});

// Event listener for errors from the tail process
tailProcess.stderr.on('data', (data) => {
    console.error(`tail process error: ${data}`);
});

// Event listener for the tail process closing
tailProcess.on('close', (code) => {
    console.log(`tail process exited with code ${code}`);
});

// Event listener for the script exiting
process.on('exit', () => {
    tailProcess.kill();
    console.log("Bot stopped");
});

// Log in to Discord with the bot token
client.login(process.env.BOT_TOKEN);
