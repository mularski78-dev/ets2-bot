const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// 🔧 KONFIG
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = '1064716405972418630';
const CEL_KM = 5000000;
const DATA_FILE = '/var/data/data.json';

// 📊 dane
let zrobioneKm = 0;
let dzienneKm = 0;
let drivers = {};
let lastReset = new Date().toDateString();

// 🇩🇪 czas DE
function getDETime() {
  return new Date(new Date().toLocaleString("de-DE", {
    timeZone: "Europe/Berlin"
  }));
}

// 📥 wczytanie
if (fs.existsSync(DATA_FILE)) {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  zrobioneKm = data.zrobioneKm || 0;
  dzienneKm = data.dzienneKm || 0;
  drivers = data.drivers || {};
  lastReset = data.lastReset || new Date().toDateString();
}

// 💾 zapis
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    zrobioneKm,
    dzienneKm,
    drivers,
    lastReset
  }, null, 2));
}

// 🏆 TOP 3
function getTop3() {
  const sorted = Object.entries(drivers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (sorted.length === 0) return "Brak danych";

  const medals = ["🥇", "🥈", "🥉"];

  return sorted.map((d, i) =>
    `${medals[i]} ${d[0]} — ${d[1].toLocaleString()} km`
  ).join("\n");
}

// 📊 embed raportu
function generateReportEmbed() {
  const pozostalo = CEL_KM - zrobioneKm;
  const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

  return new EmbedBuilder()
    .setColor(0x00AEFF)
    .setTitle("🌙 RAPORT DZIENNY")
    .addFields(
      { name: "📅 Dziś", value: `${dzienneKm.toLocaleString()} km`, inline: true },
      { name: "📊 Całość", value: `${zrobioneKm.toLocaleString()} km`, inline: true },
      { name: "🎯 Cel", value: `${CEL_KM.toLocaleString()} km`, inline: true },
      { name: "⏳ Pozostało", value: `${pozostalo.toLocaleString()} km`, inline: true },
      { name: "📈 Postęp", value: `${procent}%`, inline: true },
      { name: "🏆 TOP 3", value: getTop3() }
    );
}

// 🤖 bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 📅 reset dnia (PEWNY)
setInterval(async () => {
  const today = getDETime().toDateString();

  if (today !== lastReset) {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send({ embeds: [generateReportEmbed()] });
    } catch (err) {
      console.log("❌ Błąd raportu", err);
    }

    dzienneKm = 0;
    drivers = {};
    lastReset = today;

    saveData();

    console.log("✅ RESET + RAPORT");
  }

}, 60000);

// 📥 wiadomości
client.on('messageCreate', async message => {

  if (message.channel.id !== CHANNEL_ID) return;

  const TWOJE_ID = '1168624048851402812';

  // ➕ ręczne km
  if (message.content.startsWith('!addkm')) {
    if (message.author.id !== TWOJE_ID) return;

    const km = parseInt(message.content.split(' ')[1]);
    if (!km) return message.reply('❌ Użyj: !addkm 1000');

    zrobioneKm += km;
    dzienneKm += km;

    saveData();

    return message.channel.send(`✔ Dodano ${km} km`);
  }

  // 📊 raport (TOP 3 NA ŻYWO)
  if (message.content === '!raport') {
    return message.channel.send({ embeds: [generateReportEmbed()] });
  }

  // 🚫 ignoruj inne
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

  // 📊 dodawanie
  zrobioneKm += km;
  dzienneKm += km;

  if (!drivers[driver]) drivers[driver] = 0;
  drivers[driver] += km;

  saveData();

  const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

  message.channel.send(
    `✔ **${driver} +${km.toLocaleString()} km**\n` +
    `📅 Dziś: ${dzienneKm.toLocaleString()} km\n` +
    `📊 Całość: ${zrobioneKm.toLocaleString()} km\n` +
    `📈 ${procent}%`
  );
});

// ▶️ start
client.once('ready', () => {
  console.log(`Bot działa jako ${client.user.tag}`);
});

client.login(TOKEN);
