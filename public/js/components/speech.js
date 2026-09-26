// ═══════════════════════════════════════════
// ОЗВУЧКА ТЕКСТА — Web Speech API
// Очередь реплик: новая не перебивает старую, если не попросить (interrupt).
// Длинный текст режется на предложения — Chrome обрывает реплику длиннее ~15 секунд.
// Голос — лучший из русских, который есть в браузере; список голосов часто приходит
// не сразу (voiceschanged), поэтому выбор повторяется, когда он догрузится.
// ═══════════════════════════════════════════

var MUTE_KEY = 'vparit-voice-muted';
var CHUNK_MAX = 180;          // символов в одной реплике
var supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
var voice = null;
var queue = [];               // { text, onEnd }
var current = null;           // реплика, которая звучит сейчас
var watchdog = null;
var unlocked = false;

export function initSpeech() {
    if (!supported) {
        console.warn('[speech] Web Speech API не поддерживается');
        return false;
    }
    pickVoice();
    if (typeof speechSynthesis.addEventListener === 'function') speechSynthesis.addEventListener('voiceschanged', pickVoice);
    else speechSynthesis.onvoiceschanged = pickVoice;
    // iOS и часть браузеров не дают говорить, пока пользователь ни разу не нажал на страницу:
    // при первом касании произносим пустую реплику — дальше озвучка работает и без касаний
    var unlock = function () {
        if (unlocked) return;
        unlocked = true;
        try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { }
    };
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
    document.addEventListener('keydown', unlock, { once: true, capture: true });
    return true;
}

export function isSpeechSupported() { return supported; }

// Лучший русский голос: нейросетевые («Natural», «Online») > Google > Microsoft > остальные
function pickVoice() {
    if (!supported) return;
    var voices = speechSynthesis.getVoices() || [];
    var best = null, bestScore = -1;
    for (var i = 0; i < voices.length; i++) {
        var v = voices[i];
        if (!v.lang || v.lang.toLowerCase().indexOf('ru') !== 0) continue;
        var n = (v.name || '').toLowerCase();
        var score = 1;
        if (/natural|online|neural/.test(n)) score += 4;
        if (/google/.test(n)) score += 3;
        if (/microsoft|svetlana|dariya|pavel|irina|milena|yuri/.test(n)) score += 2;
        if (v.default) score += 0.5;
        if (score > bestScore) { best = v; bestScore = score; }
    }
    voice = best;
}

// ── на этом устройстве звук озвучки можно выключить ──
export function isVoiceMuted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
}
export function setVoiceMuted(muted) {
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { }
    if (muted) stopSpeaking();
}

// ── подготовка текста ──
var VOWELS = /[АЕЁИОУЫЭЮЯAEIOUY]/i;
// Слова КАПСОМ часть голосов читает по буквам. Аббревиатуры без гласных (ЖКХ, СССР) и
// короткие (IQ, ИИ) оставляем как есть, остальное — строчными.
export function speechText(text) {
    var s = String(text || '');
    s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ');
    s = s.replace(/[A-Za-zА-Яа-яЁё]+/g, function (w) {
        if (w.length < 2 || w !== w.toUpperCase() || w === w.toLowerCase()) return w;
        if (w.length <= 2 || !VOWELS.test(w)) return w;
        return w.toLowerCase();
    });
    s = s.replace(/(\d+)\s*\/\s*(\d+)/g, '$1 из $2');
    s = s.replace(/[«»"“”_*#<>[\]{}|~^]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

// Режем на предложения, слишком длинные — по запятым и пробелам
function chunks(text) {
    var out = [];
    var parts = text.split(/(?<=[.!?…])\s+/);
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        while (p.length > CHUNK_MAX) {
            var cut = p.lastIndexOf(', ', CHUNK_MAX);
            if (cut < CHUNK_MAX / 3) cut = p.lastIndexOf(' ', CHUNK_MAX);
            if (cut < CHUNK_MAX / 3) cut = CHUNK_MAX;
            out.push(p.slice(0, cut + 1).trim());
            p = p.slice(cut + 1).trim();
        }
        if (p) out.push(p);
    }
    return out;
}

// ── очередь ──

// speak(text, onEnd, { interrupt }) — поставить в очередь (или прервать всё и сказать сразу)
export function speak(text, onEnd, opts) {
    speakSequence([text], onEnd, opts);
}

// Несколько фраз подряд; onAllDone — когда прозвучала последняя (или озвучка остановлена)
export function speakSequence(texts, onAllDone, opts) {
    opts = opts || {};
    if (!supported || isVoiceMuted()) { if (onAllDone) onAllDone(); return; }
    if (opts.interrupt) stopSpeaking();
    var pieces = [];
    (texts || []).forEach(function (t) { chunks(speechText(t)).forEach(function (c) { pieces.push(c); }); });
    if (!pieces.length) { if (onAllDone) onAllDone(); return; }
    pieces.forEach(function (c, i) {
        queue.push({ text: c, onEnd: i === pieces.length - 1 ? onAllDone : null, pauseAfter: i === pieces.length - 1 ? 0 : 250 });
    });
    // Сразу после cancel() Chrome иногда теряет новую реплику — даём ему мгновение
    if (!current) {
        if (opts.interrupt) setTimeout(function () { if (!current) next(); }, 80);
        else next();
    }
}

function next() {
    clearTimeout(watchdog);
    var item = queue.shift();
    if (!item) { current = null; return; }
    current = item;
    var u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1.0;
    var done = false;
    var finish = function () {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        if (current !== item) return;   // остановили — onEnd уже вызван в stopSpeaking
        current = null;
        if (item.onEnd) item.onEnd();
        if (queue.length) setTimeout(function () { if (!current) next(); }, item.pauseAfter || 0);
    };
    u.onend = finish;
    u.onerror = finish;
    // Синтезатор иногда «зависает» и не присылает onend — не даём очереди встать навсегда
    watchdog = setTimeout(function () {
        try { speechSynthesis.cancel(); } catch (e) { }
        finish();
    }, 4000 + item.text.length * 120);
    try {
        if (speechSynthesis.paused) speechSynthesis.resume();
        speechSynthesis.speak(u);
    } catch (e) { finish(); }
}

export function stopSpeaking() {
    var pending = queue.concat(current ? [current] : []);
    queue = [];
    current = null;
    clearTimeout(watchdog);
    if (supported) { try { speechSynthesis.cancel(); } catch (e) { } }
    pending.forEach(function (it) { if (it.onEnd) it.onEnd(); });
}

export function isSpeaking() {
    return !!current || queue.length > 0;
}
