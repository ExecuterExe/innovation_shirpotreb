// ═══════════════════════════════════════════════════════════════════
// ФОНОВАЯ МУЗЫКА
// Никаких файлов: музыка сочиняется на лету через Web Audio, поэтому
// авторских прав нет и грузить нечего. У каждой фазы игры своё настроение:
//   лобби — лаунж, подготовка — «думаем», питчи — тихая подложка (говорят люди),
//   инвестиции — биржевой нерв, итоги — светлое, бункер — тёмный эмбиент.
// Пока звучит голос игры (озвучка), музыка приглушается.
// Кнопка ♪ в углу экрана открывает панель: вкл/выкл, громкость и режим графики.
// Всё запоминается на устройстве.
// ═══════════════════════════════════════════════════════════════════
import { getAudioCtx, initAudio } from './sound.js';
import { isSpeaking } from './speech.js';
import { isLite, onPerfChange, getPerfMode, setPerfMode } from './perf.js';

var OFF_KEY = 'vparit-music-off';
var VOL_KEY = 'vparit-music-volume';
var volume = 0.75;          // 0..1 — положение ползунка
// Громкость на слух растёт не линейно — квадрат ползунка звучит ровнее. 75% ≈ прежний уровень
function masterLevel() { return 0.85 * volume * volume; }
var LOOKAHEAD = 0.2;        // на сколько секунд вперёд расписываем ноты
var FADE = 1.8;             // смена настроения — плавный переход

var ctx = null;
var master = null;          // общая громкость (вкл/выкл)
var duck = null;            // приглушение под голос
var reverb = null;          // общий «зал»
var noiseBuf = null;

var enabled = true;
var started = false;
var moodName = null;
var bus = null;             // шина текущего настроения — плавно гасится при смене
var step = 0;
var nextTime = 0;
var timer = null;
var ducked = false;

try {
    enabled = localStorage.getItem(OFF_KEY) !== '1';
    var savedVol = parseFloat(localStorage.getItem(VOL_KEY));
    if (savedVol >= 0 && savedVol <= 1) volume = savedVol;
} catch (e) { }

// ── ноты и случайности ──

