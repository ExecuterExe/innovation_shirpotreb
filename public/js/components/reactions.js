// ═══════════════════════════════════════════
// РЕАКЦИИ ЗАЛА
// Панель из 8 эмодзи (клавиши 1–8, на телефоне — круглая кнопка в углу).
// Реакция всплывает у строки игрока и летит через экран — её видят все.
// Во время выступления сервер копит реакции выступающему: живой счётчик на сцене
// и награда «Любимец зала» в итогах.
// ═══════════════════════════════════════════
import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';

export var REACTIONS = [
    { key: 'laugh',     emoji: '😂', label: 'Смешно' },
    { key: 'fire',      emoji: '🔥', label: 'Огонь' },
    { key: 'clap',      emoji: '👏', label: 'Браво' },
    { key: 'mindblown', emoji: '🤯', label: 'Взрыв мозга' },
    { key: 'scared',    emoji: '😱', label: 'Жуть' },
    { key: 'think',     emoji: '🤔', label: 'Хм…' },
    { key: 'money',     emoji: '💸', label: 'Беру!' },
    { key: 'tomato',    emoji: '🍅', label: 'Помидор' },
];
// От старой версии панели — чтобы чужие старые клиенты тоже отображались
var LEGACY = { love: '😍', angry: '😡' };

export function reactionEmoji(key) {
    for (var i = 0; i < REACTIONS.length; i++) if (REACTIONS[i].key === key) return REACTIONS[i].emoji;
    return LEGACY[key] || '';
}

var lastSentAt = 0;
var COOLDOWN_MS = 280;

export function sendReaction(key) {
    if (!state.roomCode) return false;
    var now = Date.now();
    if (now - lastSentAt < COOLDOWN_MS) return false;
    lastSentAt = now;
    sendMsg({ type: 'playerEmotion', emotion: key });
    return true;
}

// ─── Панель в колонке участников ───
export function buildReactionBarHtml() {
    var html = '<div class="rx-bar" role="group" aria-label="Реакции">';
    for (var i = 0; i < REACTIONS.length; i++) {
        var r = REACTIONS[i];
        html += '<button type="button" class="rx-btn" data-rx="' + r.key + '" title="' + r.label + ' — клавиша ' + (i + 1) + '">';
        html += '<span class="rx-btn-emoji">' + r.emoji + '</span>';
        html += '<span class="rx-btn-key">' + (i + 1) + '</span>';
        html += '</button>';
    }
    html += '</div>';
    return html;
}

export function bindReactionButtons(root) {
    var btns = (root || document).querySelectorAll('[data-rx]');
    for (var i = 0; i < btns.length; i++) {
        (function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (sendReaction(btn.getAttribute('data-rx'))) pressFx(btn);
            });
        })(btns[i]);
    }
}

function pressFx(btn) {
    btn.classList.remove('rx-btn-press');
    void btn.offsetWidth;
    btn.classList.add('rx-btn-press');
}

// ─── Счётчик зала на сцене во время выступления ───
export function buildCrowdMeterHtml(tally) {
    var html = '<div id="crowd-meter" class="crowd-meter">';
    html += innerCrowdMeter(tally);
    html += '</div>';
    return html;
}

function innerCrowdMeter(tally) {
    if (!tally || !tally.total) {
        return '<span class="crowd-meter-hint">Реакции зала появятся здесь</span>';
    }
    var entries = Object.keys(tally.byEmotion).map(function (k) { return [k, tally.byEmotion[k]]; });
    entries.sort(function (a, b) { return b[1] - a[1]; });
    var html = '<span class="crowd-meter-label">Зал</span>';
    for (var i = 0; i < Math.min(entries.length, 5); i++) {
        html += '<span class="crowd-meter-chip" data-meter="' + entries[i][0] + '">' + reactionEmoji(entries[i][0]) + '<b>' + entries[i][1] + '</b></span>';
    }
    return html;
}

function updateCrowdMeter(tally, emotion) {
    var el = document.getElementById('crowd-meter');
    if (!el) return;
    el.innerHTML = innerCrowdMeter(tally);
    var chip = el.querySelector('[data-meter="' + emotion + '"]');
    if (chip) {
        chip.classList.remove('crowd-meter-bump');
        void chip.offsetWidth;
        chip.classList.add('crowd-meter-bump');
    }
}

// ─── Входящая реакция ───
export function showIncomingReaction(msg) {
    var emoji = reactionEmoji(msg.emotion);
    if (!emoji) return;

    // Счётчик выступающего
    if (msg.tally && state.currentPresenter && msg.presenterId === state.currentPresenter.id) {
        state.crowdTally = msg.tally;
        updateCrowdMeter(msg.tally, msg.emotion);
    }

    var row = document.querySelector('[data-rail-player="' + msg.playerId + '"]')
        || document.querySelector('#players-list [data-player-id="' + msg.playerId + '"]');
    if (row && isVisible(row)) rowBubble(row, emoji);
    // На широком экране реакция летит от строки игрока к сцене; на телефоне лента
    // участников вверху — там эмодзи взлетают снизу, как в стримах
    var launchFrom = row && isVisible(row) && window.innerWidth >= 1024 ? row : null;
    flyEmoji(emoji, msg.nickname, launchFrom, msg.playerId === state.playerId);
}

