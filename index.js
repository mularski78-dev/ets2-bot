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

// 🔒 anty duble
let lastKm = 0;
let lastDriver = "";
let lastTime = 0;
let lastMessageId = "";

// 📅 CZAS EU (PEWNY)
function getDay() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Europe/Warsaw'
  });
}

// 🕒 CZAS EU GODZINA/MINUTA
function getTimeEU() {
  const now = new Date();

  const hour = parseInt(new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    hour12: false
  }).format(now));

  const minute = parseInt(new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    minute: '2-digit'
  }).format(now));

  return { hour, minute };
}

// 📥 LOAD
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    zrobioneKm = data.zrobioneKm ?? 0;
    dzienneKm = data.dzienneKm ?? 0;
    drivers = data.drivers ?? {};
    lastReset = typeof data.lastReset === "string" ? data.lastReset : getDay();

  } catch (err) {
    console.log("❌ JSON ERROR:", err);
    lastReset = getDay();
  }
} else {
  lastReset = getDay();
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

// 🔁 LOOP (RESET + TOP3 + RAPORT)
setInterval(async () => {

  const today = getDay();
  const { hour, minute } = getTimeEU();

  // 🔄 RESET DNIA
  if (today !== lastReset) {
    console.log("🔄 NOWY DZIEŃ:", today);
    lastReset = today;
    dzienneKm = 0;
    drivers = {}; // 🔥 reset kierowców dziennych
    saveData();
  }

  // 🏁 TOP3
  if (hour === 23 && minute === 58) {
    try {
      const sorted = Object.entries(drivers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const medals = ["🥇", "🥈", "🥉"];

      const text = sorted.length
        ? sorted.map((d, i) =>
            `${medals[i]} ${d[0]} — ${d[1].toLocaleString()} km`
          ).join("\n")
        : "Brak danych";

      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send(`🏁 **TOP 3 DNIA**\n\n${text}`);

    } catch (err) {
      console.log("❌ TOP3 ERROR:", err);
    }
  }

  // 📊 RAPORT
  if (hour === 23 && minute === 59) {
    try {
      const sorted = Object.entries(drivers)
        .sort((a, b) => b[1] - a[1]);

      const top3 = sorted.slice(0, 3)
        .map((d, i) => ["🥇","🥈","🥉"][i] + ` ${d[0]} — ${d[1].toLocaleString()} km`)
        .join("\n") || "Brak danych";

      const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);
      const pozostalo = CEL_KM - zrobioneKm;

      const embed = new EmbedBuilder()
        .setColor(0x00AEFF)
        .setTitle("📊 RAPORT DZIENNY FIRMY")
        .addFields(
          { name: "📅 Dzień", value: today },
          { name: "📅 Dziś", value: `${dzienneKm.toLocaleString()} km`, inline: true },
          { name: "📊 Całość", value: `${zrobioneKm.toLocaleString()} km`, inline: true },
          { name: "🎯 Cel", value: `${CEL_KM.toLocaleString()} km`, inline: true },
          { name: "⏳ Pozostało", value: `${pozostalo.toLocaleString()} km`, inline: true },
          { name: "📈 Postęp", value: `${procent}%`, inline: true },
          { name: "🏆 TOP 3", value: top3 }
        );

      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send({ embeds: [embed] });

    } catch (err) {
      console.log("❌ RAPORT ERROR:", err);
    }
  }

}, 60000);

// 📥 MESSAGE HANDLER
client.on('messageCreate', async message => {

  if (!message.channel || message.channel.id !== CHANNEL_ID) return;

  const { hour, minute } = getTimeEU();

  // ❌ NIE LICZ PO 23:59
  if (hour === 23 && minute >= 59) return;

  // 🔥 ignoruj śmieci botów bez embedów
  if (message.author.bot && (!message.embeds || message.embeds.length === 0)) return;

  // 🏆 TOP3 KOMENDA
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

    return message.channel.send(`🏆 **TOP 3 (LIVE)**\n\n${text}`);
  }

  // 📊 RAPORT KOMENDA
  if (message.content === '!raport') {

    const sorted = Object.entries(drivers)
      .sort((a, b) => b[1] - a[1]);

    const top3 = sorted.slice(0, 3)
      .map((d, i) => ["🥇","🥈","🥉"][i] + ` ${d[0]} — ${d[1].toLocaleString()} km`)
      .join("\n") || "Brak danych";

    const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);
    const pozostalo = CEL_KM - zrobioneKm;

    const embed = new EmbedBuilder()
      .setColor(0x00AEFF)
      .setTitle("📊 RAPORT FIRMY")
      .addFields(
        { name: "📅 Dziś", value: `${dzienneKm.toLocaleString()} km`, inline: true },
        { name: "📊 Całość", value: `${zrobioneKm.toLocaleString()} km`, inline: true },
        { name: "🎯 Cel", value: `${CEL_KM.toLocaleString()} km`, inline: true },
        { name: "⏳ Pozostało", value: `${pozostalo.toLocaleString()} km`, inline: true },
        { name: "📈 Postęp", value: `${procent}%`, inline: true },
        { name: "🏆 TOP 3", value: top3 }
      );

    return message.channel.send({ embeds: [embed] });
  }

  // 🚛 TRUCKBOOK EMBED
  if (!message.embeds || message.embeds.length === 0) return;

  // 🔒 FIX DUPLIKATÓW
  if (message.id === lastMessageId) return;
  lastMessageId = message.id;

  const embed = message.embeds[0];

  let driver =
    embed.author?.name ||
    embed.footer?.text;

  // ❌ brak kierowcy = ignoruj
  if (!driver) return;

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
