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

const channelId = process.env.CHANNEL_ID;

client.once('ready', () => {
    logMessageToConsole('Bot is ready');
});

const logFilePath = process.env.LOGFILE;

const messageCooldown = new Set();

// Custom Emojis (replace these IDs with your actual emoji IDs)
const emojiIDs = {
    glowingPortal: '826075075056500767',
    frostTroll: '489509728070795264',
    greyDwarf: '826058950490980362',
    // Add more emojis as needed
};

const getEmoji = (emojiID) => client.emojis.cache.get(emojiID) || `:question:`;

const getCurrentTimestamp = () => {
    const now = new Date();
    const timestamp = `${now.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
    return timestamp;
};

const logMessageToConsole = (message) => {
    const timestamp = getCurrentTimestamp();
    console.log(`[${timestamp}] ${message}`);
};

const getPlayerLoginMessage = (playerName) => {
    const glowingPortal = getEmoji(emojiIDs.glowingPortal);
    const message = `${glowingPortal} **${playerName} has joined the game. Come join them!**`;
    logMessageToConsole(message);
    return message;
};

const getEventMessage = (event) => {
    const frostTroll = getEmoji(emojiIDs.frostTroll);
    const greyDwarf = getEmoji(emojiIDs.greyDwarf);

    const eventMessages = {
        'foresttrolls': `${frostTroll} The ground is shaking`,
        'army_theelder': `${greyDwarf} The forest is moving...`,
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
            }, 10000);
        }
    }
};

const parseAndPost = (line) => {
    if (line.includes('Got character ZDOID from')) {
        const playerNameMatch = line.match(/Got character ZDOID from (.+) :/);
        const playerName = playerNameMatch ? playerNameMatch[1] : 'Unknown Player';
        postMessageWithCooldown(getPlayerLoginMessage, playerName);
    } else if (line.includes('Random event set:')) {
        const eventMatch = line.match(/Random event set:(\w+)$/);
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

