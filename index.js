require('dotenv').config();
const ffmpeg = require('ffmpeg-static');
// ÉP RAILWAY DÙNG FFMPEG ĐI KÈM TRONG NODE_MODULES
process.env.FFMPEG_PATH = ffmpeg;

const express = require('express');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    NoSubscriberBehavior, StreamType, getVoiceConnection, AudioPlayerStatus 
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ]
});

// Khởi tạo Player duy nhất
const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play }
});

// Hàm nói chuyện Google TTS (Xử lý lỗi FFmpeg triệt để)
function speak(guild, text) {
    const connection = getVoiceConnection(guild.id);
    if (!connection) return;

    try {
        const url = googleTTS.getAudioUrl(text.substring(0, 190), {
            lang: 'vi', slow: false, host: 'https://translate.google.com'
        });

        // Dùng Arbitrary để nó tự gọi FFmpeg giải mã
        const resource = createAudioResource(url, { 
            inputType: StreamType.Arbitrary,
            inlineVolume: true 
        });

        if (resource.volume) resource.volume.setVolume(1.0);

        connection.subscribe(player);
        player.play(resource);
        console.log(`🔊 Đang nói: ${text}`);
    } catch (e) {
        console.error("❌ Lỗi phát âm thanh:", e.message);
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('t')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. Lệnh tjoin
    if (command === 'join') {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return message.reply('⚠️ Vào voice trước đi Tuan ơi!');
        
        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });
        message.reply('✅ Đã kết nối!');
        setTimeout(() => speak(message.guild, "Chào cả nhà, tôi đã sẵn sàng"), 1000);
    }

    // 2. Lệnh tleave
    if (command === 'leave') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            speak(message.guild, "Tạm biệt nhé, tôi đi đây");
            setTimeout(() => connection.destroy(), 2000);
            message.reply('👋 Cút đây!');
        }
    }

    // 3. Lệnh tnoi (tnoi hello)
    if (command === 'noi' || command === 'n') {
        const content = args.join(' ');
        if (!content) return message.reply('⚠️ Nói gì thì ghi ra!');
        speak(message.guild, content);
        message.react('✅');
    }
});

// Bắt lỗi sập Player (Giúp bot lì hơn)
player.on('error', error => {
    console.error('⚠️ Player Error:', error.message);
});

client.once('ready', () => {
    console.log(`✅ [SUCCESS] Bot Online: ${client.user.tag}`);
    console.log(`🛠 FFmpeg Path: ${process.env.FFMPEG_PATH}`);
});

client.login(process.env.DISCORD_TOKEN);

// Server giữ bot sống
const app = express();
app.get('/', (req, res) => res.send('Bot is ready!'));
app.listen(process.env.PORT || 8000);
