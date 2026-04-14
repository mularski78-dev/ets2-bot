const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// 🔧 KONFIGURACJA
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = '1064716405972418630';
const CEL_KM = 5000000;

// 📁 plik danych
const DATA_FILE = '/var/data/data.json';

// 📊 GLOBAL
let zrobioneKm = 0;

// 📊 DZIEŃ (RESETOWANY)
let dzienneKm = 0;
let dailyDrivers = {};

// 📊 GLOBAL DRIVERS
let drivers = {};

// 🕒 DZIEŃ
let currentDay = new Date().toISOString().split('T')[0];

function getDay() {
  return new Date().toISOString().split('T')[0];
}

// 🔒 ANTY DUPLIKAT
let lastKm = 0;
let lastDriver = "";
let lastTime = 0;

// 📥 LOAD
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    zrobioneKm = data.zrobioneKm ?? 0;
    drivers = data.drivers ?? {};
    dailyDrivers = data.dailyDrivers ?? {};
    dzienneKm = data.dzienneKm ?? 0;

    currentDay = data.lastReset ?? getDay();

  } catch (err) {
    console.log("❌ JSON ERROR:", err);
  }
}

// 💾 SAVE
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      zrobioneKm,
      drivers,
      dailyDrivers,
      dzienneKm,
      lastReset: currentDay
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

// 🔁 LOOP (RESET DNIA + TOP3)
setInterval(async () => {
  const today = getDay();

  // 🔥 RESET DNIA
  if (today !== currentDay) {
    console.log("🔄 NOWY DZIEŃ:", today);

    currentDay = today;
    dzienneKm = 0;
    dailyDrivers = {};

    saveData();
  }

  // 🏁 TOP3 DNIA
  const now = new Date();

  if (now.getHours() === 23 && now.getMinutes() === 58) {
    const sorted = Object.entries(dailyDrivers)
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

  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;

  // 🏆 TOP3 LIVE (DZIEŃ)
  if (message.content === '!top3') {
    const sorted = Object.entries(dailyDrivers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const medals = ["🥇", "🥈", "🥉"];

    const topText = sorted.length
      ? sorted.map((d, i) =>
          `${medals[i]} ${d[0]} — ${d[1].toLocaleString()} km`
        ).join("\n")
      : "Brak danych";

    return message.channel.send(`🏆 **TOP 3 DNIA**\n\n${topText}`);
  }

  // 📊 RAPORT
  if (message.content === '!raport') {

    const sorted = Object.entries(dailyDrivers).sort((a, b) => b[1] - a[1]);

    const topText = sorted.slice(0, 3)
      .map((d, i) => `#${i + 1} ${d[0]} — ${d[1].toLocaleString()} km`)
      .join("\n");

    const all = sorted.map(d =>
      `👤 ${d[0]} — ${d[1].toLocaleString()} km`
    ).join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x00AEFF)
      .setTitle("📊 RAPORT DNIA")
      .addFields(
        { name: "📅 Dziś", value: `${dzienneKm.toLocaleString()} km`, inline: true },
        { name: "🏆 TOP 3", value: topText || "Brak danych" },
        { name: "📋 Kierowcy", value: all || "Brak danych" }
      );

    return message.channel.send({ embeds: [embed] });
  }

  // 🚛 LOGI
  if (message.embeds.length === 0) return;

  const embed = message.embeds[0];

  let driver = "Nieznany";

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

  const match = text.match(/(\d+)\s*km/i);
  if (!match) return;

  const km = parseInt(match[1]);
  if (!km) return;

  // 🔒 ANTY DUPLIKAT
  const nowTime = Date.now();

  if (
    km === lastKm &&
    driver === lastDriver &&
    nowTime - lastTime < 5000
  ) return;

  lastKm = km;
  lastDriver = driver;
  lastTime = nowTime;

  // 📊 LICZENIE
  zrobioneKm += km;
  dzienneKm += km;

  if (!dailyDrivers[driver]) dailyDrivers[driver] = 0;
  dailyDrivers[driver] += km;

  if (!drivers[driver]) drivers[driver] = 0;
  drivers[driver] += km;

  saveData();

  message.channel.send(
    `✔ **${driver} +${km.toLocaleString()} km**\n` +
    `📅 Dziś: **${dzienneKm.toLocaleString()} km**`
  );
});

// ✅ START
client.once('ready', () => {
  console.log(`Bot działa jako ${client.user.tag}`);
});

client.login(TOKEN);
