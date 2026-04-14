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

// 🔒 BLOKADA DUPLIKATÓW
let lastKm = 0;
let lastDriver = "";
let lastTime = 0;

// 🕒 Berlin time
function getDETime() {
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
      : getDETime().toDateString();

  } catch (err) {
    console.log("❌ JSON ERROR:", err);
  }
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

// 📊 RAPORT
function generateReportEmbed() {
  const sorted = Object.entries(drivers).sort((a, b) => b[1] - a[1]);

  const medals = ["🥇", "🥈", "🥉"];

  const topText = sorted.length
    ? sorted.slice(0, 3).map((d, i) =>
        `${medals[i]} ${d[0]} — ${d[1].toLocaleString()} km`
      ).join("\n")
    : "Brak danych";

  const allDrivers = sorted.length
    ? sorted.map(d =>
        `👤 ${d[0]} — ${d[1].toLocaleString()} km`
      ).join("\n")
    : "Brak danych";

  const pozostalo = CEL_KM - zrobioneKm;
  const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

  return new EmbedBuilder()
    .setColor(0x00AEFF)
    .setTitle("🌙 RAPORT DZIENNY")
    .addFields(
      { name: "📅 Dziś", value: `${dzienneKm.toLocaleString()} km`, inline: true },
      { name: "📊 Całość", value: `${zrobioneKm.toLocaleString()} km`, inline: true },
      { name: "🎯 Cel", value: `${CEL_KM.toLocaleString()} km`, inline: true },
      { name: "📈 Postęp", value: `${procent}%`, inline: true },
      { name: "🏆 TOP 3", value: topText },
      { name: "📋 WSZYSCY", value: allDrivers }
    );
}

// 🔁 LOOP
setInterval(async () => {
  const now = getDETime();
  const today = now.toDateString();

  // 🏁 TOP 3 23:58
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

  // 🔄 RESET DNIA
  if (lastReset !== today) {
    console.log("🔄 RESET DNIA:", today);

    dzienneKm = 0;
    lastReset = today;

    saveData();
  }

}, 60 * 1000);

// 📥 MESSAGE HANDLER
client.on('messageCreate', async message => {

  if (message.channel.id !== CHANNEL_ID) return;

  const TWOJE_ID = '1168624048851402812';

  // ➕ MANUAL ADD KM
  if (message.content.startsWith('!addkm')) {
    if (message.author.id !== TWOJE_ID) return;

    const km = parseInt(message.content.split(' ')[1]);
    if (!km) return message.reply('❌ Użyj: !addkm 1000');

    zrobioneKm += km;
    dzienneKm += km;

    saveData();
    return message.channel.send(`✔ Dodano ${km} km`);
  }

  // 📊 RAPORT
  if (message.content === '!raport') {
    return message.channel.send({ embeds: [generateReportEmbed()] });
  }

  // 🏆 TOP3 LIVE
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

  // 🚛 TRUCKBOOK + POWIADOMIENIA
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

  // 🔒 BLOKADA DUPLIKATU
  const now = Date.now();

  if (
    km === lastKm &&
    driver === lastDriver &&
    now - lastTime < 5000
  ) {
    console.log("🚫 DUPLIKAT ZABLOKOWANY");
    return;
  }

  lastKm = km;
  lastDriver = driver;
  lastTime = now;

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
