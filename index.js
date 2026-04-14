const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = '1064716405972418630';
const CEL_KM = 5000000;

const DATA_FILE = '/var/data/data.json';

// GLOBAL
let zrobioneKm = 0;

// DZIENNE
let dzienneKm = 0;
let drivers = {};
let currentDay = new Date().toISOString().split('T')[0];

// anti spam
let lastKm = 0;
let lastDriver = "";
let lastTime = 0;

// LOAD
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    zrobioneKm = data.zrobioneKm ?? 0;

    // DZIEŃ ZAWSZE NOWY PO RESTART
    dzienneKm = 0;
    drivers = {};

  } catch (e) {
    console.log("JSON ERROR", e);
  }
}

// SAVE (TYLKO GLOBAL)
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    zrobioneKm
  }, null, 2));
}

// BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// LOOP RESET + TOP3
setInterval(async () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // RESET DNIA
  if (today !== currentDay) {
    currentDay = today;
    dzienneKm = 0;
    drivers = {};
  }

  // TOP 3 DNIA
  if (now.getHours() === 23 && now.getMinutes() === 58) {

    const sorted = Object.entries(drivers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const medals = ["🥇", "🥈", "🥉"];

    const topText = sorted.length
      ? sorted.map((d, i) =>
          `${medals[i]} ${d[0]} — ${d[1].toLocaleString()} km`
        ).join("\n")
      : "Brak danych";

    const ch = await client.channels.fetch(CHANNEL_ID);
    ch.send(`🏁 **TOP 3 DNIA**\n\n${topText}`);
  }

}, 60000);

// MESSAGE
client.on('messageCreate', async message => {
  if (message.channel.id !== CHANNEL_ID) return;

  const embed = message.embeds[0];
  if (!embed) return;

  let driver = embed.author?.name || "Unknown";

  let text = (embed.title || "") + " " + (embed.description || "");
  if (embed.fields) {
    embed.fields.forEach(f => text += f.name + f.value);
  }

  const match = text.match(/(\d{1,3}(?:[\s,]\d{3})*|\d+)\s*km/i);
  if (!match) return;

  const km = parseInt(match[1].replace(/\s/g, ''));
  const nowTime = Date.now();

  if (km === lastKm && driver === lastDriver && nowTime - lastTime < 5000) return;

  lastKm = km;
  lastDriver = driver;
  lastTime = nowTime;

  // DZIENNE
  dzienneKm += km;
  if (!drivers[driver]) drivers[driver] = 0;
  drivers[driver] += km;

  // GLOBAL
  zrobioneKm += km;

  saveData();

  const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

  message.channel.send(
    `✔ **${driver} +${km.toLocaleString()} km**\n\n` +
    `📅 Dziś: **${dzienneKm.toLocaleString()} km**\n` +
    `📊 Całość: **${zrobioneKm.toLocaleString()} km**\n` +
    `🎯 Cel: ${CEL_KM.toLocaleString()} km\n` +
    `📈 ${procent}%`
  );
});

// START
client.once('ready', () => {
  console.log("BOT READY");
});

client.login(TOKEN);
