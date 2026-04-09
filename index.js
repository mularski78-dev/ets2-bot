const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior
} = require('@discordjs/voice');

const { spawn } = require('child_process');
const express = require('express');

// 🔑 BOT
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.TOKEN;

// 🔥 MANIECZKI STYLE STREAM
const STREAM_URL = 'https://stream.laut.fm/trance';

let connection;
let player;

// 🌐 KEEP ALIVE (RENDER)
const app = express();
app.get("/", (req, res) => res.send("Radio działa 🎧"));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🌐 Serwer działa na porcie ${PORT}`));

// 🎧 FUNKCJA ODTWARZANIA
function playRadio() {
    const ffmpeg = spawn('ffmpeg', [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', STREAM_URL,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    const resource = createAudioResource(ffmpeg.stdout);
    player.play(resource);

    ffmpeg.stderr.on('data', () => {}); // ignoruj spam
}

// 🎛️ PANEL
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!panel') {

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('play').setLabel('▶️ Start').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('stop').setLabel('⛔ Stop').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('move').setLabel('🔄 Move').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('status').setLabel('📻 Status').setStyle(ButtonStyle.Secondary)
        );

        message.channel.send({
            content: '📻 PANEL MANIECZKI',
            components: [row]
        });
    }
});

// 🎛️ BUTTONY
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const channel = interaction.member.voice.channel;

    // ▶️ START
    if (interaction.customId === 'play') {
        if (!channel) {
            return interaction.reply({ content: '❌ Wejdź na voice!', flags: 64 });
        }

        if (connection && connection.state.status !== 'destroyed') {
            connection.destroy();
        }

        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: false
        });

        player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Play }
        });

        connection.subscribe(player);

        playRadio();

        // 🔁 AUTO RECONNECT
        player.on(AudioPlayerStatus.Idle, () => {
            playRadio();
        });

        interaction.reply(`🔥 Manieczki grają na ${channel.name}`);
    }

    // ⛔ STOP
    if (interaction.customId === 'stop') {
        if (connection && connection.state.status !== 'destroyed') {
            connection.destroy();
            connection = null;
        }

        interaction.reply('⛔ Radio zatrzymane');
    }

    // 🔄 MOVE
    if (interaction.customId === 'move') {
        if (!channel) {
            return interaction.reply({ content: '❌ Wejdź na voice!', flags: 64 });
        }

        if (connection && connection.state.status !== 'destroyed') {
            connection.destroy();
        }

        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator
        });

        connection.subscribe(player);
        playRadio();

        interaction.reply(`🔄 Przeniesiono na ${channel.name}`);
    }

    // 📻 STATUS
    if (interaction.customId === 'status') {
        if (connection) {
            interaction.reply('📻 Radio gra 🔥');
        } else {
            interaction.reply('❌ Radio wyłączone');
        }
    }
});

// 🔥 READY FIX
client.once('clientReady', () => {
    console.log(`✅ Zalogowano jako ${client.user.tag}`);
});

client.login(TOKEN);
