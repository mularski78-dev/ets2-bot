const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// 🔧 KONFIGURACJA
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = '1064716405972418630';
const CEL_KM = 5000000;

// ❗ zabezpieczenie
if (!TOKEN) {
  console.log("❌ BRAK TOKENA!");
  process.exit(1);
}

// 📁 zapis danych
const DATA_FILE = '/var/data/data.json';

// 📊 dane
let zrobioneKm = 0;
let dzienneKm = 0;
let lastReset = new Date().toDateString();

// 📥 wczytanie danych
if (fs.existsSync(DATA_FILE)) {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  zrobioneKm = data.zrobioneKm || 0;
  dzienneKm = data.dzienneKm || 0;
  lastReset = data.lastReset || new Date().toDateString();
}

// 💾 zapis danych
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    zrobioneKm,
    dzienneKm,
    lastReset
  }, null, 2));
}

// 🤖 bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🌙 RAPORT DZIENNY
setInterval(async () => {
  const now = new Date();

  if (now.getHours() === 0 && now.getMinutes() === 0 && lastReset !== now.toDateString()) {

    try {
      const channel = await client.channels.fetch(CHANNEL_ID);

      const pozostalo = CEL_KM - zrobioneKm;
      const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

      const embed = new EmbedBuilder()
        .setColor(0x00AEFF)
        .setTitle("🌙 RAPORT DZIENNY")
        .addFields(
          { name: "📅 Dziś", value: `${dzienneKm.toLocaleString()} km`, inline: true },
          { name: "📊 Całość", value: `${zrobioneKm.toLocaleString()} km`, inline: true },
          { name: "🎯 Cel", value: `${CEL_KM.toLocaleString()} km`, inline: true },
          { name: "⏳ Pozostało", value: `${pozostalo.toLocaleString()} km`, inline: true },
          { name: "📈 Postęp", value: `${procent}%`, inline: true }
        );

      channel.send({ embeds: [embed] });

    } catch (err) {
      console.log("❌ Błąd raportu");
    }

    dzienneKm = 0;
    lastReset = now.toDateString();
    saveData();
  }

}, 60 * 1000);

// 📥 wiadomości
client.on('messageCreate', message => {

  // 🔒 tylko kanał
  if (message.channel.id !== CHANNEL_ID) return;

  if (message.author.bot) return;

  const TWOJE_ID = '1168624048851402812';

  // 🔧 ręczne dodanie km
  if (message.content.startsWith('!addkm')) {

    if (message.author.id !== TWOJE_ID) return;

    const km = parseInt(message.content.split(' ')[1]);

    if (!km) return message.reply('❌ Użyj: !addkm 1000');

    zrobioneKm += km;
    dzienneKm += km;

    saveData();

    const pozostalo = CEL_KM - zrobioneKm;
    const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

    return message.channel.send(
      `🚛 **Dodano ręcznie!**\n` +
      `✔ +${km.toLocaleString()} km\n` +
      `📅 Dziś: ${dzienneKm.toLocaleString()} km\n` +
      `📊 Całość: ${zrobioneKm.toLocaleString()} km\n` +
      `🎯 Cel: ${CEL_KM.toLocaleString()} km\n` +
      `⏳ Pozostało: ${pozostalo.toLocaleString()} km\n` +
      `📈 ${procent}%`
    );
  }

  // 🔥 ODZYSKIWANIE DANYCH Z EMBED
  let text = "";
  let driver = null;

  if (message.embeds.length > 0) {
    const embed = message.embeds[0];

    // tekst do parsowania km
    if (embed.title) text += embed.title;
    if (embed.description) text += " " + embed.description;

    if (embed.fields) {
      embed.fields.forEach(f => {
        text += " " + f.name + " " + f.value;

        const name = f.name.toLowerCase();

        if (name.includes("driver") || name.includes("kierowca")) {
          driver = f.value;
        }
      });
    }

    // 🔥 NAJWAŻNIEJSZE – TrucksBook często daje kierowcę tutaj
    if (!driver && embed.author?.name) {
      driver = embed.author.name;
    }
  }

  // fallback
  if (!driver) {
    driver = "Nieznany kierowca";
  }

  // 🔍 wykrywanie km (lepsze)
  const match = text.match(/([\d\s,]+)\s*km/i);
  if (!match) return;

  const km = parseInt(match[1].replace(/[^\d]/g, ''));
  if (!km) return;

  // 📊 aktualizacja
  zrobioneKm += km;
  dzienneKm += km;

  saveData();

  const pozostalo = CEL_KM - zrobioneKm;
  const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

  message.channel.send(
    `🚛 **Nowa trasa!**\n` +
    `👤 Kierowca: **${driver}**\n` +
    `✔ +${km.toLocaleString()} km\n` +
    `📅 Dziś: ${dzienneKm.toLocaleString()} km\n` +
    `📊 Całość: ${zrobioneKm.toLocaleString()} km\n` +
    `🎯 Cel: ${CEL_KM.toLocaleString()} km\n` +
    `⏳ Pozostało: ${pozostalo.toLocaleString()} km\n` +
    `📈 ${procent}%`
  );
});

// ✅ start
client.once('ready', () => {
  console.log(`Bot działa jako ${client.user.tag}`);
});

client.login(TOKEN);