function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function chance(p) { return Math.random() < p; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── инструменты ──

function env(g, t, peak, attack, hold, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return t + attack + hold + release + 0.05;
}

function out(dest, wet) {
    // Звук идёт и «сухим», и в реверб — так он садится в общий зал
    var g = ctx.createGain();
    g.connect(dest.dry);
    if (wet) {
        var w = ctx.createGain();
        w.gain.value = wet;
        g.connect(w);
        w.connect(dest.wet);
    }
    return g;
}

// Мягкая подушка аккорда
function pad(b, notes, t, dur, vol, bright) {
    var o = out(b, 0.6);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = bright || 900;
    f.Q.value = 0.3;
    f.connect(o);
    var g = ctx.createGain();
    g.connect(f);
    var end = env(g, t, vol || 0.05, Math.min(1.4, dur * 0.4), dur * 0.4, Math.min(2.2, dur * 0.6));
    var voices = isLite() ? [-7] : [-7, 7];
    notes.forEach(function (m) {
        voices.forEach(function (cents, i) {
            var osc = ctx.createOscillator();
            osc.type = i ? 'sawtooth' : 'triangle';
            osc.frequency.value = hz(m);
            osc.detune.value = cents;
            var og = ctx.createGain();
            og.gain.value = i ? 0.35 : 1;
            osc.connect(og); og.connect(g);
            osc.start(t); osc.stop(end);
        });
    });
}

// Электропиано: основной тон + звонкий обертон
function keys(b, notes, t, vol, decay) {
    var o = out(b, 0.45);
    notes.forEach(function (m) {
        var g = ctx.createGain();
        g.connect(o);
        var end = env(g, t, vol || 0.04, 0.006, 0, decay || 1.6);
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = hz(m);
        osc.connect(g);
        osc.start(t); osc.stop(end);
        var bell = ctx.createOscillator();
        bell.type = 'sine';
        bell.frequency.value = hz(m) * 2;
        var bg = ctx.createGain();
        env(bg, t, (vol || 0.04) * 0.35, 0.004, 0, 0.35);
        bell.connect(bg); bg.connect(o);
        bell.start(t); bell.stop(t + 0.5);
    });
}

// Колокольчик для редких мелодических нот
function bell(b, m, t, vol) {
    var o = out(b, 0.8);
    [[1, 1, 1.4], [3.01, 0.25, 0.4]].forEach(function (p) {
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = hz(m) * p[0];
        var g = ctx.createGain();
        var end = env(g, t, (vol || 0.03) * p[1], 0.004, 0, p[2]);
        osc.connect(g); g.connect(o);
        osc.start(t); osc.stop(end);
    });
}

function bass(b, m, t, dur, vol) {
    var o = out(b, 0.05);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    f.connect(o);
    var g = ctx.createGain();
    g.connect(f);
    var end = env(g, t, vol || 0.12, 0.015, dur * 0.5, dur * 0.6);
    ['triangle', 'sine'].forEach(function (type, i) {
        var osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = hz(i ? m - 12 : m);
        osc.connect(g);
        osc.start(t); osc.stop(end);
    });
}

// Короткий щипок для арпеджио
function pluck(b, m, t, vol, bright) {
    var o = out(b, 0.4);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(bright || 2200, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    f.connect(o);
    var g = ctx.createGain();
    g.connect(f);
    var end = env(g, t, vol || 0.035, 0.004, 0, 0.35);
    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz(m);
    osc.connect(g);
    osc.start(t); osc.stop(end);
}

function noise(b, t, dur, type, freq, vol, wet) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    var g = ctx.createGain();
    var end = env(g, t, vol, 0.002, 0, dur);
    src.connect(f); f.connect(g); g.connect(out(b, wet || 0.1));
    src.start(t, Math.random() * 1.5); src.stop(end);
}

function hat(b, t, vol) { noise(b, t, 0.05, 'highpass', 7500, vol || 0.018); }
function clap(b, t, vol) { noise(b, t, 0.14, 'bandpass', 1600, vol || 0.03, 0.4); }

function kick(b, t, vol) {
    var o = out(b, 0);
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    var g = ctx.createGain();
    var end = env(g, t, vol || 0.22, 0.004, 0, 0.32);
    osc.connect(g); g.connect(o);
    osc.start(t); osc.stop(end);
}

// Низкий гул бункера: две расстроенные пилы и медленно «дышащий» фильтр
function drone(b, m, t, dur, vol) {
    var o = out(b, 0.7);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    f.Q.value = 4;
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07 + Math.random() * 0.05;
    var lg = ctx.createGain();
    lg.gain.value = 140;
    lfo.connect(lg); lg.connect(f.frequency);
    f.connect(o);
    var g = ctx.createGain();
    g.connect(f);
    var end = env(g, t, vol || 0.07, dur * 0.3, dur * 0.4, dur * 0.4);
    [-9, 9].forEach(function (c) {
        var osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = hz(m);
        osc.detune.value = c;
        osc.connect(g);
        osc.start(t); osc.stop(end);
    });
    lfo.start(t); lfo.stop(end);
}

// Ветер в вентиляции
function wind(b, t, dur, vol) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(300 + Math.random() * 200, t);
    f.frequency.linearRampToValueAtTime(700 + Math.random() * 500, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(250 + Math.random() * 200, t + dur);
    var g = ctx.createGain();
    var end = env(g, t, vol || 0.03, dur * 0.35, dur * 0.3, dur * 0.35);
    src.connect(f); f.connect(g); g.connect(out(b, 0.5));
    src.start(t); src.stop(end);
}

// ── настроения ──
// chords — аккорды по тактам (MIDI), root — бас. s — шаг 0..15 в такте (шестнадцатые).

var MOODS = {
    // Лобби и главная: корпоративный лаунж, ii–V–I–vi
    lounge: {
        bpm: 82, swing: 0.14, level: 0.9,
        chords: [[53, 57, 60, 64], [53, 57, 59, 64], [52, 55, 59, 62], [55, 59, 60, 64]],
        roots: [38, 43, 36, 45],
        melody: [72, 74, 76, 79, 81, 84],
        play: function (b, s, t, c, r, beat) {
            if (s === 0) keys(b, c, t, 0.028);
            if (s === 10 && chance(0.5)) keys(b, c, t, 0.018, 1.0);
            if (s === 0) bass(b, r, t, beat * 1.5);
            if (s === 7 && chance(0.6)) bass(b, r + 7, t, beat * 0.5, 0.08);
            if (s === 8) bass(b, r, t, beat, 0.1);
            if (s === 0 || s === 8) kick(b, t, 0.16);
            if (s === 11 && chance(0.3)) kick(b, t, 0.1);
            if (s === 4 || s === 12) clap(b, t, 0.016);
            if (s % 2 === 0) hat(b, t, s % 4 === 2 ? 0.016 : 0.009);
            if (s % 2 === 0 && chance(0.1)) bell(b, pick(this.melody), t, 0.022);
        },
    },
    // Ввод карт и подготовка: сосредоточенное арпеджио
    focus: {
        bpm: 96, swing: 0, level: 0.8,
        chords: [[57, 59, 64], [53, 57, 60, 64], [48, 55, 62, 64], [55, 60, 62]],
        roots: [45, 41, 36, 43],
        play: function (b, s, t, c, r, beat) {
            if (s === 0) pad(b, c, t, beat * 4, 0.028, 1100);
            if (s % 2 === 0) {
                var arp = [0, 1, 2, 1, 2, 3, 2, 1];
                var n = c[arp[(s / 2) % arp.length] % c.length] + 12;
                pluck(b, n, t, s % 4 === 0 ? 0.03 : 0.02, 1800);
            }
            if (s === 0 || s === 8) bass(b, r, t, beat * 1.6, 0.09);
            if (s === 6 || s === 14) hat(b, t, 0.012);
            if (s % 4 === 2) hat(b, t, 0.006);
        },
    },
    // Питчи: люди говорят — только тихая подложка
    pitch: {
        bpm: 66, swing: 0, level: 0.55,
        chords: [[52, 55, 59, 60], [48, 52, 55, 57], [53, 57, 60, 64], [55, 59, 62, 64]],
        roots: [36, 45, 41, 43],
        play: function (b, s, t, c, r, beat) {
            if (s === 0) pad(b, c, t, beat * 4.2, 0.03, 800);
            if (s === 0) bass(b, r, t, beat * 3, 0.06);
            if (s === 8 && chance(0.35)) keys(b, [pick(c) + 12], t, 0.014, 2.2);
        },
    },
    // Инвестиции: биржевой нерв, ре минор
    invest: {
        bpm: 114, swing: 0, level: 0.75,
        chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50, 53], [45, 49, 52]],
        roots: [38, 34, 43, 45],
        play: function (b, s, t, c, r, beat) {
            if (s === 0) pad(b, c, t, beat * 4, 0.02, 700);
            var arp = [0, 2, 1, 2];
            pluck(b, c[arp[s % 4] % c.length] + 12, t, s % 4 === 0 ? 0.022 : 0.012, 2600);
            if (s % 2 === 0) bass(b, r, t, beat * 0.4, s % 8 === 0 ? 0.1 : 0.06);
            if (s === 0 || s === 8) kick(b, t, 0.14);
            if (s % 4 === 2) hat(b, t, 0.016);
        },
    },
    // Итоги и финал: светло, I–V–vi–IV
    results: {
        bpm: 92, swing: 0.08, level: 0.85,
        chords: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]],
        roots: [36, 43, 45, 41],
        melody: [72, 74, 76, 79, 81],
        play: function (b, s, t, c, r, beat) {
            if (s === 0 || s === 6 || s === 12) keys(b, c, t, s ? 0.018 : 0.026, 1.2);
            if (s === 0 || s === 10) bass(b, r, t, beat, 0.1);
            if (s === 0 || s === 8) kick(b, t, 0.17);
            if (s === 4 || s === 12) clap(b, t, 0.022);
            if (s % 2 === 0) hat(b, t, 0.01);
            if (s % 4 === 0 && chance(0.28)) bell(b, pick(this.melody), t, 0.025);
        },
    },
    // Ничья и переигровка: напряжённый пульс
    tension: {
        bpm: 100, swing: 0, level: 0.75,
        chords: [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]],
        roots: [40, 36, 33, 35],
        play: function (b, s, t, c, r, beat) {
            if (s === 0) pad(b, c, t, beat * 4, 0.026, 650);
            if (s % 2 === 0) bass(b, r, t, beat * 0.35, s % 8 === 0 ? 0.1 : 0.055);
            if (s === 0 || s === 8) kick(b, t, 0.13);
            if (s % 2 === 1) hat(b, t, 0.007);
            if (s === 12 && chance(0.4)) pluck(b, c[c.length - 1] + 12, t, 0.02);
        },
    },
    // Бункер: тёмный эмбиент — гул, ветер, редкие ноты
    bunker: {
        bpm: 64, swing: 0, level: 0.9,
        chords: [[50, 53, 57], [46, 50, 53, 57], [43, 46, 50], [45, 49, 52]],
        roots: [38, 34, 31, 33],
        scale: [50, 52, 53, 57, 58, 62, 65],
        play: function (b, s, t, c, r, beat, bar) {
            if (s === 0 && bar % 2 === 0) drone(b, 26, t, beat * 8.5, 0.06);
            if (s === 0) pad(b, c, t, beat * 4.3, 0.022, 600);
            if (s === 0 && bar % 4 === 1) wind(b, t, beat * 8, 0.022);
            if (s % 2 === 0 && chance(0.09)) keys(b, [pick(this.scale)], t, 0.022, 2.5);
        },
    },
    // Голосование на вылет: сердцебиение
    bunkerVote: {
        bpm: 72, swing: 0, level: 0.85,
        chords: [[50, 53, 56], [49, 53, 56], [50, 53, 56], [51, 55, 58]],
        roots: [38, 37, 38, 39],
        play: function (b, s, t, c, r, beat, bar) {
            if (s === 0 && bar % 2 === 0) drone(b, 26, t, beat * 8.5, 0.05);
            if (s === 0) pad(b, c, t, beat * 4.2, 0.02, 520);
            if (s === 0 || s === 8) kick(b, t, 0.2);
            if (s === 2 || s === 10) kick(b, t, 0.11);
            if (s % 4 === 0) hat(b, t, 0.006);
            if (s === 12 && chance(0.25)) pluck(b, c[0] + 24, t, 0.016, 1400);
        },
    },
    // Финал бункера: горько-светлый
    bunkerEnd: {
        bpm: 62, swing: 0, level: 0.85,
        chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]],
        roots: [45, 41, 36, 43],
        melody: [69, 72, 74, 76, 79],
        play: function (b, s, t, c, r, beat, bar) {
            if (s === 0) pad(b, c, t, beat * 4.3, 0.03, 900);
            if (s === 0) bass(b, r, t, beat * 3, 0.07);
            if (s === 0 && bar % 4 === 2) wind(b, t, beat * 8, 0.014);
            if (s % 4 === 0 && chance(0.22)) bell(b, pick(this.melody), t, 0.024);
        },
    },
};

