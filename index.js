require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, StreamType, getVoiceConnection } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ]
});

// Khởi tạo Player duy nhất cho toàn Server
const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play }
});

// Hàm nói chuyện Google TTS
function speak(guild, text) {
    const connection = getVoiceConnection(guild.id);
    if (!connection) return;

    try {
        const url = googleTTS.getAudioUrl(text.substring(0, 190), {
            lang: 'vi', slow: false, host: 'https://translate.google.com'
        });
        const resource = createAudioResource(url, { inputType: StreamType.Arbitrary });
        connection.subscribe(player);
        player.play(resource);
    } catch (e) { console.error("Lỗi speak:", e); }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('t')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. Lệnh tjoin
    if (command === 'join') {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return message.reply('⚠️ Vào voice trước đã ông giáo!');
        
        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });
        message.reply('✅ Đã vào phòng!');
        speak(message.guild, "Chào cả nhà, tôi đã online");
    }

    // 2. Lệnh tleave
    if (command === 'leave') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            speak(message.guild, "Tạm biệt nhé, tôi đi đây");
            setTimeout(() => connection.destroy(), 2000);
            message.reply('👋 Tạm biệt!');
        }
    }

    // 3. Lệnh tnoi (Ví dụ: tnoi hello tuan)
    if (command === 'noi' || command === 'n') {
        const content = args.join(' ');
        if (!content) return message.reply('⚠️ Nói gì thì ghi ra chứ!');
        speak(message.guild, content);
        message.react('✅');
    }
});

client.once('ready', () => console.log(`✅ Bot Online: ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);

// Giữ bot sống trên Railway
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 8000);
