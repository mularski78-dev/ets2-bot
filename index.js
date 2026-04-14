const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// 🔧 KONFIGURACJA
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = '1064716405972418630';
const CEL_KM = 5000000;

// 📁 plik danych
const DATA_FILE = '/var/data/data.json';

// 📊 dane
let zrobioneKm = 0;
let dzienneKm = 0;
let drivers = {};
let lastReset = null;

// 🧠 dzień (EU - TruckBook)
let currentDay = getDay();

// 🔒 anty duble
let lastKm = 0;
let lastDriver = "";
let lastTime = 0;

// 🔒 blokada po ID wiadomości
let lastMessageId = "";

// 📅 dzień EU
function getDay() {
  return new Date(new Date().toLocaleString("de-DE", {
    timeZone: "Europe/Berlin"
  })).toISOString().split('T')[0];
}

// 🕒 czas EU
function getTime() {
  return new Date(new Date().toLocaleString("de-DE", {
    timeZone: "Europe/Berlin"
  }));
}

// 📥 LOAD
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    zrobioneKm = data.zrobioneKm ?? 0;
    dzienneKm = data.dzienneKm ?? 0;
    drivers = data.drivers ?? {};

    lastReset = data.lastReset && data.lastReset !== "Invalid Date"
      ? data.lastReset
      : getDay();

    currentDay = lastReset;

  } catch (err) {
    console.log("❌ JSON ERROR:", err);
    lastReset = getDay();
    currentDay = lastReset;
  }
} else {
  lastReset = getDay();
  currentDay = lastReset;
}

// 💾 SAVE
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    zrobioneKm,
    dzienneKm,
    drivers,
    lastReset
  }, null, 2));
}

// 🤖 BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔁 LOOP
setInterval(async () => {
  const today = getDay();

  if (today !== currentDay) {
    console.log("🔄 NOWY DZIEŃ:", today);

    currentDay = today;
    lastReset = today;
    dzienneKm = 0;

    saveData();
  }

  const now = getTime();

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

    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send(`🏁 **TOP 3 DNIA**\n\n${topText}`);
    } catch (err) {
      console.log("❌ TOP3 ERROR:", err);
    }
  }

}, 60 * 1000);

// 📥 MESSAGE HANDLER
client.on('messageCreate', async message => {

  // 🔥 NIE BLOKUJ EMBEDÓW TRUCKBOOKA
  if (message.author.bot && message.embeds.length === 0) return;

  if (message.channel.id !== CHANNEL_ID) return;

  const TWOJE_ID = '1168624048851402812';

  // ➕ add km
  if (message.content.startsWith('!addkm')) {
    if (message.author.id !== TWOJE_ID) return;

    const km = parseInt(message.content.split(' ')[1]);
    if (!km) return message.reply('❌ Użyj: !addkm 1000');

    zrobioneKm += km;
    dzienneKm += km;

    saveData();
    return message.channel.send(`✔ Dodano ${km} km`);
  }

  // 🏆 TOP3
  if (message.content === '!top3') {
    const sorted = Object.entries(drivers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const medals = ["🥇", "🥈", "🥉"];

    const topText = sorted.length
      ? sorted.map((d, i) =>
          `${medals[i]} ${d[0]} — ${d[1].toLocaleString()} km`
        ).join("\n")
      : "Brak danych";

    return message.channel.send(`🏆 **TOP 3 (LIVE)**\n\n${topText}`);
  }

  // 🚛 EMBED
  if (!message.embeds || message.embeds.length === 0) return;

  // 🔒 FIX DUPLIKATÓW
  if (message.id === lastMessageId) return;
  lastMessageId = message.id;

  const embed = message.embeds[0];

  let driver =
    embed.author?.name ||
    embed.footer?.text ||
    "Unknown";

  let text = "";
  if (embed.title) text += embed.title + " ";
  if (embed.description) text += embed.description + " ";

  if (embed.fields) {
    embed.fields.forEach(f => {
      text += f.name + " " + f.value + " ";
    });
  }

  const match = text.match(/(\d{1,3}(?:[\s,]\d{3})*|\d+)\s*km/i);
  if (!match) return;

  const km = parseInt(match[1].replace(/\s/g, ''));
  if (!km) return;

  const nowTime = Date.now();

  if (
    km === lastKm &&
    driver === lastDriver &&
    nowTime - lastTime < 5000
  ) return;

  lastKm = km;
  lastDriver = driver;
  lastTime = nowTime;

  zrobioneKm += km;
  dzienneKm += km;

  if (!drivers[driver]) drivers[driver] = 0;
  drivers[driver] += km;

  saveData();

  const pozostalo = CEL_KM - zrobioneKm;
  const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

  message.channel.send(
    `✔ **${driver} +${km.toLocaleString()} km**\n\n` +
    `📅 Dziś: **${dzienneKm.toLocaleString()} km**\n` +
    `📊 Całość: ${zrobioneKm.toLocaleString()} km\n` +
    `🎯 Cel: ${CEL_KM.toLocaleString()} km\n` +
    `⏳ Pozostało: ${pozostalo.toLocaleString()} km\n` +
    `📈 Postęp: ${procent}%`
  );
});

// ✅ START
client.once('ready', () => {
  console.log(`Bot działa jako ${client.user.tag}`);
});

client.login(TOKEN);
