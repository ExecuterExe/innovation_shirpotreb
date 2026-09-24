// ═══════════════════════════════════════════
// ОДИНОЧНЫЙ РЕЖИМ — тренировка питча
// Настройки колод → случайный стартап → питч на таймере → следующий.
// ═══════════════════════════════════════════
import { state, setState, navigate, escapeHtml } from '../app.js';
import { logoSvg } from '../components/logo.js';
import { burst } from '../components/fx.js';
import { playSound } from '../components/sound.js';

// Звук — приятный бонус: если браузер его не разрешил, таймер всё равно должен идти
function sound(name) { try { playSound(name); } catch (e) { } }

var SETTINGS_KEY = 'vparit-solo-settings';
var DEFAULT_SETTINGS = {
    pseudoMode: false,
    modifier: 'none',
    useReviews: false,
    useTargetAudience: false,
    useHiddenDefects: false,
    usePackaging: false,
    useEvents: false,
    pitchTime: 60,
};

// Настройки запоминаются в браузере: вернулся — всё как было
var soloSettings = loadSettings();

function loadSettings() {
    var s = Object.assign({}, DEFAULT_SETTINGS);
    try {
        var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
        if (saved && typeof saved === 'object') Object.keys(DEFAULT_SETTINGS).forEach(function (k) { if (saved[k] !== undefined) s[k] = saved[k]; });
    } catch (e) { }
    return s;
}
function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(soloSettings)); } catch (e) { }
}

var SOLO_CARD_TYPES = [
    { key: 'adjective', label: 'Прилагательное', emoji: '🎨', color: '#f87171', gradient: 'card-adjective-gradient' },
    { key: 'item', label: 'Предмет', emoji: '📱', color: '#22d3ee', gradient: 'card-item-gradient' },
    { key: 'modifier', label: 'Модификатор', emoji: '📜', color: '#34d399', gradient: 'card-modifier-gradient' },
    { key: 'feature', label: 'Особенность', emoji: '✨', color: '#c084fc', gradient: 'card-feature-gradient' },
    { key: 'targetAudience', label: 'Аудитория', emoji: '🎯', color: '#60a5fa', gradient: 'card-audience-gradient' },
    { key: 'hiddenDefect', label: 'Скрытый дефект', emoji: '⚠️', color: '#fb923c', gradient: 'card-defect-gradient' },
    { key: 'packaging', label: 'Упаковка', emoji: '📦', color: '#2dd4bf', gradient: 'card-packaging-gradient' },
    { key: 'review', label: 'Первый отзыв', emoji: '💬', color: '#fbbf24', gradient: 'card-review-gradient' },
];

var EXTRAS = [
    { key: 'useTargetAudience', card: 'targetAudience', emoji: '🎯', label: 'Целевая аудитория', hint: 'Для кого этот продукт', example: '«Для тех, кто на мели»' },
    { key: 'useHiddenDefects', card: 'hiddenDefect', emoji: '⚠️', label: 'Скрытый дефект', hint: 'Тайный недостаток', example: '«Пищит так, что слышат только собаки»' },
    { key: 'usePackaging', card: 'packaging', emoji: '📦', label: 'Упаковка', hint: 'В чём придёт товар', example: '«Коробка из-под телевизора»' },
    { key: 'useReviews', card: 'review', emoji: '💬', label: 'Первый отзыв', hint: 'Слова первого покупателя', example: '«Теперь я больше сижу дома. Круто!»' },
    { key: 'useEvents', card: null, emoji: '⚡', label: 'Событие', hint: 'Неожиданное условие для питча', example: '«Клиент должен пройти тест из 10 вопросов»' },
];

var MODS = [
    { value: 'none', label: 'Без него', desc: 'классика' },
    { value: 'addition', label: 'Дополнение', desc: '+1 слово' },
    { value: 'metaphor', label: 'Метафора', desc: '+2 слова' },
];

var PITCH_TIMES = [0, 30, 60, 120];

function cardType(key) {
    for (var i = 0; i < SOLO_CARD_TYPES.length; i++) if (SOLO_CARD_TYPES[i].key === key) return SOLO_CARD_TYPES[i];
    return null;
}

// Какие карты выпадут при текущих настройках
function plannedCards(s) {
    var keys = ['adjective', 'item'];
    if (s.pseudoMode) return keys;
    if (s.modifier !== 'none') keys.push('modifier');
    keys.push('feature');
    EXTRAS.forEach(function (x) { if (x.card && s[x.key]) keys.push(x.card); });
    return keys;
}

function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

