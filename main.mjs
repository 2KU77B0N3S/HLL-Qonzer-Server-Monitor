import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import query from 'source-server-query';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cron from 'node-cron';

dotenv.config();

const {
  DISCORD_TOKEN,
  CHANNEL_ID,
  GAMESERVER_IP_1,
  GAMESERVER_QUERY_PORT_1,
  GAMESERVER_IP_2,
  GAMESERVER_QUERY_PORT_2,
  GAMESERVER_IP_3,
  GAMESERVER_QUERY_PORT_3,
  RESTART_TIME
} = process.env;

if (!DISCORD_TOKEN || !CHANNEL_ID || !GAMESERVER_IP_1 || !GAMESERVER_QUERY_PORT_1) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

// --- servers config (keep JSON fetch + direct query) ---
const SERVERS = [
  {
    url: `https://qonzer.live/qV3/index.php?g=hll&q=${GAMESERVER_IP_1}:${GAMESERVER_QUERY_PORT_1}&p=2&e=1`,
    ip: GAMESERVER_IP_1,
    port: Number(GAMESERVER_QUERY_PORT_1),
    message: null,
    history: []
  }
];
if (GAMESERVER_IP_2 && GAMESERVER_QUERY_PORT_2) {
  SERVERS.push({
    url: `https://qonzer.live/qV3/index.php?g=hll&q=${GAMESERVER_IP_2}:${GAMESERVER_QUERY_PORT_2}&p=2&e=1`,
    ip: GAMESERVER_IP_2,
    port: Number(GAMESERVER_QUERY_PORT_2),
    message: null,
    history: []
  });
}
if (GAMESERVER_IP_3 && GAMESERVER_QUERY_PORT_3) {
  SERVERS.push({
    url: `https://qonzer.live/qV3/index.php?g=hll&q=${GAMESERVER_IP_3}:${GAMESERVER_QUERY_PORT_3}&p=2&e=1`,
    ip: GAMESERVER_IP_3,
    port: Number(GAMESERVER_QUERY_PORT_3),
    message: null,
    history: []
  });
}

const MAX_HISTORY = 50;
const canvasRenderService = new ChartJSNodeCanvas({ width: 800, height: 400 });

function decodeGamestate(rawBase64) {
  try {
    const bin = Buffer.from(rawBase64, 'base64')
      .toString('binary')
      .split('')
      .map(c => c.charCodeAt(0).toString(2).padStart(8, '0'))
      .join('');

    let offset = 0;
    const readBits = (len) => {
      const slice = bin.slice(offset, offset + len);
      offset += len;
      return parseInt(slice, 2);
    };

    // skip until players/VIP/Queue
    readBits(2); // unknown1
    readBits(2); // unknown2
    readBits(4); // gamemode
    readBits(8); // unknown3
    readBits(16); // unknown4
    readBits(32); // version
    readBits(7); // players
    readBits(1); // official

    const currentVip = readBits(7);
    readBits(1); // padding
    readBits(7); // bogus maxVip, ignore

    readBits(2); // unknown5
    const currentQueue = readBits(3);
    readBits(3); // bogus maxQueue, ignore

    return {
      currentVip,
      currentQueue,
      maxQueue: 6 // hard-coded in HLL
    };
  } catch (err) {
    console.error("[DECODE] Failed:", err);
    return null;
  }
}


// --- safe stringify for BigInt ---
function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
    2
  );
}