function isVisible(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
}

// Пузырь у строки игрока; одинаковые реакции подряд складываются в «×3»
function rowBubble(row, emoji) {
    var bubble = row.querySelector('.rx-bubble');
    if (bubble && bubble.getAttribute('data-emoji') === emoji) {
        var n = (parseInt(bubble.getAttribute('data-count'), 10) || 1) + 1;
        bubble.setAttribute('data-count', n);
        bubble.innerHTML = emoji + '<span class="rx-bubble-count">×' + n + '</span>';
        bubble.classList.remove('rx-bubble-pop');
        void bubble.offsetWidth;
        bubble.classList.add('rx-bubble-pop');
    } else {
        if (bubble) bubble.remove();
        bubble = document.createElement('span');
        bubble.className = 'rx-bubble rx-bubble-pop';
        bubble.setAttribute('data-emoji', emoji);
        bubble.setAttribute('data-count', '1');
        bubble.textContent = emoji;
        if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
        row.appendChild(bubble);
    }
    clearTimeout(bubble._hide);
    bubble._hide = setTimeout(function () {
        bubble.classList.add('rx-bubble-out');
        setTimeout(function () { if (bubble.parentNode) bubble.remove(); }, 350);
    }, 2200);
}

// Крупный эмодзи летит от строки игрока (или снизу экрана) вверх, с подписью
var MAX_FLYING = 28;
function flyEmoji(emoji, nickname, fromEl, isMine) {
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { }
    var layer = document.getElementById('rx-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'rx-layer';
        document.body.appendChild(layer);
    }
    while (layer.children.length >= MAX_FLYING) layer.removeChild(layer.firstChild);

    var x, y;
    if (fromEl) {
        var r = fromEl.getBoundingClientRect();
        x = r.right - 10;
        y = r.top + r.height / 2;
    } else {
        x = window.innerWidth * (0.3 + Math.random() * 0.4);
        y = window.innerHeight - 40;
    }
    var el = document.createElement('div');
    el.className = 'rx-fly' + (isMine ? ' rx-fly-mine' : '');
    el.innerHTML = '<span class="rx-fly-emoji">' + emoji + '</span>'
        + (nickname ? '<span class="rx-fly-name">' + escapeHtml(nickname) + '</span>' : '');
    // Из колонки слева реакции летят вправо — «в сторону сцены»
    var dx = fromEl ? 120 + Math.random() * 220 : (Math.random() - 0.5) * 160;
    var dy = -(220 + Math.random() * 260);
    el.style.setProperty('--x0', x + 'px');
    el.style.setProperty('--y0', y + 'px');
    el.style.setProperty('--dx', dx.toFixed(0) + 'px');
    el.style.setProperty('--dy', dy.toFixed(0) + 'px');
    el.style.setProperty('--sway', ((Math.random() - 0.5) * 60).toFixed(0) + 'px');
    el.style.setProperty('--rot', ((Math.random() - 0.5) * 40).toFixed(0) + 'deg');
    layer.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2300);
}

// ─── Клавиши 1–8 и кнопка на телефоне ───
function typingNow(e) {
    var t = e.target;
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
}

var REACT_PHASES_EXCLUDE = ['welcome', 'soloSettings', 'soloCards'];

export function reactionsAvailable() {
    return !!state.roomCode && REACT_PHASES_EXCLUDE.indexOf(state.phase) === -1;
}

document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || typingNow(e)) return;
    if (!reactionsAvailable()) return;
    var n = parseInt(e.key, 10);
    if (!(n >= 1 && n <= REACTIONS.length)) return;
    if (sendReaction(REACTIONS[n - 1].key)) {
        var btn = document.querySelector('.rx-bar [data-rx="' + REACTIONS[n - 1].key + '"]');
        if (btn) pressFx(btn);
    }
});

// Круглая кнопка на телефоне: раскрывает ленту эмодзи
export function syncReactionFab() {
    var fab = document.getElementById('rx-fab');
    // В лобби панель реакций и так на странице
    if (!reactionsAvailable() || state.phase === 'lobby') {
        if (fab) fab.remove();
        return;
    }
    if (fab) return;
    fab = document.createElement('div');
    fab.id = 'rx-fab';
    fab.innerHTML = '<div class="rx-fab-tray">' + buildReactionBarHtml() + '</div>'
        + '<button type="button" class="rx-fab-btn" aria-label="Реакции">😀</button>';
    document.body.appendChild(fab);
    bindReactionButtons(fab);
    fab.querySelector('.rx-fab-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        fab.classList.toggle('rx-fab-open');
    });
}

// Клик мимо — лента эмодзи закрывается
document.addEventListener('click', function (e) {
    var fab = document.getElementById('rx-fab');
    if (fab && !fab.contains(e.target)) fab.classList.remove('rx-fab-open');
});