function fmtTime(sec) {
    return sec >= 60 ? (sec % 60 === 0 ? (sec / 60) + ' мин' : Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2)) : sec + ' с';
}

// ═══════════════════════════════════════════
// НАСТРОЙКИ
// ═══════════════════════════════════════════

export function renderSoloSettings(container) {
    var s = soloSettings;
    var planned = plannedCards(s);

    var html = '';
    html += '<div class="solo-page">';
    html += '<div class="solo-wrap">';

    html += '<button id="btn-solo-back" class="solo-back">← На главную</button>';

    // Hero
    html += '<div class="solo-hero">';
    html += '  <div class="solo-hero-logo">' + logoSvg({ size: 64, animated: true }) + '</div>';
    html += '  <div class="solo-kicker">🎲 Тренировка питча</div>';
    html += '  <h1 class="solo-title">Одиночный режим</h1>';
    html += '  <p class="solo-lead">Собираете колоды — получаете случайный абсурдный стартап — продаёте его вслух на таймере. Потом следующий.</p>';
    html += '</div>';

    // Что выпадет
    html += '<div class="solo-preview">';
    html += '  <div class="solo-preview-head"><span>Ваш продукт будет из</span><b>' + planned.length + ' ' + plural(planned.length, 'карты', 'карт', 'карт') + '</b></div>';
    html += '  <div class="solo-preview-chips">';
    planned.forEach(function (k) {
        var ct = cardType(k);
        html += '<span class="solo-chip" style="--c:' + ct.color + '">' + ct.emoji + ' ' + ct.label + '</span>';
    });
    if (s.useEvents && !s.pseudoMode) html += '<span class="solo-chip solo-chip-event">⚡ + событие</span>';
    html += '  </div>';
    html += '</div>';

    // Основа
    html += '<div class="solo-section">';
    html += '  <div class="solo-section-title">Основа продукта</div>';
    html += '  <label class="solo-tile solo-tile-wide' + (s.pseudoMode ? ' solo-tile-on' : '') + '" style="--c:#60a5fa">';
    html += '    <span class="solo-tile-emoji">🃏</span>';
    html += '    <span class="solo-tile-body"><b>Псевдоинновации</b><span>Только 2 карты: прилагательное + предмет. Быстрые короткие питчи</span></span>';
    html += '    <input type="checkbox" id="solo-pseudo" class="toggle-corp flex-shrink-0"' + (s.pseudoMode ? ' checked' : '') + '>';
    html += '  </label>';
    if (!s.pseudoMode) {
        html += '  <div class="solo-mod">';
        html += '    <div class="solo-mod-label"><b>📜 Модификатор предмета</b><span>Слова после названия: «Утюг СПРАВЕДЛИВОСТИ»</span></div>';
        html += '    <div class="solo-seg">';
        MODS.forEach(function (m) {
            var on = s.modifier === m.value;
            html += '<label class="solo-seg-opt' + (on ? ' solo-seg-on' : '') + '"><input type="radio" name="solo-modifier" value="' + m.value + '" class="solo-modifier-radio sr-only"' + (on ? ' checked' : '') + '><b>' + m.label + '</b><span>' + m.desc + '</span></label>';
        });
        html += '    </div>';
        html += '  </div>';
    }
    html += '</div>';

    // Дополнительные колоды
    if (!s.pseudoMode) {
        html += '<div class="solo-section">';
        html += '  <div class="solo-section-title">Дополнительные колоды <span>усложняют питч</span></div>';
        html += '  <div class="solo-tiles">';
        EXTRAS.forEach(function (x) {
            var on = !!s[x.key];
            var color = x.card ? cardType(x.card).color : '#ffc72c';
            html += '<label class="solo-tile' + (on ? ' solo-tile-on' : '') + '" style="--c:' + color + '">';
            html += '  <span class="solo-tile-emoji">' + x.emoji + '</span>';
            html += '  <span class="solo-tile-body"><b>' + x.label + '</b><span>' + x.hint + '</span><i>' + x.example + '</i></span>';
            html += '  <input type="checkbox" data-solo-extra="' + x.key + '" class="toggle-corp flex-shrink-0"' + (on ? ' checked' : '') + '>';
            html += '</label>';
        });
        html += '  </div>';
        html += '</div>';
    }

    // Таймер питча
    html += '<div class="solo-section">';
    html += '  <div class="solo-section-title">Время на питч <span>таймер на экране продукта</span></div>';
    html += '  <div class="solo-seg solo-seg-time">';
    PITCH_TIMES.forEach(function (sec) {
        var on = s.pitchTime === sec;
        html += '<label class="solo-seg-opt' + (on ? ' solo-seg-on' : '') + '"><input type="radio" name="solo-time" value="' + sec + '" class="solo-time-radio sr-only"' + (on ? ' checked' : '') + '><b>' + (sec ? fmtTime(sec) : 'Без таймера') + '</b></label>';
    });
    html += '  </div>';
    html += '</div>';

    html += '<button id="btn-solo-launch" class="solo-launch">🎲 Сгенерировать продукт</button>';

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    // ── события ──
    var btnBack = container.querySelector('#btn-solo-back');
    if (btnBack) btnBack.addEventListener('click', function () { navigate('welcome'); });

    function rerender() { saveSettings(); renderSoloSettings(container); }

    var pseudo = container.querySelector('#solo-pseudo');
    if (pseudo) pseudo.addEventListener('change', function () { soloSettings.pseudoMode = pseudo.checked; rerender(); });

    container.querySelectorAll('[data-solo-extra]').forEach(function (el) {
        el.addEventListener('change', function () { soloSettings[el.getAttribute('data-solo-extra')] = el.checked; rerender(); });
    });
    container.querySelectorAll('.solo-modifier-radio').forEach(function (r) {
        r.addEventListener('change', function () { soloSettings.modifier = r.value; rerender(); });
    });
    container.querySelectorAll('.solo-time-radio').forEach(function (r) {
        r.addEventListener('change', function () { soloSettings.pitchTime = parseInt(r.value, 10) || 0; rerender(); });
    });

    var btnLaunch = container.querySelector('#btn-solo-launch');
    if (btnLaunch) {
        btnLaunch.addEventListener('click', function () {
            btnLaunch.textContent = '⏳ Собираем стартап…';
            btnLaunch.disabled = true;
            generate(function (ok) {
                if (!ok) {
                    btnLaunch.textContent = '🎲 Сгенерировать продукт';
                    btnLaunch.disabled = false;
                }
            });
        });
    }
}

