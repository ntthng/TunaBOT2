require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { 
    Client, GatewayIntentBits, Partials, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, AttachmentBuilder 
} = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    StreamType,            // <--- SỬA LỖI STREAMTYPE NOT DEFINED
    AudioPlayerStatus,
    getVoiceConnection // <--- THÊM ĐỂ LỆNH TLEAVE KHÔNG LỖI
} = require('@discordjs/voice');

// --- DÒNG QUAN TRỌNG NHẤT ĐỂ FIX LỖI CÂM TRÊN KOYEB ---
const prism = require('prism-media');
// Đoạn này ép Bot dùng ffmpeg-static mà ông đã cài
process.env.FFMPEG_PATH = ffmpeg;

const googleTTS = require('google-tts-api');
const ffmpeg = require('ffmpeg-static'); // <--- SỬA LỖI CÂM TRÊN LINUX

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

// --- THÊM PLAYER DÙNG CHUNG ĐỂ SỬA LỖI "PLAYER IS NOT DEFINED" ---
const globalPlayer = createAudioPlayer(); 

const dbPath = './database.json';

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

// --- 2. DANH SÁCH DỮ LIỆU GAME (GIỮ NGUYÊN 100%) ---

const vukhi = {
    pistol: ['Classic', 'Shorty', 'Frenzy', 'Ghost', 'Sheriff'],
    smg: ['Stinger', 'Spectre'],
    shotgun: ['Bucky', 'Judge'],
    rifle: ['Bulldog', 'Guardian', 'Phantom', 'Vandal'],
    sniper: ['Marshal', 'Outlaw', 'Operator'],
    mg: ['Ares', 'Odin'], // Machine Gun
    melee: ['Melee']
};

// --- HỆ THỐNG LỆNH VŨ KHÍ CHI TIẾT ---
    const commandList = {
        'tpistol': 'pistol',
        'tsmg': 'smg',
        'tshotgun': 'shotgun',
        'trifle': 'rifle',
        'tsniper': 'sniper',
        'tmg': 'mg',
        'tmelee': 'melee'
    }


// ValCollect là tệp cha định nghĩa các bậc Rarity
const ValCollect = {
    Trash: 'Trash',
    Default: 'Default',
    Common: 'Common',
    Rare: 'Rare',
    Select: 'Select',
    Deluxe: 'Deluxe',
    Premium: 'Premium',
    Exclusive: 'Exclusive',
    Ultra: 'Ultra',
    Limited: 'Limited'
};