var PHASE_MOOD = {
    welcome: 'lounge', lobby: 'lounge', soloSettings: 'lounge',
    cardInput: 'focus', productDraft: 'focus', drawing: 'lounge', naming: 'focus', slogan: 'focus', preparation: 'focus', soloCards: 'focus',
    presentation: 'pitch',
    investing: 'invest', tiebreaker_voting: 'invest',
    results: 'results', gameOver: 'results',
    tied: 'tension', tiebreaker: 'tension',
    bunkerDraft: 'bunker', bunkerReveal: 'bunker', bunkerVoteResult: 'bunker',
    bunkerVote: 'bunkerVote', bunkerTieVote: 'bunkerVote',
    bunkerGameOver: 'bunkerEnd',
};

// ── движок ──

function setup() {
    if (ctx) return true;
    initAudio();
    ctx = getAudioCtx();
    if (!ctx) return false;

    master = ctx.createGain();
    master.gain.value = 0;
    duck = ctx.createGain();
    duck.connect(master);
    // Мягкий лимитер, чтобы наложения не хрипели
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    reverb = ctx.createConvolver();
    buildReverb();
    onPerfChange(buildReverb);
    var rg = ctx.createGain();
    rg.gain.value = 0.55;
    reverb.connect(rg);
    rg.connect(duck);
    return true;
}