// ═══════════════════════════════════════════
// ПРОДУКТ
// ═══════════════════════════════════════════

var soloHistory = [];   // прошлые продукты этой сессии
var productNo = 0;
var pitch = { total: 0, left: 0, timer: null, running: false };

function productName(cards) {
    var parts = [];
    ['adjective', 'item', 'modifier'].forEach(function (k) {
        if (cards[k]) parts.push('<span style="color:' + cardType(k).color + '">' + escapeHtml(cards[k]) + '</span>');
    });
    return parts.join(' ');
}

function productPlain(cards) {
    return ['adjective', 'item', 'modifier'].map(function (k) { return cards[k] || ''; }).join(' ').replace(/\s+/g, ' ').trim();
}

function generate(done) {
    fetchSoloCards(function (result) {
        if (!result) { if (done) done(false); return; }
        if (state.soloCards && state.phase === 'soloCards') {
            soloHistory.unshift(productPlain(state.soloCards));
            soloHistory = soloHistory.slice(0, 5);
        }
        productNo++;
        resetPitch();
        setState({ soloCards: result.cards, soloEvent: result.event });
        navigate('soloCards');
        if (done) done(true);
    });
}

export function renderSoloCards(container) {
    var cards = state.soloCards || {};
    var event = state.soloEvent || null;
    var list = [];
    SOLO_CARD_TYPES.forEach(function (ct) { if (cards[ct.key]) list.push({ type: ct, value: cards[ct.key] }); });

    var html = '';
    html += '<div class="solo-page">';
    html += '<div class="solo-wrap solo-wrap-wide">';

    // Верхняя панель
    html += '<div class="solo-bar">';
    html += '  <button id="btn-solo-settings" class="solo-back">← Настройки</button>';
    html += '  <div class="solo-bar-title">Стартап <b>№' + Math.max(1, productNo) + '</b></div>';
    html += '  <button id="btn-solo-home" class="solo-back">На главную</button>';
    html += '</div>';

    // Название продукта
    html += '<div class="solo-product">';
    html += '  <div class="solo-kicker">Сегодня вы продаёте</div>';
    html += '  <div class="solo-product-name">' + productName(cards) + '</div>';
    if (cards.feature) html += '  <div class="solo-product-feature" style="color:' + cardType('feature').color + '">' + escapeHtml(cards.feature) + '</div>';
    html += '</div>';

    if (event) {
        html += '<div class="solo-event"><span>⚡</span><div><b>Событие</b>' + escapeHtml(event) + '</div></div>';
    }

    // Карты
    html += '<div class="solo-cards solo-cards-' + Math.min(list.length, 8) + '">';
    list.forEach(function (c, i) {
        var len = String(c.value).length;
        var size = len <= 12 ? 'solo-card-xl' : len <= 26 ? 'solo-card-l' : len <= 48 ? 'solo-card-m' : 'solo-card-s';
        html += '<div class="solo-card ' + c.type.gradient + ' ' + size + '" style="animation-delay:' + (i * 70) + 'ms">';
        html += '  <div class="solo-card-top">' + c.type.emoji + ' ' + c.type.label + '</div>';
        html += '  <div class="solo-card-value">' + escapeHtml(c.value) + '</div>';
        html += '  <div class="card-shimmer"></div>';
        html += '</div>';
    });
    html += '</div>';

    // Питч на таймере + шпаргалка
    html += '<div class="solo-lower">';
    html += '  <div class="solo-pitch" id="solo-pitch">' + pitchHtml() + '</div>';
    html += '  <div class="solo-tips">';
    html += '    <div class="solo-section-title">Шпаргалка питча</div>';
    [['🎯', 'Кому', 'Для кого этот продукт?'], ['😫', 'Боль', 'Какую проблему решает?'], ['✨', 'Фишка', 'Почему эти карты вместе?'], ['💰', 'Призыв', 'Почему вкладываться сейчас?']].forEach(function (t) {
        html += '<div class="solo-tip"><span>' + t[0] + '</span><div><b>' + t[1] + '</b>' + t[2] + '</div></div>';
    });
    html += '  </div>';
    html += '</div>';

    if (soloHistory.length) {
        html += '<div class="solo-history"><div class="solo-section-title">Уже продавали</div><div class="solo-history-list">';
        soloHistory.forEach(function (h) { html += '<span>' + escapeHtml(h) + '</span>'; });
        html += '</div></div>';
    }

    // Действия — закреплены внизу
    html += '<div class="solo-dock">';
    html += '  <button id="btn-solo-refresh" class="solo-launch solo-launch-dock">🎲 Новый продукт</button>';
    html += '  <span class="solo-dock-hint">или клавиша <kbd>пробел</kbd></span>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    var btnRefresh = container.querySelector('#btn-solo-refresh');
    if (btnRefresh) btnRefresh.addEventListener('click', function () { refreshProduct(btnRefresh); });
    var btnSettings = container.querySelector('#btn-solo-settings');
    if (btnSettings) btnSettings.addEventListener('click', function () { resetPitch(); navigate('soloSettings'); });
    var btnHome = container.querySelector('#btn-solo-home');
    if (btnHome) btnHome.addEventListener('click', function () { resetPitch(); navigate('welcome'); });
    // Экран ещё не вставлен в документ (navigate добавляет его после отрисовки) — ищем внутри контейнера
    bindPitch(container);
}

