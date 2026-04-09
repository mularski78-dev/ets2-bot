const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');

const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// 🔑 KONFIG
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = 'TWOJE_ID_KANAŁU';

// 🎧 RADIO
const STREAM_URL = 'https://ice5.somafm.com/fluid-128-mp3';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let connection;
let player = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
    }
});

// 🔥 URUCHOM RADIO
function playRadio(channel) {
    try {
        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator
        });

        const ffmpeg = spawn(ffmpegPath, [
            '-i', STREAM_URL,
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ]);

        const resource = createAudioResource(ffmpeg.stdout, {
            inputType: StreamType.Raw
        });

        player.play(resource);
        connection.subscribe(player);

        console.log('🎧 Radio uruchomione');

    } catch (err) {
        console.log('❌ Błąd:', err);
    }
}

// 🛑 STOP
function stopRadio() {
    if (player) player.stop();
    if (connection) connection.destroy();
    console.log('⛔ Radio zatrzymane');
}

// 🎛 PANEL
function sendPanel(channel) {
    const embed = new EmbedBuilder()
        .setTitle('📻 RADIO MANIECZKI')
        .setDescription('Sterowanie radiem')
        .setColor('Green');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('play')
            .setLabel('▶️ START')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId('stop')
            .setLabel('⛔ STOP')
            .setStyle(ButtonStyle.Danger)
    );

    channel.send({ embeds: [embed], components: [row] });
}

client.once('ready', async () => {
    console.log(`✅ Zalogowano jako ${client.user.tag}`);

    const channel = await client.channels.fetch(CHANNEL_ID);
    sendPanel(channel);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const member = interaction.member;

    if (!member.voice.channel) {
        return interaction.reply({
            content: '❌ Musisz być na kanale głosowym!',
            ephemeral: true
        });
    }

    if (interaction.customId === 'play') {
        playRadio(member.voice.channel);

        await interaction.reply({
            content: '▶️ Radio wystartowało!',
            ephemeral: true
        });
    }

    if (interaction.customId === 'stop') {
        stopRadio();

        await interaction.reply({
            content: '⛔ Radio zatrzymane!',
            ephemeral: true
        });
    }
});

client.login(TOKEN);
