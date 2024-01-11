const { Client, GatewayIntentBits } = require('discord.js');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        // Add any other intents your bot needs
    ],
});

let channelId;

client.once('ready', () => {
    logMessageToConsole('Bot is ready');
});

client.on('guildCreate', (guild) => {
    logMessageToConsole(`Text Channels in ${guild.name}:`);
    guild.channels.cache.forEach((channel) => {
        if (channel.type === 'text') {
            logMessageToConsole(`- ${channel.name} (ID: ${channel.id})`);
        }
    });

    const textChannel = guild.channels.cache.find((channel) => channel.type === 'text');
    if (textChannel) {
        channelId = textChannel.id;
        logMessageToConsole(`Channel ID set to: ${channelId}`);
    } else {
        logMessageToConsole('No text channels found in the guild');
    }
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
    const vikingEpithet = replaceWithRandomEpithet(playerName);
    const message = `:sparkles: **${playerName} ${vikingEpithet} has joined the game. Come join them!**`;
    logMessageToConsole(message);
    return message;
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
    if (line.match(/Got character ZDOID from [^\s]+ : [1-9]\d*:[1-9]\d*(?!:0:0)/)) {
        const playerNameMatch = line.match(/Got character ZDOID from ([^\s]+) : [1-9]\d*:[1-9]\d*(?!:0:0)/);
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
});

client.login(process.env.BOT_TOKEN);
