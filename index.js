const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// 🔧 KONFIGURACJA
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = '1064716405972418630';
const CEL_KM = 5000000;

// 📁 dane
const DATA_FILE = '/var/data/data.json';

// 📊 stan
let zrobioneKm = 0;
let dzienneKm = 0;
let drivers = {};
let lastReset = null;
let currentDay = null;

// 🔒 anty duble
let lastKm = 0;
let lastDriver = "";
let lastTime = 0;

// 🔒 raporty
let dailyReportSent = false;
let top3Sent = false;

// 📅 EU SAFE DAY
function getDay() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
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
  const now = new Date();

  // 🔄 RESET DNIA
  if (today !== currentDay) {
    console.log("🔄 NOWY DZIEŃ RESET");

    currentDay = today;
    lastReset = today;
    dzienneKm = 0;

    dailyReportSent = false;
    top3Sent = false;

    saveData();
  }

  // 🏁 TOP3 23:58 EU
  if (now.getUTCHours() === 23 && now.getUTCMinutes() === 58) {

    if (!top3Sent) {
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

      top3Sent = true;
    }
  }

  // 📊 RAPORT 23:59 EU
  if (now.getUTCHours() === 23 && now.getUTCMinutes() === 59) {

    if (!dailyReportSent) {

      const sorted = Object.entries(drivers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const medals = ["🥇", "🥈", "🥉"];

      const topText = sorted.length
        ? sorted.map((d, i) =>
            `${medals[i]} ${d[0]} — ${d[1].toLocaleString()} km`
          ).join("\n")
        : "Brak danych";

      const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);
      const pozostalo = CEL_KM - zrobioneKm;

      const embed = new EmbedBuilder()
        .setColor(0x00AEFF)
        .setTitle("🏁 RAPORT DZIENNY FIRMY")
        .addFields(
          { name: "📅 Dzień", value: currentDay, inline: true },
          { name: "📅 Dziś", value: `${dzienneKm.toLocaleString()} km`, inline: true },
          { name: "📊 Całość", value: `${zrobioneKm.toLocaleString()} km`, inline: true },
          { name: "🎯 Cel", value: `${CEL_KM.toLocaleString()} km`, inline: true },
          { name: "⏳ Pozostało", value: `${pozostalo.toLocaleString()} km`, inline: true },
          { name: "📈 Postęp", value: `${procent}%`, inline: true },
          { name: "🏆 TOP 3", value: topText }
        );

      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await channel.send({ embeds: [embed] });
      } catch (err) {
        console.log("❌ RAPORT ERROR:", err);
      }

      dailyReportSent = true;
    }
  }

}, 60000);

// 📥 MESSAGE HANDLER
client.on('messageCreate', async message => {

  if (message.channel.id !== CHANNEL_ID) return;

  // 🏆 TOP3
  if (message.content === '!top3') {
    const sorted = Object.entries(drivers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const medals = ["🥇", "🥈", "🥉"];

    const text = sorted.length
      ? sorted.map((d, i) =>
          `${medals[i]} ${d[0]} — ${d[1].toLocaleString()} km`
        ).join("\n")
      : "Brak danych";

    return message.channel.send(`🏆 **TOP 3**\n\n${text}`);
  }

  // 📊 RAPORT
  if (message.content === '!raport') {

    const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);
    const pozostalo = CEL_KM - zrobioneKm;

    const embed = new EmbedBuilder()
      .setColor(0x00AEFF)
      .setTitle("📊 RAPORT")
      .addFields(
        { name: "📅 Dziś", value: `${dzienneKm.toLocaleString()} km`, inline: true },
        { name: "📊 Całość", value: `${zrobioneKm.toLocaleString()} km`, inline: true },
        { name: "🎯 Cel", value: `${CEL_KM.toLocaleString()} km`, inline: true },
        { name: "⏳ Pozostało", value: `${pozostalo.toLocaleString()} km`, inline: true },
        { name: "📈 Postęp", value: `${procent}%`, inline: true }
      );

    return message.channel.send({ embeds: [embed] });
  }

  // 🚛 TRUCKBOOK EMBED
  if (!message.embeds || message.embeds.length === 0) return;

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

  message.channel.send(
    `✔ **${driver} +${km.toLocaleString()} km**\n` +
    `📅 Dziś: **${dzienneKm.toLocaleString()} km**\n` +
    `📊 Całość: ${zrobioneKm.toLocaleString()} km`
  );
});

client.once('ready', () => {
  console.log(`Bot działa jako ${client.user.tag}`);
});

client.login(TOKEN);