// ValGun là tệp con chứa danh sách Skin cụ thể cho từng bậc
const ValGun = {
    [ValCollect.Trash]: ['Trash'],
    [ValCollect.Default]: ['Melee', 'Classic', 'Shorty', 'Ghost', 'Sheriff', 'Stinger', 'Spectre', 'Bucky', 'Judge', 
    'Bulldog', 'Guardian', 'Phantom', 'Vandal', 'Marshal', 'Operator', 'Ares', 'Odin'],
    [ValCollect.Select]: [
  // Daydream: 5 món (Sửa lại chính tả Classic cho chuẩn)
  'DaydreamClassic', 'DaydreamJudge', 'DaydreamPhantom', 'DaydreamOperator', 'DaydreamCrowbarMelee',

  // Infantry (Thế chiến): 5 món
  'InfantryGuardian', 'InfantrySpectre', 'InfantryGhost', 'InfantryOperator', 'InfantryAres',

  // Luxe: 5 món
  'LuxeVandal', 'LuxeOperator', 'LuxeSpectre', 'LuxeJudge', 'LuxeGhost', 'LuxeKnifeMelee',

  // Smite (Sét xanh): 5 món
  'SmitePhantom', 'SmiteOdin', 'SmiteClassic', 'SmiteJudge', 'SmiteKnifeMelee',

  // Prism II (Bản hồng): 5 món
  'PrismIIStinger', 'PrismIISheriff', 'PrismIIVandal', 'PrismIIBucky', 'PrismIIShorty',

  // Rush: 5 món
  'RushPhantom', 'RushVandal', 'RushAres', 'RushBulldog', 'RushJudge',

  // Galleria: 5 món
  'GalleriaClassic', 'GalleriaBucky', 'GalleriaGuardian', 'GalleriaPhantom', 'GalleriaMarshal',

  // Sensation: 5 món
  'SensationVandal', 'SensationOdin', 'SensationFrenzy', 'SensationJudge', 'SensationStinger',

  // Endeavour: 5 món
  'EndeavourVandal', 'EndeavourOperator', 'EndeavourBulldog', 'EndeavourAres', 'EndeavourGhost',

  // Reverie: 5 món
  'ReveriePhantom', 'ReverieVandal', 'ReverieClassic', 'ReverieGuardian', 'ReverieKnifeMelee',

  // Convex: 5 món
  'ConvexSheriff', 'ConvexSpectre', 'ConvexJudge', 'ConvexOperator', 'ConvexBulldog'
],
    [ValCollect.Deluxe]: [
  // Sakura: 5 món
  'SakuraClassic', 'SakuraSheriff', 'SakuraStinger', 'SakuraVandal', 'SakuraAres',

  // Tigris: 5 món
  'TigrisPhantom', 'TigrisOperator', 'TigrisSpectre', 'TigrisShorty', 'TigrisMelee',

  // Kohaku & Matsuba: 5 món
  'KohakuMatsubaClassic', 'KohakuMatsubaJudge', 'KohakuMatsubaPhantom', 'KohakuMatsubaOperator', 'KohakuMatsubaMelee',

  // Luna: 5 món
  'LunaVandal', 'LunaSpectre', 'LunaGuardian', 'LunaGhost', 'LunaMelee',

  // Sarmad: 5 món
  'SarmadVandal', 'SarmadPhantom', 'SarmadSpectre', 'SarmadFrenzy', 'SarmadMelee',

  // Team Ace (Gồm các Agent): 5 món
  'TeamAceJettOperator', 'TeamAceReynaVandal', 'TeamAcePhoenixPhantom', 'TeamAceYoruSovaSheriff', 'TeamAceRazeJudge',

  // Silvanus: 5 món
  'SilvanusVandal', 'SilvanusPhantom', 'SilvanusSheriff', 'SilvanusOperator', 'SilvanusStinger',

  // Minima: 5 món
  'MinimaPhantom', 'MinimaOperator', 'MinimaSheriff', 'MinimaSpectre', 'MinimaAres',

  // Horizon: 5 món
  'HorizonVandal', 'HorizonBulldog', 'HorizonSpectre', 'HorizonBucky', 'HorizonFrenzy',

  // Prism (V1 + V2 + V3): 10+ món
  'PrismAres', 'PrismGhost', 'PrismOperator', 'PrismPhantom', 'PrismMelee',
  'PrismIIISheriff', 'PrismIIIClassic', 'PrismIIIJudge', 'PrismIIIOdin',

  // Wasteland: 5 món
  'WastelandVandal', 'WastelandSheriff', 'WastelandSpectre', 'WastelandShorty', 'WastelandMarshal',

  // Snowfall: 5 món
  'SnowfallClassic', 'SnowfallJudge', 'SnowfallPhantom', 'SnowfallAres', 'SnowfallWandMelee',

  // Winterwunderland: 5 món
  'WinterwunderlandVandal', 'WinterwunderlandPhantom', 'WinterwunderlandGhost', 'WinterwunderlandMarshal', 'WinterwunderlandCandyCaneMelee'
],
    [ValCollect.Premium]: [
  // Oni (V1 + V2): 10 món
  'OniPhantom', 'OniGuardian', 'OniBucky', 'OniShorty', 'OniMelee', 
  'OniVandal', 'OniBulldog', 'OniAres', 'OniFrenzy', 'OniKatanaMelee',

  // Reaver (V1 + V2/EP 5): 10 món
  'ReaverVandal', 'ReaverOperator', 'ReaverGuardian', 'ReaverSheriff', 'ReaverMelee',
  'ReaverPhantom', 'ReaverOdin', 'ReaverSpectre', 'ReaverGhost', 'ReaverKarambitMelee',

  // Ion (V1 + V2/EP 5): 10 món
  'IonPhantom', 'IonOperator', 'IonGuardian', 'IonSheriff', 'IonMelee',
  'IonVandal', 'IonAres', 'IonSpectre', 'IonFrenzy', 'IonKarambitMelee',

  // Magepunk (V1 + V2 + V3/EP 6): 15 món
  'MagepunkGhost', 'MagepunkMarshal', 'MagepunkBucky', 'MagepunkSpectre', 'MagepunkElectrobladeMelee',
  'MagepunkSheriff', 'MagepunkGuardian', 'MagepunkAres', 'MagepunkOperator', 'MagepunkShockGauntletMelee',
  'MagepunkVandal', 'MagepunkPhantom', 'MagepunkSparkswitchMelee',

  // Prime (V1 + V2.0): 10 món
  'PrimeVandal', 'PrimeGuardian', 'PrimeSpectre', 'PrimeClassic', 'PrimeMelee',
  'PrimePhantom', 'PrimeOdin', 'PrimeBucky', 'PrimeFrenzy', 'PrimeKarambitMelee',

  // Gaia's Vengeance (V1 + V2/EP 7): 10 món
  'GaiasVengeanceVandal', 'GaiasVengeanceGuardian', 'GaiasVengeanceMarshal', 'GaiasVengeanceGhost', 'GaiasVengeanceMelee',
  'GaiasVengeancePhantom', 'GaiasVengeanceAres', 'GaiasVengeanceBucky', 'GaiasVengeanceShorty', 'GaiasVengeanceMeleeV2',

  // Sovereign (V1 + V2/EP 8): 10 món
  'SovereignGhost', 'SovereignStinger', 'SovereignGuardian', 'SovereignMarshal', 'SovereignMelee',
  'SovereignPhantom', 'SovereignOdin', 'SovereignJudge', 'SovereignFrenzy', 'SovereignEternalShieldMelee',

  // Neptune (V1 + V2): 10 món
  'NeptuneVandal', 'NeptuneGuardian', 'NeptuneSpectre', 'NeptuneShorty', 'NeptuneAnchorMelee',
  'NeptunePhantom', 'NeptuneBulldog', 'NeptuneVandalV2', 'NeptuneSpectreV2', 'NeptuneMeleeV2',

  // Các bundle Premium đơn lẻ khác
  'SolarstrideVandal', 'SolarstrideGuardian', 'SolarstrideSpectre', 'SolarstrideGhost', 'SolarstrideAres',
  'BoltVandal', 'BoltGuardian', 'BoltSpectre', 'BoltJudge', 'BoltSheriff',
  'HelixVandal', 'HelixSpectre', 'HelixGuardian', 'HelixShorty', 'HelixSheriff',
  'AemondirVandal', 'AemondirBulldog', 'AemondirBucky', 'AemondirSheriff', 'AemondirBladeMelee',
  'XERØFANGVandal', 'XERØFANGGhost', 'XERØFANGMelee',
  'ValiantHeroVandal', 'ValiantHeroOperator', 'ValiantHeroAres', 'ValiantHeroGhost', 'ValiantHeroStaffMelee',
  'BlackMarketVandal', 'BlackMarketBulldog', 'BlackMarketMarshal', 'BlackMarketClassic', 'BlackMarketButterflyMelee',
  'CryostasisVandal', 'CryostasisBulldog', 'CryostasisOperator', 'CryostasisClassic', 'CryostasisMelee',
  'SoulstrifePhantom', 'SoulstrifeGuardian', 'SoulstrifeGhost', 'SoulstrifeSpectre', 'SoulstrifeScytheMelee',
  'CrimsonbeastVandal', 'CrimsonbeastSheriff', 'CrimsonbeastMarshal', 'CrimsonbeastJudge', 'CrimsonbeastHammerMelee',
  'XenohunterPhantom', 'XenohunterOdin', 'XenohunterBucky', 'XenohunterFrenzy', 'XenohunterKnifeMelee',
  'DoodleBudsVandal', 'DoodleBudsPhantom', 'DoodleBudsAres', 'DoodleBudsStinger', 'DoodleBudsMarshal',
  'UndercityVandal', 'UndercityPhantom', 'UndercityBulldog', 'UndercityJudge', 'UndercityClassic', 'UndercityHackMelee',
  'ArcaneSheriff',
  'RadiantCrisis001Phantom', 'RadiantCrisis001Classic', 'RadiantCrisis001Bucky', 'RadiantCrisis001Spectre', 'RadiantCrisis001BatMelee',
  'VALORANTGOVol1Phantom', 'VALORANTGOVol1Guardian', 'VALORANTGOVol1Spectre', 'VALORANTGOVol1Ghost', 'VALORANTGOVol1KnifeMelee',
  'VALORANTGOVol2Vandal', 'VALORANTGOVol2Operator', 'VALORANTGOVol2Ares', 'VALORANTGOVol2Classic', 'VALORANTGOVol2ButterflyMelee',
  'ReconPhantom', 'ReconGuardian', 'ReconSpectre', 'ReconGhost', 'ReconBalisongMelee',
  'OriginVandal', 'OriginOperator', 'OriginBucky', 'OriginFrenzy', 'OriginCrescentBladeMelee',
  'TetheredRealmsVandal', 'TetheredRealmsGuardian', 'TetheredRealmsOperator', 'TetheredRealmsGhost', 'TetheredRealmsMelee',
  'ForsakenVandal', 'ForsakenOperator', 'ForsakenSpectre', 'ForsakenClassic', 'ForsakenRitualBladeMelee',
  'CelestialPhantom', 'CelestialAres', 'CelestialJudge', 'CelestialFrenzy', 'CelestialFanMelee',
  'GravitationalUraniumNeuroblasterPhantom', 'GravitationalUraniumNeuroblasterOperator', 'GravitationalUraniumNeuroblasterBucky', 'GravitationalUraniumNeuroblasterSpectre', 'GravitationalUraniumNeuroblasterClassic', 'GravitationalUraniumNeuroblasterBatonMelee',
  'EgoVandal', 'EgoStinger', 'EgoGuardian', 'EgoGhost', 'EgoKnifeMelee',
  'SplinePhantom', 'SplineOperator', 'SplineSpectre', 'SplineClassic', 'SplineDaggerMelee',
  'NebulaPhantom', 'NebulaGuardian', 'NebulaAres', 'NebulaSheriff', 'NebulaKnifeMelee'
    ],
    [ValCollect.Exclusive]: [
  // Singularity (V1 + V2): 10 món
  'SingularityPhantom', 'SingularitySheriff', 'SingularitySpectre', 'SingularityAres', 'SingularityKnifeMelee',
  'SingularityVandal', 'SingularityGhost', 'SingularityButterflyKnifeMelee',

  // Glitchpop (V1 + V2): 10 món
  'GlitchpopFrenzy', 'GlitchpopJudge', 'GlitchpopBulldog', 'GlitchpopOdin', 'GlitchpopDaggerMelee',
  'GlitchpopVandal', 'GlitchpopPhantom', 'GlitchpopClassic', 'GlitchpopOperator', 'GlitchpopAxeMelee',

  // RGX 11z Pro (V1 + V2 + V3): 15 món
  'RGXVandal', 'RGXGuardian', 'RGXStinger', 'RGXFrenzy', 'RGXBladeMelee',
  'RGXPhantom', 'RGXOperator', 'RGXSpectre', 'RGXClassic', 'RGXButterflyKnifeMelee',
  'RGXSheriff', 'RGXOutlaw', 'RGXKarambitMelee',

  // Kuronami: 5 món
  'KuronamiVandal', 'KuronamiMarshal', 'KuronamiSheriff', 'KuronamiSpectre', 'KuronamiNoYaibaMelee',

  // Prelude to Chaos: 5 món
  'PreludeToChaosVandal', 'PreludeToChaosOperator', 'PreludeToChaosShorty', 'PreludeToChaosStinger', 'PreludeToChaosBladeMelee',

  // Araxys: 5 món
  'AraxysVandal', 'AraxysOperator', 'AraxysShorty', 'AraxysBulldog', 'AraxysBioHarvesterMelee',

  // Chronovoid: 5 món
  'ChronovoidPhantom', 'ChronovoidVandal', 'ChronovoidSheriff', 'ChronovoidJudge', 'ChronovoidTerminusMelee',

  // Spectrum (Zedd): 5 món
  'SpectrumPhantom', 'SpectrumGuardian', 'SpectrumClassic', 'SpectrumBulldog', 'SpectrumWaveformMelee',

  // Evori Dreamwings: 5 món
  'EvoriDreamwingsVandal', 'EvoriDreamwingsGhost', 'EvoriDreamwingsSpectre', 'EvoriDreamwingsOdin', 'EvoriDreamwingsWandMelee',

  // Neo Frontier: 5 món
  'NeoFrontierSheriff', 'NeoFrontierMarshal', 'NeoFrontierPhantom', 'NeoFrontierOdin', 'NeoFrontierAxeMelee',

  // Sentinels of Light: 5 món
  'SentinelsOfLightVandal', 'SentinelsOfLightOperator', 'SentinelsOfLightSheriff', 'SentinelsOfLightAres', 'SentinelsOfLightRelicMelee',

  // Ruination: 5 món
  'RuinationPhantom', 'RuinationGuardian', 'RuinationSpectre', 'RuinationGhost', 'RuinationBrokenBladeMelee',

  // Protocol 781-A: 5 món
  'Protocol781APhantom', 'Protocol781ASheriff', 'Protocol781ABulldog', 'Protocol781ASpectre', 'Protocol781APersonalAdministrativeMelee'
    ],
    [ValCollect.Ultra]: [
  // Radiant Entertainment System (Power, Bazooka, K.nock Out): 15 món (tính cả 3 biến thể màu)
  // Nhưng thường tính theo tên súng:
  'RadiantEntertainmentSystemPhantom', 'RadiantEntertainmentSystemGhost', 'RadiantEntertainmentSystemBulldog', 'RadiantEntertainmentSystemOperator', 'RadiantEntertainmentSystemPowerFistMelee',

  // Elderflame: 5 món
  'ElderflameVandal', 'ElderflameOperator', 'ElderflameJudge', 'ElderflameFrenzy', 'ElderflameDaggerMelee',

  // Protocol 781-A (Đôi khi được xếp vào Ultra vì có giọng nói AI): 5 món
  'Protocol781APhantom', 'Protocol781ASheriff', 'Protocol781ABulldog', 'Protocol781ASpectre', 'Protocol781APersonalAdministrativeMelee',

  // Mystbloom: 5 món
  'MystbloomPhantom', 'MystbloomSheriff', 'MystbloomJudge', 'MystbloomOperator', 'MystbloomKunaiMelee',

  // Evori Dreamwings (Một số khu vực xếp Ultra): 5 món
  'EvoriDreamwingsVandal', 'EvoriDreamwingsGhost', 'EvoriDreamwingsSpectre', 'EvoriDreamwingsOdin', 'EvoriDreamwingsWandMelee',

  // Spectrum (Zedd - Bạn đã nhắc Classic): 5 món
  'SpectrumClassic', 'SpectrumPhantom', 'SpectrumGuardian', 'SpectrumBulldog', 'SpectrumWaveformMelee'
],
    [ValCollect.Limited]: [
  // --- SÚNG CHAMPIONS (Cực kỳ hiếm) ---
  'Champions2021Vandal',    // Vandal Champions đời đầu
  'Champions2022Phantom',   // Phantom Champions đỏ đen
  'Champions2023Vandal',    // Vandal Champions tím vàng
  'Champions2024Phantom',   // Phantom Champions tím hồng
  'Champions2025Vandal',    // (Dự kiến cho mùa Champions 2025)

  // --- DAO LIMITED (MELEE) ---
  'Champions2021KarambitMelee',
  'Champions2022ButterflyMelee',
  'Champions2023KunaiMelee',
  'Champions2024KatanaMelee',
  'VCTLockInMisericórdiaMelee', 
  'VCTIgniteFanMelee',
  'VCTCompassRoseMelee',    // Dao Masters Madrid
  'ArcaneGauntletMelee',    // Găng tay Vi

  // --- DÒNG ARCANE ---
  'ArcaneSheriff',
  'ArcaneVandal',

  // --- VCT 2025 CLASSIC (Top Teams/Playoffs) ---
  'SENClassic2025', 'LEVClassic2025', '100TClassic2025', 'G2Classic2025',
  'PRXClassic2025', 'GenGClassic2025', 'DRXClassic2025', 'TLNClassic2025',
  'EDGClassic2025', 'FPXClassic2025', 'TEClassic2025', 'BLGClassic2025',
  'FNCClassic2025', 'THClassic2025', 'VITClassic2025', 'NAVIClassic2025'
]
};

