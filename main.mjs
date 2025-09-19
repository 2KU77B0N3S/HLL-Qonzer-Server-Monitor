import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Load environment variables
dotenv.config();
const { DISCORD_TOKEN, CHANNEL_ID, GAMESERVER_IP_1, GAMESERVER_QUERY_PORT_1, GAMESERVER_IP_2, GAMESERVER_QUERY_PORT_2, GAMESERVER_IP_3, GAMESERVER_QUERY_PORT_3, RESTART_TIME } = process.env;

// Validate required environment variables
if (!DISCORD_TOKEN || !CHANNEL_ID || !GAMESERVER_IP_1 || !GAMESERVER_QUERY_PORT_1) {
  console.error('Missing required environment variables: DISCORD_TOKEN, CHANNEL_ID, GAMESERVER_IP_1, GAMESERVER_QUERY_PORT_1');
  process.exit(1);
}

// Build server configurations
const SERVERS = [
  {
    url: `https://qonzer.live/qV3/index.php?g=hll&q=${GAMESERVER_IP_1}:${GAMESERVER_QUERY_PORT_1}&p=2&e=1`,
    message: null,
    history: [], // Array of {time: string, ping: number}
  }
];
if (GAMESERVER_IP_2 && GAMESERVER_QUERY_PORT_2) {
  SERVERS.push({
    url: `https://qonzer.live/qV3/index.php?g=hll&q=${GAMESERVER_IP_2}:${GAMESERVER_QUERY_PORT_2}&p=2&e=1`,
    message: null,
    history: [],
  });
}
if (GAMESERVER_IP_3 && GAMESERVER_QUERY_PORT_3) {
  SERVERS.push({
    url: `https://qonzer.live/qV3/index.php?g=hll&q=${GAMESERVER_IP_3}:${GAMESERVER_QUERY_PORT_3}&p=2&e=1`,
    message: null,
    history: [],
  });
}

const MAX_HISTORY = 50; // Keep last 50 points (~12.5 minutes at 15s intervals)
const canvasRenderService = new ChartJSNodeCanvas({ width: 800, height: 400 });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Function to update embed and chart for a server
async function updateEmbed(server, index) {
  try {
    const response = await fetch(server.url);
    console.log(`Server ${index + 1} - Fetch response status: ${response.status} ${response.statusText}`);
    console.log(`Server ${index + 1} - Response headers:`, Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log(`Server ${index + 1} - Raw response length: ${text.length} chars`);
    console.log(`Server ${index + 1} - Raw response (first 500 chars): ${text.slice(0, 500)}${text.length > 500 ? '...' : ''}`);
    console.log(`Server ${index + 1} - Raw response (last 100 chars): ${text.slice(-100)}`);

    // Fallback JSON extraction (find first { to last })
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start === -1 || end <= start) {
      throw new Error('Could not extract JSON from response');
    }
    const jsonString = text.slice(start, end).trim();
    console.log(`Server ${index + 1} - Extracted JSON string (first 200 chars): ${jsonString.slice(0, 200)}${jsonString.length > 200 ? '...' : ''}`);

    const data = JSON.parse(jsonString);
    console.log(`Server ${index + 1} - Parsed JSON data:`, { name: data.name, ping: data.ping, numplayers: data.numplayers });

    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    server.history.push({ time: now, ping: data.ping });
    if (server.history.length > MAX_HISTORY) {
      server.history.shift();
    }

    const labels = server.history.map(h => h.time);
    const pings = server.history.map(h => h.ping);

    const config = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Ping (ms) - Server ${index + 1}`,
          data: pings,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Ping (ms)' }
          },
          x: {
            title: { display: true, text: 'Time' }
          }
        }
      }
    };

    const buffer = await canvasRenderService.renderToBuffer(config);

    const embed = new EmbedBuilder()
      .setTitle(data.name || `Unknown Server ${index + 1}`)
      .setDescription(`**Map:** ${data.map || 'N/A'}\n**Players:** ${data.numplayers || 0}/${data.maxplayers || 0}\n**Ping:** ${data.ping || 'N/A'}ms\n**Connect:** ${data.connect || 'N/A'}`)
      .addFields(
        { name: 'Password Protected', value: data.password ? 'Yes' : 'No', inline: true }
      )
      .setColor(data.ping < 100 ? 0x00ff00 : data.ping < 200 ? 0xffff00 : 0xff0000) // Green/Yellow/Red based on ping
      .setTimestamp()
      .setFooter({ text: 'Powered by Qonzer' });

    const file = new AttachmentBuilder(buffer, { name: `pingchart${index + 1}.png` });

    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) {
      console.error(`Server ${index + 1} - Channel not found!`);
      return;
    }

    if (!server.message) {
      server.message = await channel.send({ embeds: [embed], files: [file] });
    } else {
      await server.message.edit({ embeds: [embed], files: [file] });
    }
  } catch (error) {
    console.error(`Server ${index + 1} - Error updating embed:`, error);
  }
}

// Schedule daily restart if RESTART_TIME is set (e.g., "4:00AM")
if (RESTART_TIME) {
  const [time, period] = RESTART_TIME.split(/(AM|PM)/i);
  let [hour, minute] = time.split(':').map(Number);
  if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
  const cronTime = `${minute} ${hour} * * *`;
  console.log(`Scheduling daily restart at ${RESTART_TIME} (cron: ${cronTime})`);
  cron.schedule(cronTime, () => {
    console.log('Performing scheduled restart...');
    process.exit(0); // Exit to trigger restart (assumes external process manager like PM2)
  });
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Monitoring ${SERVERS.length} server(s):`, SERVERS.map(s => s.url));
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) {
    console.error('Channel not found!');
    process.exit(1);
  }

  // Clean up existing messages (up to 100)
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    if (messages.size > 0) {
      await channel.bulkDelete(messages);
      console.log('Channel cleaned up.');
    }
  } catch (error) {
    console.error('Error cleaning up channel:', error);
  }

  // Initial update for all servers
  for (let i = 0; i < SERVERS.length; i++) {
    await updateEmbed(SERVERS[i], i);
  }

  // Refresh every 15 seconds
  setInterval(async () => {
    for (let i = 0; i < SERVERS.length; i++) {
      await updateEmbed(SERVERS[i], i);
    }
  }, 15000);
});

client.login(DISCORD_TOKEN);
