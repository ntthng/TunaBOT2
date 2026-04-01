require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');

// 1. Thiết lập FFmpeg ngay lập tức để hệ thống nhận diện
const ffmpeg = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpeg;

// 2. Khai báo các thư viện Discord và Voice (Phải sau khi set FFMPEG_PATH)
const { 
    Client, GatewayIntentBits, Partials, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, AttachmentBuilder 
} = require('discord.js');

const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    StreamType,
    AudioPlayerStatus,
    getVoiceConnection 
} = require('@discordjs/voice');

const prism = require('prism-media');
const googleTTS = require('google-tts-api');
const sodium = require('libsodium-wrappers');

// 3. Khởi tạo Client và Player dùng chung
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

const globalPlayer = createAudioPlayer(); 
const dbPath = './database.json';

// --- MẢNG AGENTS (Cần thiết cho lệnh ttest của ông) ---
const Agents = ['Brimstone', 'Viper', 'Omen', 'Killjoy', 'Cypher', 'Sova', 'Sage', 'Phoenix', 'Jett', 'Reyna', 'Raze', 'Skye', 'Yoru', 'Astra', 'KAY/O', 'Chamber', 'Neon', 'Fade', 'Harbor', 'Gekko', 'Deadlock', 'Iso', 'Clove', 'Vyse'];

// 4. Hàm khởi tạo hệ thống (Đợi mã hóa Sodium sẵn sàng cho Linux/Koyeb)
async function startBot() {
    try {
        await sodium.ready; // Đợi mã hóa sẵn sàng
        console.log("✅ Sodium xong. Đang đăng nhập...");
        
        // Đăng ký Player Error Handler
        globalPlayer.on('error', error => {
            console.error('❌ Player Error:', error.message);
        });
    } catch (err) {
        console.error("❌ Lỗi khởi tạo:", err);
    }
}

// 5. Chạy hàm khởi tạo
startBot();

// --- 1. HỆ THỐNG DATABASE (LƯU TRỮ NGƯỜI DÙNG) ---
const db = {
    load: () => {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
        try { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { return {}; }
    },
    save: (data) => {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    },
    getUser: (userId) => {
        let data = db.load();
        const today = new Date().toLocaleDateString();
        if (!data[userId]) {
            data[userId] = {
                level: 1, xp: 0, grindCount: 0, dailyGrind: 0, lastGrindDate: today,
                inventory: {},
                skills: { run: 5, slide: 3, drift: 1 },
                lastRarity: null, streak: 0
            };
            db.save(data);
        }
        if (!data[userId].skills) data[userId].skills = { run: 5, slide: 3, drift: 1 };
        if (data[userId].streak === undefined) data[userId].streak = 0;

        if (data[userId].lastGrindDate !== today) {
            data[userId].dailyGrind = 0;
            data[userId].lastGrindDate = today;
            db.save(data);
        }
        return data[userId];
    }
};

// --- 3. CÁC HÀM HỖ TRỢ VOICE (TTS & LOCAL FILE) ---

async function speak(guild, text) {
    if (!guild) return;
    
    let connection = getVoiceConnection(guild.id);
    if (!connection) {
        console.log("⚠️ Bot chưa vào phòng voice!");
        return;
    }

    try {
        const url = googleTTS.getAudioUrl(text.substring(0, 190), { 
            lang: 'vi', 
            slow: false, 
            host: 'https://translate.google.com' 
        });

        const resource = createAudioResource(url, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
            behaviors: {
                noPlayerFreezing: true 
            }
        });

        if (resource.volume) resource.volume.setVolume(0.8);

        connection.subscribe(globalPlayer);
        globalPlayer.play(resource);
        
        console.log(`🎤 Đang đẩy dữ liệu Voice: "${text}"`);

    } catch (error) {
        console.error("❌ Lỗi trong hàm speak:", error);
    }
}

function playLocalFile(guild, fileName) {
    if (!guild) return;
    const connection = getVoiceConnection(guild.id);
    if (!connection) return;

    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) return console.log(`File không tồn tại: ${fileName}`);

    const resource = createAudioResource(filePath, { inlineVolume: true });
    resource.volume.setVolume(0.5); 
    connection.subscribe(globalPlayer);
    globalPlayer.play(resource);
} 

// Trạng thái Player
globalPlayer.on(AudioPlayerStatus.Playing, () => {
    console.log('⚡ Player đã bắt đầu phát (Vòng xanh sẽ hiện)!');
});

globalPlayer.on(AudioPlayerStatus.Idle, () => {
    console.log('💤 Player đang rảnh (Idle).');
});


client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0].toLowerCase();
    const userId = message.author.id;
    const userName = message.author.username;

    if (command === 'tjoin') {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return message.reply(`⚠️ Vào voice đi.`);
        
        const connection = joinVoiceChannel({ 
            channelId: voiceChannel.id, 
            guildId: voiceChannel.guild.id, 
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false
        });

        connection.subscribe(globalPlayer);
        message.reply(`Hi xin chào cả nhà`);
        playLocalFile(message.guild, 'Hi.mp3'); 
    }

    if (command === 'ttest') {
        const agent = Agents[Math.floor(Math.random() * Agents.length)];
        speak(message.guild, `Xác nhận phản hồi từ ${userName}. Đặc vụ đề xuất: ${agent}`);
    }

    if (command === 'tleave') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            playLocalFile(message.guild, 'Bye.mp3'); 
            setTimeout(() => connection.destroy(), 2000); 
            message.reply(`Chờ xíu tí tao quay lại`);
        } else {
            message.reply(`Có trong room đâu mà cút?`);
        }
    }

    if (['tnoi', 'tn','Tn','Tnoi'].includes(command)) {
        const content = message.content.split(' ').slice(1).join(' ').trim();
        if (!content) return message.reply("Nói gì nói mẹ đi câm à?");

        const safeContent = content.length > 190 ? content.substring(0, 190) + "..." : content;
        speak(message.guild, `${userName} nói: ${safeContent}`);
        message.react('🗣️').catch(() => {}); 
    }
});


// --- 5. KHỞI TẠO BOT ---
client.once('ready', (c) => { 
    console.log(`✅ [SUCCESS] Bot Online: ${c.user.tag}`);
});

// Sử dụng DISCORD_TOKEN từ file .env
client.login(process.env.DISCORD_TOKEN);

// Server phụ để giữ Bot online (Health check Koyeb/Replit)
const app = express();
app.get('/', (req, res) => res.send('TunaBot is running phăm phăm!'));
app.listen(process.env.PORT || 8000, () => console.log("Cổng Health check đã mở."));