const Agents = [
    'Brimstone', 'Viper', 'Omen', 'Killjoy', 'Cypher', 'Sova', 'Sage', 'Phoenix', 'Jett', 'Reyna', 
    'Raze', 'Skye', 'Yoru', 'Astra', 'KAY/O', 'Chamber', 'Neon', 'Fade', 'Harbor', 'Gekko', 
    'Deadlock', 'Iso', 'Clove', 'Vyse'
]

// Tỷ lệ rơi gốc (Raw Data)
const rawDropRates = [
    { rank: ValCollect.Trash, chance: 18, catchBase: 0, color: '#000000' },
    { rank: ValCollect.Default, chance: 36, catchBase: 80, color: '#646464'},
    { rank: ValCollect.Common, chance: 27, catchBase: 70, color: '#32CD32' },
    { rank: ValCollect.Rare, chance: 10, catchBase: 60, color: '#1a6ab9' },
    { rank: ValCollect.Premium, chance: 5, catchBase: 50, color: '#733be2' },
    { rank: ValCollect.Exclusive, chance: 3, catchBase: 36, color: '#df901a' },
    { rank: ValCollect.Ultra, chance: 1, catchBase: 18, color: '#eef123' },
    { rank: ValCollect.Limited, chance: 0.1, catchBase: 5, color: '#FF00FF' }
];

