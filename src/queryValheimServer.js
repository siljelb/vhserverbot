const gamedig = require('gamedig');

// Replace '123.45.67.89' with your Valheim server IP address
const serverIp = '127.0.0.1';

// Function to query Valheim server and print player count
async function queryValheimServer() {
  try {
    const serverInfo = await gamedig.query({
      type: 'valheim',
      host: serverIp,
    });

    if (serverInfo && serverInfo.players) {
      const playerCount = serverInfo.players.length;
      console.log(`Number of players on Valheim server: ${playerCount}`);
      console.log('Player List:');
      serverInfo.players.forEach(player => {
        console.log(`- ${player.name}`);
      });
    } else {
      console.log('Unable to retrieve player information.');
    }
  } catch (error) {
    console.error('Error querying Valheim server:', error.message);
  }
}

// Call the function to query the Valheim server
queryValheimServer();