function refreshProduct(btn) {
    if (!btn || btn.disabled) return;
    btn.textContent = '⏳ Собираем…';
    btn.disabled = true;
    generate(function (ok) {
        if (!ok) { btn.textContent = '🎲 Новый продукт'; btn.disabled = false; }
    });
}

// Пробел — следующий продукт (кроме случаев, когда фокус в поле или на кнопке)
document.addEventListener('keydown', function (e) {
    if (state.phase !== 'soloCards' || e.code !== 'Space' || e.repeat) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT') return;
    e.preventDefault();
    refreshProduct(document.getElementById('btn-solo-refresh'));
});

// ─────────── таймер питча ───────────

function resetPitch() {
    if (pitch.timer) clearInterval(pitch.timer);
    pitch.timer = null;
    pitch.running = false;
    pitch.total = soloSettings.pitchTime || 0;
    pitch.left = pitch.total;
    pitch.finished = false;
}

function pitchHtml() {
    if (!soloSettings.pitchTime) {
        return '<div class="solo-pitch-free"><b>🎤 Питч без таймера</b><span>Продайте продукт вслух — сколько угодно. Таймер включается в настройках.</span></div>';
    }
    if (!pitch.total) resetPitch();
    var frac = pitch.total ? pitch.left / pitch.total : 0;
    var r = 52, circ = 2 * Math.PI * r;
    var cls = pitch.finished ? ' solo-ring-done' : (pitch.left <= 5 && pitch.running ? ' solo-ring-crit' : (pitch.left <= 15 && pitch.running ? ' solo-ring-warn' : ''));
    var html = '<div class="solo-ring' + cls + '">';
    html += '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="' + r + '" class="solo-ring-bg"/><circle cx="60" cy="60" r="' + r + '" class="solo-ring-fg" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + (circ * (1 - frac)).toFixed(1) + '"/></svg>';
    html += '<div class="solo-ring-text" id="solo-ring-text">' + (pitch.finished ? '⏰' : fmtClock(pitch.left)) + '</div>';
    html += '</div>';
    html += '<div class="solo-pitch-side">';
    if (pitch.finished) {
        html += '<b class="solo-pitch-title solo-pitch-title-done">Время!</b><span>Успели продать? Жмите «Новый продукт» — и следующий питч.</span>';
        html += '<button id="btn-pitch-reset" class="solo-pitch-btn">↺ Ещё раз</button>';
    } else if (pitch.running) {
        html += '<b class="solo-pitch-title">Вы в эфире</b><span>Продавайте! Когда закончите — остановите таймер.</span>';
        html += '<button id="btn-pitch-toggle" class="solo-pitch-btn">⏸ Пауза</button>';
    } else {
        html += '<b class="solo-pitch-title">' + (pitch.left < pitch.total ? 'Пауза' : 'Готовы?') + '</b><span>' + fmtTime(pitch.total) + ' на питч. Представьте, что перед вами инвесторы.</span>';
        html += '<button id="btn-pitch-toggle" class="solo-pitch-btn solo-pitch-btn-go">▶ ' + (pitch.left < pitch.total ? 'Продолжить' : 'Начать питч') + '</button>';
        if (pitch.left < pitch.total) html += '<button id="btn-pitch-reset" class="solo-pitch-link">сбросить</button>';
    }
    html += '</div>';
    return html;
}