// --- enrich JSON with VIP/Queue ---
async function enrichJson(data, ip, port) {
  try {
    console.log(`\n[ENRICH] Querying ${ip}:${port} for info...`);
    const info = await query.info(ip, port);
    console.log(`[ENRICH] Full info for ${ip}:${port}:`, safeStringify(info));

    let gsTag = null;

    if (info?.tags) {
      gsTag = info.tags.find(t => t.startsWith("GS:"));
    }
    if (!gsTag && info?.keywords) {
      gsTag = info.keywords.split(",").find(t => t.startsWith("GS:"));
    }

    if (gsTag) {
      const rawBase64 = gsTag.split(":")[1];
      console.log(`[ENRICH] Found GS tag, raw=${rawBase64}`);
      const gs = decodeGamestate(rawBase64);
      console.log(`[ENRICH] Decoded gamestate:`, gs);

      if (gs) {
        data.currentVip = gs.currentVip;
        data.maxVip = gs.maxVip;
        data.currentQueue = gs.currentQueue;
        data.maxQueue = gs.maxQueue;
      }
    } else {
      console.warn(`[ENRICH] No GS tag found in info for ${ip}:${port}`);
    }
  } catch (err) {
    console.error(`[ENRICH] Failed to query info for ${ip}:${port}`, err);
  }
  return data;
}

// --- embed updater ---
async function updateEmbed(server, index) {
  try {
    const response = await fetch(server.url);
    const text = await response.text();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start === -1 || end <= start) throw new Error('Could not extract JSON');
    const jsonString = text.slice(start, end).trim();
    const data = JSON.parse(jsonString);

    // Enrich JSON with VIP/Queue from GS tag
    await enrichJson(data, server.ip, server.port);

    // history
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    server.history.push({ time: now, ping: data.ping || 0 });
    if (server.history.length > MAX_HISTORY) server.history.shift();

    // chart
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
          y: { beginAtZero: true, title: { display: true, text: 'Ping (ms)' } },
          x: { title: { display: true, text: 'Time' } }
        }
      }
    };
    const buffer = await canvasRenderService.renderToBuffer(config);

    // embed
    const embed = new EmbedBuilder()
      .setTitle(data.name || `Unknown Server ${index + 1}`)
      .setDescription(
        `**Map:** ${data.map || 'N/A'}\n` +
        `**Players:** ${data.numplayers || 0}/${data.maxplayers || 0}\n` +
        `**Ping:** ${data.ping || 'N/A'} ms\n` +
        `**Connect:** ${data.connect || 'N/A'}`
      )
      .addFields(
      { name: 'VIPs', value: data.currentVip !== undefined ? `${data.currentVip}` : 'N/A', inline: true },
      { name: 'Queue', value: data.currentQueue !== undefined ? `${data.currentQueue}/6` : 'N/A', inline: true }
      )
      .setColor(data.ping < 100 ? 0x00ff00 : data.ping < 200 ? 0xffff00 : 0xff0000)
      .setTimestamp()
      .setFooter({ text: `IP: ${server.ip}:${server.port}` });

    const file = new AttachmentBuilder(buffer, { name: `pingchart${index + 1}.png` });

    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) return;

    if (!server.message) {
      server.message = await channel.send({ embeds: [embed], files: [file] });
    } else {
      await server.message.edit({ embeds: [embed], files: [file] });
    }
  } catch (err) {
    console.error(`Server ${index + 1} update failed:`, err);
  }
}

// --- restart scheduler ---
if (RESTART_TIME) {
  const [time, period] = RESTART_TIME.split(/(AM|PM)/i);
  let [hour, minute] = time.split(':').map(Number);
  if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
  const cronTime = `${minute} ${hour} * * *`;
  cron.schedule(cronTime, () => {
    console.log('Scheduled restart triggered...');
    process.exit(0);
  });
}

// --- discord client ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Monitoring ${SERVERS.length} servers`);

  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) process.exit(1);

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    if (messages.size > 0) await channel.bulkDelete(messages);
  } catch (err) {
    console.error('Channel cleanup error:', err);
  }

  for (let i = 0; i < SERVERS.length; i++) {
    await updateEmbed(SERVERS[i], i);
  }

  setInterval(async () => {
    for (let i = 0; i < SERVERS.length; i++) {
      await updateEmbed(SERVERS[i], i);
    }
  }, 15000);
});

client.login(DISCORD_TOKEN);