// «Зал» из затухающего шума. Самая тяжёлая часть музыки для процессора —
// в облегчённой графике он короче и в моно
function buildReverb() {
    if (!ctx || !reverb) return;
    var lite = isLite();
    var len = Math.floor(ctx.sampleRate * (lite ? 1.1 : 2.8));
    var channels = lite ? 1 : 2;
    var ir = ctx.createBuffer(channels, len, ctx.sampleRate);
    for (var ch = 0; ch < channels; ch++) {
        var data = ir.getChannelData(ch);
        for (var j = 0; j < len; j++) data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 2.6);
    }
    reverb.buffer = ir;
}

function makeBus(level) {
    // Сухой звук и посыл в реверб гасим/поднимаем вместе
    var t = ctx.currentTime;
    var dry = ctx.createGain();
    var wet = ctx.createGain();
    [dry, wet].forEach(function (g) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(level, t + FADE);
    });
    dry.connect(duck);
    wet.connect(reverb);
    return { dry: dry, wet: wet };
}

function dropBus(b) {
    if (!b) return;
    var t = ctx.currentTime;
    [b.dry, b.wet].forEach(function (g) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0.0001, t + FADE);
    });
    setTimeout(function () {
        try { b.dry.disconnect(); b.wet.disconnect(); } catch (e) { }
    }, (FADE + 4) * 1000);
}