// Logic lọc: Chỉ những rank nào có súng trong ValGun mới được xuất hiện
const dropRates = rawDropRates.filter(r => ValGun[r.rank] && ValGun[r.rank].length > 0);

const moveSkills = {
    walk: { label: 'Walk', buff: 0, style: ButtonStyle.Secondary },
    run: { label: 'Run', buff: 10, style: ButtonStyle.Primary },
    slide: { label: 'Slide', buff: 20, style: ButtonStyle.Success },
    drift: { label: 'Drift', buff: 30, style: ButtonStyle.Danger }
};

// --- 3. CÁC HÀM HỖ TRỢ VOICE (TTS & LOCAL FILE) ---

async function speak(guild, text) {
    if (!guild) return; // Chặn lỗi nếu không có Guild
    const connection = getVoiceConnection(guild.id); // Lấy kết nối hiện tại
    if (!connection) return; // Chặn lỗi nếu không trong voice

    // Giới hạn 200 ký tự để không crash Google TTS
    const safeText = text.substring(0, 190);
    const url = googleTTS.getAudioUrl(safeText, { lang: 'vi', slow: false, host: 'https://translate.google.com' });

    // TẠO RESOURCE - ÉP FFMPEG GIẢI MÃ CHO LINUX (KOYEB)
    const resource = createAudioResource(url, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true
    });

    // Phát âm thanh bằng GlobalPlayer
    resource.volume.setVolume(0.8);
    connection.subscribe(globalPlayer);
    globalPlayer.play(resource);
}

