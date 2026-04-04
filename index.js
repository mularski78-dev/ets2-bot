const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// 🔧 KONFIGURACJA
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = '1064716405972418630';
const CEL_KM = 5000000;
const DATA_FILE = './data.json';

// 📊 dane
let zrobioneKm = 0;
let lastReset = new Date().toDateString();

// 📥 wczytanie danych
if (fs.existsSync(DATA_FILE)) {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  zrobioneKm = data.zrobioneKm || 0;
  lastReset = data.lastReset || new Date().toDateString();
}

// 💾 zapis danych
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    zrobioneKm,
    lastReset
  }, null, 2));
}

// 🔄 reset dzienny
function checkReset() {
  const today = new Date().toDateString();

  if (today !== lastReset) {
    console.log("🔄 Reset dzienny");

    zrobioneKm = 0;
    lastReset = today;

    saveData();
  }
}

// 🤖 bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ✅ start bota
client.once('ready', async () => {
  console.log(`Bot działa jako ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel) {
      channel.send("✅ Bot uruchomiony i działa poprawnie!");
    }
  } catch (err) {
    console.log("❌ Nie mam dostępu do kanału");
  }
});

// 📊 podsumowanie
function sendSummary(channel) {

  const pozostalo = CEL_KM - zrobioneKm;
  const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

  const embed = new EmbedBuilder()
    .setColor(0x00AEFF)
    .setTitle("🚛 PODSUMOWANIE DZIENNE")
    .addFields(
      { name: "📊 Dziś przejechano", value: `${zrobioneKm.toLocaleString()} km`, inline: true },
      { name: "🎯 Cel", value: `${CEL_KM.toLocaleString()} km`, inline: true },
      { name: "⏳ Pozostało", value: `${pozostalo.toLocaleString()} km`, inline: true },
      { name: "📈 Postęp", value: `${procent}%`, inline: true }
    )
    .setFooter({ text: "ETS2 VTC System" });

  channel.send({ embeds: [embed] });
}

// 🔁 podsumowanie co 24h
setInterval(async () => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel) return;

    sendSummary(channel);

    zrobioneKm = 0;
    saveData();

  } catch (err) {
    console.log("❌ Błąd przy wysyłaniu podsumowania");
  }

}, 24 * 60 * 60 * 1000);

// 📥 odbieranie tras
client.on('messageCreate', message => {

  if (message.channel.id !== CHANNEL_ID) return;

  checkReset();

  let text = "";

  if (message.embeds.length > 0) {
    const embed = message.embeds[0];

    if (embed.description) text += embed.description;

    if (embed.fields) {
      embed.fields.forEach(f => {
        text += " " + f.name + " " + f.value;
      });
    }
  }

  // 🔍 wyciąganie km
  const match = text.match(/([\d\s]+)\s*km/i);

  if (!match) return;

  const km = parseInt(match[1].replace(/\s/g, ''));

  if (!km) return;

  zrobioneKm += km;

// 👇 DODAJ TO TUTAJ
const pozostalo = CEL_KM - zrobioneKm;
const procent = ((zrobioneKm / CEL_KM) * 100).toFixed(2);

message.channel.send(
  `🚛 **Nowa trasa!**\n` +
  `✔ +${km} km\n` +
  `📊 Suma: ${zrobioneKm.toLocaleString()} km\n` +
  `🎯 Cel: ${CEL_KM.toLocaleString()} km\n` +
  `⏳ Pozostało: ${pozostalo.toLocaleString()} km\n` +
  `📈 ${procent}%`
);

// 👆 KONIEC DODATKU

console.log(`➕ Dodano ${km} km | Suma: ${zrobioneKm}`);

saveData();
});

client.login(TOKEN);