function fmtClock(sec) {
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
}

function renderPitch() {
    var box = document.getElementById('solo-pitch');
    if (!box) { resetPitch(); return; } // ушли с экрана — таймер больше не нужен
    box.innerHTML = pitchHtml();
    bindPitch(box);
}

function bindPitch(root) {
    var tog = root.querySelector('#btn-pitch-toggle');
    if (tog) tog.addEventListener('click', function () {
        if (pitch.running) {
            clearInterval(pitch.timer);
            pitch.timer = null;
            pitch.running = false;
        } else {
            pitch.running = true;
            pitch.timer = setInterval(tick, 1000);
            sound('start');
        }
        renderPitch();
    });
    var rst = root.querySelector('#btn-pitch-reset');
    if (rst) rst.addEventListener('click', function () { resetPitch(); renderPitch(); });
}

function tick() {
    if (!document.getElementById('solo-pitch')) { resetPitch(); return; }
    pitch.left = Math.max(0, pitch.left - 1);
    if (pitch.left <= 5 && pitch.left > 0) sound('tick');
    if (pitch.left === 0) {
        clearInterval(pitch.timer);
        pitch.timer = null;
        pitch.running = false;
        pitch.finished = true;
        sound('fanfare');
        renderPitch();
        var ring = document.querySelector('.solo-ring');
        if (ring) burst(ring, { count: 18, spread: 160, lift: 40 });
        return;
    }
    // Каждую секунду — только кольцо и цифры, без перерисовки кнопок
    var text = document.getElementById('solo-ring-text');
    var fg = document.querySelector('.solo-ring-fg');
    var ring = document.querySelector('.solo-ring');
    if (text) text.textContent = fmtClock(pitch.left);
    if (fg) {
        var circ = 2 * Math.PI * 52;
        fg.setAttribute('stroke-dashoffset', (circ * (1 - pitch.left / pitch.total)).toFixed(1));
    }
    if (ring) {
        ring.classList.toggle('solo-ring-warn', pitch.left <= 15 && pitch.left > 5);
        ring.classList.toggle('solo-ring-crit', pitch.left <= 5);
    }
}

// ═══════════════════════════════════════════
// API
// ═══════════════════════════════════════════

function fetchSoloCards(callback) {
    var s = soloSettings;
    // «Псевдоинновации» — ровно 2 карты: модификатор и доп. колоды в этом режиме не шлём
    var pseudo = !!s.pseudoMode;
    var on = function (v) { return !pseudo && v ? 'true' : 'false'; };
    var params = new URLSearchParams({
        pseudoMode: pseudo ? 'true' : 'false',
        modifier: pseudo ? 'none' : (s.modifier || 'none'),
        useReviews: on(s.useReviews),
        useTargetAudience: on(s.useTargetAudience),
        useHiddenDefects: on(s.useHiddenDefects),
        usePackaging: on(s.usePackaging),
        useEvents: on(s.useEvents),
    });

    fetch('/api/solo-cards?' + params.toString())
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data && data.cards) callback(data);
            else callback(null);
        })
        .catch(function (err) {
            console.error('[solo] error:', err);
            callback(null);
        });
}
