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

// 🧠 dzień roboczy (FIX)
let currentDay = new Date().toISOString().split('T')[0];

// 🔒 anty duble
let lastKm = 0;
let lastDriver = "";
let lastTime = 0;

// 🕒 dzień
function getDay() {
  return new Date().toISOString().split('T')[0];
}

// 📥 LOAD
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    zrobioneKm = data.zrobioneKm ?? 0;
    dzienneKm = data.dzienneKm ?? 0;
    drivers = data.drivers ?? {};

    lastReset = data.lastReset ?? getDay();
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
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      zrobioneKm,
      dzienneKm,
      drivers,
      lastReset
    }, null, 2));
  } catch (err) {
    console.log("❌ SAVE ERROR:", err);
  }
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

  // 🔥 RESET DNIA (tylko raz)
  if (today !== currentDay) {
    console.log("🔄 NOWY DZIEŃ:", today);

    currentDay = today;
    lastReset = today;
    dzienneKm = 0;

    saveData();
  }

  // 🏁 TOP 3 o 23:58
  const now = new Date();
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

  if (message.channel.id !== CHANNEL_ID) return;

  const TWOJE_ID = '1168624048851402812';

  // ➕ dodawanie km
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

  // 📊 RAPORT
  if (message.content === '!raport') {

    const sorted = Object.entries(drivers).sort((a, b) => b[1] - a[1]);
    const medals = ["🥇", "🥈", "🥉"];

    const topText = sorted.length
      ? sorted.slice(0, 3).map((d, i) =>
          `${medals[i]} ${d[0]} — ${d[1].toLocaleString()} km`
        ).join("\n")
      : "Brak danych";

    const allDrivers = sorted.length
      ? sorted.slice(0, 10).map(d =>
          `👤 ${d[0]} — ${d[1].toLocaleString()} km`
        ).join("\n")
      : "Brak danych";

    const procent = CEL_KM > 0
      ? ((zrobioneKm / CEL_KM) * 100).toFixed(2)
      : "0.00";

    const embed = new EmbedBuilder()
      .setColor(0x00AEFF)
      .setTitle("📊 RAPORT")
      .addFields(
        { name: "📅 Dziś", value: `${dzienneKm.toLocaleString()} km`, inline: true },
        { name: "📊 Całość", value: `${zrobioneKm.toLocaleString()} km`, inline: true },
        { name: "🎯 Cel", value: `${CEL_KM.toLocaleString()} km`, inline: true },
        { name: "📈 Postęp", value: `${procent}%`, inline: true },
        { name: "🏆 TOP 3", value: topText },
        { name: "📋 Kierowcy", value: allDrivers }
      );

    return message.channel.send({ embeds: [embed] });
  }

  // 🚛 LOGI (TruckersMP / VTC)
  if (message.embeds.length === 0) return;

  const embed = message.embeds[0];

  let driver = "Nieznany kierowca";

  if (embed.author?.name) driver = embed.author.name;
  else if (embed.footer?.text) driver = embed.footer.text;

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

  // 🔒 anty duplikat
  const nowTime = Date.now();

  if (
    km === lastKm &&
    driver === lastDriver &&
    nowTime - lastTime < 5000
  ) {
    return;
  }

  lastKm = km;
  lastDriver = driver;
  lastTime = nowTime;

  // 📊 liczenie
  zrobioneKm += km;
  dzienneKm += km;

  if (!drivers[driver]) drivers[driver] = 0;
  drivers[driver] += km;

  saveData();

  message.channel.send(
    `✔ **${driver} +${km.toLocaleString()} km**\n\n` +
    `📅 Dziś: **${dzienneKm.toLocaleString()} km**\n` +
    `📊 Całość: ${zrobioneKm.toLocaleString()} km`
  );
});

// ✅ START
client.once('ready', () => {
  console.log(`Bot działa jako ${client.user.tag}`);
});

client.login(TOKEN);
