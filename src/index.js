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
const logMessageToConsole = (message, isError = false) => {
    const timestamp = getCurrentTimestamp();
    const logMessage = `[${timestamp}] ${message}`;
    if (isError) {
        console.error(logMessage);
    } else {
        console.log(logMessage);
    }
};

// Function to get the channel ID based on the guild ID
const getChannelId = (guildId) => {
    const envVariableName = `GUILD_${guildId}_CHANNEL_ID`;
    if (envVariableName) {
        const channelID = process.env[envVariableName];
        return channelID;
    } else {
        return null;
    }
};

// Event handler for when the bot is ready
client.once('ready', () => {
    logMessageToConsole('Bot started');

    // Log guilds and channels
    logMessageToConsole('Guilds joined:');
    client.guilds.cache.forEach((guild) => {
        const channelId = getChannelId(guild.id);
        const channel = client.channels.cache.get(channelId);
        // Log the posting channel for this guild
        logMessageToConsole(`For the ${guild.name} guild I will post in the #${channel.name} channel.`);
    });
});

// Function to load files with console messages
const loadFile = (fileName, fileType) => {
    try {
        const data = fs.readFileSync(fileName, 'utf8');
        logMessageToConsole(`Successfully loaded ${fileType} from ${fileName}`);
        return JSON.parse(data);
    } catch (error) {
        logMessageToConsole(`Failed to load ${fileType} from ${fileName}: ${error.message}`, true);
        return null;
    }
};

// Function to load existing player data from file
const loadPlayerData = () => {
    const data = loadFile('playerData.json', 'player data');
    if (data) {
        logMessageToConsole(`Player Data loaded:\n${JSON.stringify(data, null, 2)}`);
        return data;
    } else {
        logMessageToConsole(`Player Data not found or empty`, true);
        return [];
    }
};

// Function to save player data to file
const saveFile = (data, fileName) => {
    try {
        fs.writeFileSync(fileName, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        logMessageToConsole(`Failed to save ${fileName} : ${error.message}`, true);
        return null;
    }
};

// Function to load epithets from file
const loadEpithets = () => {
    const data = loadFile('epithets.json', 'viking epithets');
    if (data) {
        logMessageToConsole(`Viking Epithets loaded:\n${JSON.stringify(data, null, 2)}`);
        return data;
    } else {
        logMessageToConsole(`Viking Epithets not found or empty`, true);
        return [];
    }
};

// Function to load event messages from file
const loadEventMessages = () => {
    const data = loadFile('eventMessages.json', 'event messages');
    if (data) {
        logMessageToConsole(`Event Messages loaded:\n${JSON.stringify(data, null, 2)}`);
        return data;
    } else {
        logMessageToConsole(`Event Messages not found or empty`, true);
        return [];
    }
};

// Load existing player data
let playerData = loadPlayerData();

// Load epithets
const vikingEpithets = loadEpithets();

// Load epithets
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
        saveFile(playerData,'playerData.json');
        const message = `:sparkles: **${playerName} ${vikingEpithet} has entered Valheim. Come join them!**`;
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
const postMessageWithCooldown = async (message, key, guild) => {
    const channelId = getChannelId(guild.id);
    const channel = client.channels.cache.get(channelId);
    if (channel) {
        if (!messageCooldown.has(key)) {
            try {
                await channel.send(message);
                messageCooldown.add(key);

                setTimeout(() => {
                    messageCooldown.delete(key);
                }, 60000);
            } catch (error) {
                logMessageToConsole(`Error sending message: ${error.message}`, true);
            }
        }
    }
};

// Function to parse and post messages from the log file
const parseAndPost = (line) => {
    if (line.match(/Got character ZDOID from [^\s]+ : (?![+-]?0$)[+-]?\d+:[1-9]\d*/)) {
        const playerNameMatch = line.match(/Got character ZDOID from ([^\s]+) : (?![+-]?0$)[+-]?\d+:[1-9]\d*/);
        const playerName = playerNameMatch ? playerNameMatch[1] : 'Unknown Player';
        logMessageToConsole(`Read from log: ${line} - Matched player login pattern`);
        const playerLoginMessage = getPlayerLoginMessage(playerName);
        client.guilds.cache.forEach((guild) => {
            postMessageWithCooldown(playerLoginMessage, playerName, guild);
        });
    } else if (line.includes('Random event set:')) {
        const eventMatch = line.match(/Random event set:(\w+)/);
        const event = eventMatch ? eventMatch[1] : 'unknown';
        logMessageToConsole(`Read from log: ${line} - Matched random event pattern`);
        const eventMessage = getEventMessage(event);
        client.guilds.cache.forEach((guild) => {
            postMessageWithCooldown(eventMessage, event, guild);
        });
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
    logMessageToConsole(`tail process error: ${data}`, true);
});

// Event listener for the tail process closing
tailProcess.on('close', (code) => {
    logMessageToConsole(`tail process exited with code ${code}`);
});

// Event listener for the script exiting
process.on('exit', () => {
    tailProcess.kill();
    logMessageToConsole('Bot stopped');
});

// Log in to Discord with the bot token
client.login(process.env.BOT_TOKEN);