function tick() {
    if (!ctx || !bus || !moodName) return;
    var m = MOODS[moodName];

    // Голос игры — музыку тише
    var speaking = isSpeaking();
    if (speaking !== ducked) {
        ducked = speaking;
        duck.gain.cancelScheduledValues(ctx.currentTime);
        duck.gain.setTargetAtTime(speaking ? 0.3 : 1, ctx.currentTime, 0.25);
    }

    // Вкладку свернули и таймеры замедлились — не пытаемся догнать пропущенное
    if (nextTime < ctx.currentTime - 0.1) nextTime = ctx.currentTime + 0.05;

    var sixteenth = 60 / m.bpm / 4;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
        var s = step % 16;
        var bar = Math.floor(step / 16);
        var ci = bar % m.chords.length;
        try { m.play(bus, s, nextTime, m.chords[ci], m.roots[ci], sixteenth * 4, bar); } catch (e) { console.warn('music:', e); }
        var sw = m.swing ? (s % 2 === 0 ? 1 + m.swing : 1 - m.swing) : 1;
        nextTime += sixteenth * sw;
        step++;
    }
}

function applyMood(name) {
    if (!MOODS[name] || name === moodName) return;
    moodName = name;
    dropBus(bus);
    bus = makeBus(MOODS[name].level);
    step = 0;
    nextTime = ctx.currentTime + 0.1;
}

// ── публичное API ──

var pendingPhase = 'welcome';
var roastMode = false;

// Финал-прожарка: подготовка и выступления — на напряжённой теме
function moodFor(phase) {
    if (roastMode && (phase === 'preparation' || phase === 'presentation')) return 'tension';
    return PHASE_MOOD[phase] || 'lounge';
}

export function setMusicRoast(on) {
    roastMode = !!on;
}

// Вызывается при каждой смене экрана
export function setMusicPhase(phase) {
    pendingPhase = phase;
    if (!started) return;
    applyMood(moodFor(phase));
}

// Запуск после первого касания (браузеры не дают играть звук без жеста)
export function startMusic() {
    if (started || !enabled) return;
    if (!setup()) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
    started = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.6);
    applyMood(moodFor(pendingPhase));
    timer = setInterval(tick, 50);
    tick();
}

function stopMusic() {
    if (!started) return;
    started = false;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    clearInterval(timer);
    timer = null;
    dropBus(bus);
    bus = null;
    moodName = null;
}

export function isMusicOn() { return enabled; }

export function getMusicVolume() { return volume; }

export function setMusicVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(VOL_KEY, String(volume)); } catch (e) { }
    if (started && master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.08);
    }
    syncButton();
}

export function setMusicOn(on) {
    enabled = !!on;
    try { localStorage.setItem(OFF_KEY, enabled ? '0' : '1'); } catch (e) { }
    if (enabled) startMusic(); else stopMusic();
    syncButton();
}

// ── кнопка ♪ — всегда в углу экрана, открывает панель звука и графики ──

var btn = null;
var panel = null;

