const { Client, GatewayIntentBits } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        // Add any other intents your bot needs
    ],
});

const channelId = "1194941834447835146";

client.once('ready', () => {
    logMessageToConsole('Bot is ready');
});

const logFilePath = process.env.LOGFILE;
const messageCooldown = new Set();

const getCurrentTimestamp = () => {
    const now = new Date();
    const timestamp = `${now.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
    return timestamp;
};

const logMessageToConsole = (message) => {
    const timestamp = getCurrentTimestamp();
    console.log(`[${timestamp}] ${message}`);
};

// Function to load existing player data from file
const loadPlayerData = () => {
    try {
        const data = fs.readFileSync('playerData.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
};

// Function to save player data to file
const savePlayerData = (playerData) => {
    fs.writeFileSync('playerData.json', JSON.stringify(playerData, null, 2), 'utf8');
};

// Load existing player data
let playerData = loadPlayerData();

const replaceWithRandomEpithet = (playerName) => {
    const vikingEpithets = [
        "the Fearless",
        "the Valiant",
        "the Bold",
        "the Brave",
        "the Mighty",
        "the Cunning",
        "the Conqueror",
        "the Fearbringer",
        "the Defender",
        "the Ironheart",
        "the Stormrider",
        "the Dragonheart",
        "the Fierce",
        "the Unyielding",
        "the Battleborn",
        "the Thunderer",
        "the Relentless",
        "the Ragnarök Survivor",
    ];

    const seed = playerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomIndex = seed % vikingEpithets.length;

    return vikingEpithets[randomIndex];
};

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

const getEventMessage = (event) => {
    const eventMessages = {
        'foresttrolls': `:shaking_face: The ground is shaking`,
        'army_theelder': `:evergreen_tree: The forest is moving...`,
        'army_eikthyr': `:boar: Eikthyr rallies the creatures of the forest`,
        // Add more events and messages as needed
    };

    const message = eventMessages[event] || `Unknown event: ${event}`;
    logMessageToConsole(message);
    return message;
};

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

const tailProcess = spawn('tail', ['-n', '0', '-F', logFilePath]);

tailProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
        if (line.trim() !== '') {
            parseAndPost(line);
        }
    });
});

tailProcess.stderr.on('data', (data) => {
    console.error(`tail process error: ${data}`);
});

tailProcess.on('close', (code) => {
    console.log(`tail process exited with code ${code}`);
});

process.on('exit', () => {
    tailProcess.kill();
    console.log("Bot stopped");
});

client.login(process.env.BOT_TOKEN);