function playLocalFile(guild, fileName) {
    if (!guild) return;
    const connection = getVoiceConnection(guild.id);
    if (!connection) return;

    // Kiểm tra file tồn tại
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) return console.log(`File không tồn tại: ${fileName}`);

    const resource = createAudioResource(filePath, { inlineVolume: true });
    resource.volume.setVolume(0.5); 
    connection.subscribe(globalPlayer);
    globalPlayer.play(resource);
} 

/// --- 4. XỬ LÝ LỆNH MESSAGE (GIỮ NGUYÊN 100%) ---

client.on('messageCreate', async (message) => {
    // 1. Chặn bot phản hồi chính nó hoặc tin nhắn không có prefix
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0].toLowerCase(); // Prefix: t
    const userId = message.author.id;
    const userName = message.author.username;

    // Cấu hình Rank (Giữ nguyên ID của ông)
    const RankConfig = {
        [ValCollect.Default]:   { icon: '<:Default:1484829317580984380>', prefix: 'df' },
        [ValCollect.Select]:    { icon: '<:Select:1484824427547066418>', prefix: 'sl' }, 
        [ValCollect.Deluxe]:    { icon: '<:Deluxe:1484824318184783883>', prefix: 'dl' }, 
        [ValCollect.Premium]:   { icon: '<:Premium:1484824385830518954>', prefix: 'pr' }, 
        [ValCollect.Exclusive]: { icon: '<:Exclusive:1484824345317740704>', prefix: 'ex' }, 
        [ValCollect.Ultra]:     { icon: '<:Ultra:1484824447075749988>', prefix: 'ut' },
        [ValCollect.Limited]:   { icon: '<:Limited:1484824367656472606>', prefix: 'lm' }
    };

    const GunIcons = {
        'Vandal': '<:Vandal:1484833792840564776>',
        'Phantom': '<:Phantom:1484833765036396665>',
    };

    if (['tkhodo', 'tinv', 'tcollection'].includes(command)) {
        let userData = db.getUser(userId);
        const inv = userData.inventory;
        const keys = Object.keys(inv);
        
        if (keys.length === 0) return message.reply("🎒 Kho đồ của bạn hiện đang trống!");

        // Sắp xếp theo độ hiếm
        const sortedKeys = keys.sort((a, b) => {
            const ranks = Object.values(ValCollect);
            return ranks.indexOf(inv[b].rank) - ranks.indexOf(inv[a].rank);
        });

        // 2. Chia đôi danh sách để làm 2 cột
        const half = Math.ceil(sortedKeys.length / 2);
        const leftKeys = sortedKeys.slice(0, half);
        const rightKeys = sortedKeys.slice(half);

        const formatColumn = (keys) => {
            if (keys.length === 0) return "\u200B"; 

            return keys.map((k) => {
                const item = inv[k];
                const conf = RankConfig[item.rank] || { icon: '🔘', prefix: 'id' };
                const gunEmoji = GunIcons[item.name] || '　'; 
                
                const subId = ValGun[item.rank] ? (ValGun[item.rank].indexOf(item.name) + 1) : 0;
                const finalId = `${conf.prefix}${subId}`;

                const shortName = item.name.length > 11 ? item.name.substring(0, 9) + '..' : item.name;

                return `\`${finalId.padEnd(5)}\`${conf.icon}${gunEmoji}**${shortName}**`;
            }).join('\n'); 
        };

        const embed = new EmbedBuilder()
            .setTitle(`📦 ${userName}'s Inventory`)
            .setColor(0x2f3136) 
            .addFields(
                { name: `\u200B`, value: formatColumn(leftKeys), inline: true },
                { name: `\u200B`, value: formatColumn(rightKeys), inline: true }
            )
            .setFooter({ 
                text: `Page 1/1 • Tổng cộng: ${sortedKeys.length} skins`,
                iconURL: message.author.displayAvatarURL() 
            });

            const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId('sort').setLabel('🔄 Sort').setStyle(ButtonStyle.Success)
        );

        return message.reply({ embeds: [embed], components: [row] });
    }

    // ==========================================
    // LỆNH TFIND / TF
    // ==========================================
    if (command === 'tfind' || command === 'tf') {
        let userData = db.getUser(userId);
        if (userData.dailyGrind >= 500) return message.reply("⚠️ Bạn đã đạt giới hạn 500 lượt hôm nay!");
        if (dropRates.length === 0) return message.reply("⚠️ Lỗi: Không có skin nào trong ValGun!");

        const totalChance = dropRates.reduce((sum, r) => sum + r.chance, 0);
        const randSpawn = Math.random() * totalChance;
        let cumulative = 0;
        let res = dropRates[0];

        for (const r of dropRates) {
            cumulative += r.chance;
            if (randSpawn <= cumulative) { res = r; break; }
        }

        if (userData.lastRarity === res.rank) userData.streak++;
        else { userData.lastRarity = res.rank; userData.streak = 1; }

        const gunList = ValGun[res.rank];
        const finalItemName = gunList[Math.floor(Math.random() * gunList.length)];
        const imagePath = `./${finalItemName}.webp`;
        const file = fs.existsSync(imagePath) ? new AttachmentBuilder(imagePath) : null;

        const createLootEmbed = (statusMsg, footerText, skillBuff = null) => {
            let catchRateDisplay = skillBuff !== null 
                ? `${res.catchBase}% (+${skillBuff}% boost) = **${res.catchBase + skillBuff}%**`
                : `**${res.catchBase}%**`;

            return new EmbedBuilder()
                .setAuthor({ name: `Great work, ${userName}!`, iconURL: message.author.displayAvatarURL() }) 
                .setDescription(statusMsg)
                .addFields(
                    { name: '\u200B', value: `**Độ Hiếm: ${res.rank}**\n**Streak: ${userData.streak}**` },
                    { name: '\u200B', value: `Tỷ lệ nhặt: ${catchRateDisplay}` },
                    { name: '──────────── Kỹ năng ────────────', value: `🏃 Run: **${userData.skills.run}** | 🛹 Slide: **${userData.skills.slide}** | 🌀 Drift: **${userData.skills.drift}**` }
                )
                .setColor(res.color)
                .setImage(file ? `attachment://${finalItemName}.webp` : null)
                .setFooter({ text: footerText });
        };

        const initialEmbed = createLootEmbed(`⚠️ Bạn đã tìm thấy một **${finalItemName}**!`, '============ Kỹ năng ============');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('walk').setLabel('Walk').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('run').setLabel('Run').setStyle(ButtonStyle.Primary).setDisabled(userData.skills.run <= 0),
            new ButtonBuilder().setCustomId('slide').setLabel('Slide').setStyle(ButtonStyle.Success).setDisabled(userData.skills.slide <= 0),
            new ButtonBuilder().setCustomId('drift').setLabel('Drift').setStyle(ButtonStyle.Danger).setDisabled(userData.skills.drift <= 0)
        );

        const mainMsg = await message.reply({ embeds: [initialEmbed], files: file ? [file] : [], components: [row] });
        const collector = mainMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) return i.reply({ content: "Đồ này không phải của bạn!", ephemeral: true });
            const skillId = i.customId;
            if (!moveSkills[skillId]) return;
            
            const skill = moveSkills[skillId];
            const finalRate = res.catchBase + skill.buff;
            const rollCatch = Math.random() * 100;

            if (skillId !== 'walk') userData.skills[skillId]--;
            userData.dailyGrind++;

            let status = "";
            let footer = "================================";

            if (rollCatch <= finalRate && res.rank !== ValCollect.Trash) {
                userData.grindCount++;
                userData.xp++;
                const itemKey = `${finalItemName}_${res.rank}`;
                userData.inventory[itemKey] = (userData.inventory[itemKey] || { name: finalItemName, rank: res.rank, amount: 0 });
                userData.inventory[itemKey].amount++;
                
                status = `✅ Bạn đã nhặt **thành công** **${finalItemName}**!`;
                footer = `🎒 Owned: x${userData.inventory[itemKey].amount} | [AC] You earned 500 PokéCoins!`;

                let nextLevelXP = Math.pow(4, userData.level - 1);
                if (userData.xp >= nextLevelXP) {
                    userData.level++;
                    userData.xp = 0;
                    message.channel.send(`🎊 Chúc mừng **${userName}** lên cấp **${userData.level}**!`);
                }
                speak(message.guild, `Chúc mừng ${userName} nhặt thành công ${finalItemName}`);
            } else {
                status = `❌ Bạn đã nhặt **không thành công** **${finalItemName}**!`;
                footer = res.rank === ValCollect.Trash ? "🤡 Rank thật của bạn!" : "💨 Nó đã chạy thoát...";
            }

            db.save(Object.assign(db.load(), { [userId]: userData }));
            await i.update({ embeds: [createLootEmbed(status, footer, skill.buff)], components: [] });
            collector.stop();
        });
    }   

    // --- CÁC LỆNH VOICE ---
    if (command === 'tjoin') {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return message.reply(`⚠️ Vào voice đã.`);
        joinVoiceChannel({ channelId: voiceChannel.id, guildId: voiceChannel.guild.id, adapterCreator: voiceChannel.guild.voiceAdapterCreator });
        message.reply(`Hi xin chào cả nhà`);
        playLocalFile(message.guild, 'Hi.mp3'); 
    }
    if (command === 'ttest') {
        const agent = Agents[Math.floor(Math.random() * Agents.length)];
        speak(message.guild, `Xác nhận phản hồi từ ${userName}. Đặc vụ đề xuất: ${agent}`);
    }
    if (command === 'tleave') {
        const connection = getVoiceConnection(message.guild.id); // SỬA: Lấy kết nối
        if (connection) {
            playLocalFile(message.guild, 'Bye.mp3'); 
            // Đợi 2s rồi mới destroy để nghe tiếng bye
            setTimeout(() => connection.destroy(), 2000); 
            message.reply(`Chờ xíu tí tao quay lại`);
        } else {
            message.reply(`Có trong room đâu mà cút?`);
        }
    }

    // --- CÁC LỆNH MỚI (随机 SÚNG/AGENT + FIX VOICE) --
    if (command === 'tcoin') {
        const isHeads = Math.random() < 0.5;
        const result = isHeads ? "Mặt xấp" : "Mặt ngửa";
        message.reply(`🪙 **${userName}**: **${result}**`);
        speak(message.guild, `${userName} đã tung đồng xu và nhận được ${result}`);
    }

    if (command === 'tdice') {
        const dice = Math.floor(Math.random() * 6) + 1;
        message.reply(`🎲 **${userName} đã đổ xúc xắc được ${dice}** điểm.`);
        speak(message.guild, `${userName} đã đổ xúc xắc được ${dice} điểm.`);
    }


    if (['tnoi', 'tn','Tn','Tnoi'].includes(command)) {
        // Lấy nội dung sau lệnh (bỏ qua tên lệnh tnoi hoặc tn)
        const content = message.content.split(' ').slice(1).join(' ').trim();
        if (!content) return message.reply("Nói gì nói mẹ đi câm à?");

        // Giới hạn 200 ký tự
        const safeContent = content.length > 190 ? content.substring(0, 190) + "..." : content;

        speak(message.guild, `${userName} nói: ${safeContent}`);
        
        // Phản hồi emoji
        message.react('🗣️').catch(() => {}); 
    }
    

    if (command === 'tdacvu') {
        const randomAgent = Agents[Math.floor(Math.random() * Agents.length)];
        const imagePath = path.join(__dirname, `${randomAgent}.webp`);

        message.reply({
            content: `🎮 **${userName}**, Agent của bạn là: **${randomAgent}**!`,
            files: fs.existsSync(imagePath) ? [new AttachmentBuilder(imagePath)] : []
        }).catch(err => {
            console.error("Lỗi gửi ảnh:", err);
            message.reply(`🎮 **${userName}**, Agent của bạn là: **${randomAgent}** (Không tìm thấy file ảnh).`);
        });

        speak(message.guild, `${userName} Agent của bạn là ${randomAgent}`);
    }



    if (commandList[command]) {
        const type = commandList[command];
        const danhSach = vukhi[type];
        const randomWeapon = danhSach[Math.floor(Math.random() * danhSach.length)];
        
        const imagePath = path.join(__dirname, `${randomWeapon}.webp`);

        if (fs.existsSync(imagePath)) {
            message.reply({
                content: `🔫 **${userName}** chọn nhóm **${type.toUpperCase()}**: **${randomWeapon}**!`,
                files: [new AttachmentBuilder(imagePath)]
            });
        } else {
            message.reply(`🔫 **${userName}**: **${randomWeapon}** (Thiếu file: \`${randomWeapon}.webp\`)`);
        }

        speak(message.guild, `${userName} nhận được ${randomWeapon}`);
    }

    if (command === 'tvukhi' || command === 'tall') {
        const allWeapons = Object.values(vukhi).flat();
        const randomWeapon = allWeapons[Math.floor(Math.random() * allWeapons.length)];
        
        const imagePath = path.join(__dirname, `${randomWeapon}.webp`);

        message.reply({
            content: `🎲 **${userName}** lấy ngẫu nhiên vũ khí: **${randomWeapon}**!`,
            files: fs.existsSync(imagePath) ? [new AttachmentBuilder(imagePath)] : []
        });

        speak(message.guild, `Vũ khí ngẫu nhiên của ${userName} là ${randomWeapon}`);
    }
});


// --- 5. KHỞI TẠO BOT ---
client.once('clientReady', (c) => { // SỬA SỰ KIỆN READY
    console.log(`✅ [SUCCESS] Bot Online: ${c.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

// Server phụ để giữ Bot online (Health check Koyeb/Replit)
const app = express();
app.get('/', (req, res) => res.send('TunaBot is running phăm phăm!'));
// Lấy PORT từ môi trường hoặc mặc định 8000
app.listen(process.env.PORT || 8000, () => console.log("Cổng Health check đã mở."));