function syncButton() {
    if (!btn) return;
    var silent = !enabled || volume === 0;
    btn.classList.toggle('music-fab-off', silent);
    btn.setAttribute('aria-expanded', panel && !panel.hidden ? 'true' : 'false');
    var label = 'Музыка и графика' + (silent ? ' (музыка выключена)' : '');
    btn.setAttribute('aria-label', label);
    btn.title = label;
    if (!panel) return;
    var on = panel.querySelector('#mp-on');
    if (on) on.checked = enabled;
    var vol = panel.querySelector('#mp-vol');
    if (vol && document.activeElement !== vol) vol.value = Math.round(volume * 100);
    var val = panel.querySelector('#mp-vol-val');
    if (val) val.textContent = Math.round(volume * 100) + '%';
    panel.classList.toggle('mp-muted', !enabled);
    var m = getPerfMode();
    panel.querySelectorAll('[data-perf]').forEach(function (b) { b.classList.toggle('mp-on', b.getAttribute('data-perf') === m); });
    var note = panel.querySelector('#mp-perf-note');
    if (note) note.textContent = m === 'auto'
        ? 'Сейчас: ' + (isLite() ? 'облегчённая — устройству так легче' : 'полная')
        : (m === 'lite' ? 'Без частиц, размытия и лишних анимаций' : 'Все эффекты включены');
}

function panelHtml() {
    var html = '<div class="mp-title">Звук и графика</div>';
    html += '<label class="mp-row mp-switch"><span>🎵 Фоновая музыка</span><input type="checkbox" id="mp-on"><i></i></label>';
    html += '<div class="mp-row mp-vol-row"><span class="mp-vol-icon" aria-hidden="true">🔈</span>'
        + '<input type="range" id="mp-vol" min="0" max="100" step="5" aria-label="Громкость музыки">'
        + '<span id="mp-vol-val" class="mp-vol-val"></span></div>';
    html += '<div class="mp-sep"></div>';
    html += '<div class="mp-label">⚡ Графика</div>';
    html += '<div class="mp-seg" role="radiogroup" aria-label="Графика">'
        + '<button type="button" data-perf="auto">Авто</button>'
        + '<button type="button" data-perf="lite">Лёгкая</button>'
        + '<button type="button" data-perf="full">Полная</button></div>';
    html += '<div id="mp-perf-note" class="mp-note"></div>';
    return html;
}

function openPanel(open) {
    if (!panel) return;
    panel.hidden = !open;
    syncButton();
}

export function mountMusicButton() {
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'music-fab';
    btn.type = 'button';
    btn.className = 'music-fab';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = '<span class="music-fab-note" aria-hidden="true">♪</span>'
        + '<span class="music-fab-eq" aria-hidden="true"><i></i><i></i><i></i></span>'
        + '<span class="music-fab-slash" aria-hidden="true"></span>';
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        // Нажатие на ♪ — тоже жест пользователя: если музыка включена, пусть заиграет сразу
        startMusic();
        openPanel(panel.hidden);
    });
    document.body.appendChild(btn);

    panel = document.createElement('div');
    panel.id = 'music-panel';
    panel.className = 'music-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Звук и графика');
    panel.hidden = true;
    panel.innerHTML = panelHtml();
    document.body.appendChild(panel);

    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    panel.querySelector('#mp-on').addEventListener('change', function (e) {
        setMusicOn(e.target.checked);
        // Первое касание могло прийти именно сюда — звук разблокирован
        if (e.target.checked) startMusic();
    });
    var vol = panel.querySelector('#mp-vol');
    vol.addEventListener('input', function () {
        setMusicVolume(parseInt(vol.value, 10) / 100);
        // Двигают ползунок при выключенной музыке — значит, хотят её слышать
        if (!enabled && volume > 0) setMusicOn(true);
    });
    panel.querySelectorAll('[data-perf]').forEach(function (b) {
        b.addEventListener('click', function () { setPerfMode(b.getAttribute('data-perf')); });
    });
    onPerfChange(syncButton);
    document.addEventListener('click', function () { if (!panel.hidden) openPanel(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) openPanel(false); });
    syncButton();

    // Свёрнутая вкладка — музыка на паузе, вернулись — играет дальше
    document.addEventListener('visibilitychange', function () {
        if (!ctx || !started) return;
        if (document.hidden) ctx.suspend && ctx.suspend();
        else ctx.resume && ctx.resume();
    });
}
