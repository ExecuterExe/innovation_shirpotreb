// ═══════════════════════════════════════════
// «ЧТО МОЖЕТ ВЫПАСТЬ» — карточка над чатом в лобби
// Классика: случайный продукт ровно из тех карт, что включил хост (и из его тем карт):
//   три карты — прилагательное, предмет, особенность; добавил отзыв — появляется и отзыв, и т.д.
// «Бункер»: начало случайной катастрофы — «…а дальше уже в игре».
// Пример меняется каждые 25 секунд; хост поменял настройки — сразу новый.
// ═══════════════════════════════════════════
import { state, escapeHtml } from '../app.js';

var ROTATE_MS = 25000;
var timer = null;
var lastKey = null;
var reqId = 0;
var shown = null;   // последний пример: { key, html } — чтобы полная перерисовка лобби его не теряла

// Карты руки: цвета — как у карт в игре
var PARTS = [
    { key: 'targetAudience', emoji: '🎯', color: '#60a5fa' },
    { key: 'hiddenDefect', emoji: '⚠️', color: '#fb923c' },
    { key: 'packaging', emoji: '📦', color: '#2dd4bf' },
    { key: 'review', emoji: '💬', color: '#fbbf24', quote: true },
];

function settingsKey(s) {
    s = s || {};
    return JSON.stringify([!!s.bunkerMode, !!s.pseudoMode, s.modifier || 'none', !!s.useReviews, !!s.useTargetAudience,
        !!s.useHiddenDefects, !!s.usePackaging, !!s.useEvents, s.cardSource || 'database', s.cardCategories || {}]);
}

// Вызывается при отрисовке лобби и на каждое обновление настроек
export function syncLobbyTeaser() {
    var box = document.getElementById('lobby-teaser');
    if (!box) { stop(); return; }
    var key = settingsKey(state.settings);
    if (key !== lastKey) {
        lastKey = key;
        load();
        return;
    }
    // Лобби перерисовали целиком — возвращаем тот же пример, без нового запроса
    if (!box.innerHTML && shown && shown.key === key) box.innerHTML = shown.html;
    if (!timer) schedule();
}

function stop() {
    clearTimeout(timer);
    timer = null;
    lastKey = null;
}

function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
        timer = null;
        if (!document.getElementById('lobby-teaser')) { stop(); return; }
        load();
    }, ROTATE_MS);
}

function load() {
    var s = state.settings || {};
    var key = settingsKey(s);
    var my = ++reqId;
    schedule();
    var url;
    if (s.bunkerMode) {
        url = '/api/catastrophe-teaser';
    } else {
        var pseudo = !!s.pseudoMode;
        var on = function (v) { return !pseudo && v ? 'true' : 'false'; };
        url = '/api/solo-cards?' + new URLSearchParams({
            preview: '1',
            pseudoMode: pseudo ? 'true' : 'false',
            modifier: pseudo ? 'none' : (s.modifier || 'none'),
            useReviews: on(s.useReviews),
            useTargetAudience: on(s.useTargetAudience),
            useHiddenDefects: on(s.useHiddenDefects),
            usePackaging: on(s.usePackaging),
            useEvents: on(s.useEvents),
            cats: JSON.stringify(s.cardCategories || {}),
        }).toString();
    }
    fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (my !== reqId) return;   // пока ждали, хост уже поменял настройки
            var box = document.getElementById('lobby-teaser');
            if (!box) return;
            var html = s.bunkerMode ? bunkerHtml(data) : classicHtml(data, s);
            shown = { key: key, html: html };
            box.innerHTML = html;
            bind(box);
        })
        .catch(function () { /* нет сети — оставляем прошлый пример */ });
}

function bind(box) {
    var again = box.querySelector('[data-lt-next]');
    if (again) again.addEventListener('click', load);
}

function head(title) {
    return '<div class="lt-head"><span>' + title + '</span>'
        + '<button type="button" class="lt-next" data-lt-next title="Другой пример">↻</button></div>';
}

// Полоска-таймер до следующего примера
function foot(text) {
    return '<div class="lt-foot"><span>' + text + '</span></div>'
        + '<div class="lt-bar"><i style="animation-duration:' + ROTATE_MS + 'ms"></i></div>';
}

function classicHtml(data, s) {
    var c = (data && data.cards) || {};
    var html = '<div class="lt lt-classic">';
    html += head('🎲 Может выпасть');
    html += '<div class="lt-product">';
    html += '<span style="color:#f87171">' + escapeHtml(c.adjective || '') + '</span> ';
    html += '<span style="color:#22d3ee">' + escapeHtml(c.item || '') + '</span>';
    if (c.modifier) html += ' <span style="color:#34d399">' + escapeHtml(c.modifier) + '</span>';
    html += '</div>';
    if (c.feature) html += '<div class="lt-feature">' + escapeHtml(c.feature) + '</div>';
    var extras = '';
    PARTS.forEach(function (p) {
        if (!c[p.key]) return;
        var v = escapeHtml(c[p.key]);
        extras += '<div class="lt-extra" style="--c:' + p.color + '"><span>' + p.emoji + '</span><b>' + (p.quote ? '«' + v + '»' : v) + '</b></div>';
    });
    if (data && data.event) extras += '<div class="lt-extra" style="--c:#ffc72c"><span>⚡</span><b>' + escapeHtml(data.event) + '</b></div>';
    if (extras) html += '<div class="lt-extras">' + extras + '</div>';
    var n = ['adjective', 'item', 'modifier', 'feature', 'targetAudience', 'hiddenDefect', 'packaging', 'review'].filter(function (k) { return c[k]; }).length;
    html += foot(s.cardSource === 'players'
        ? 'Карты придумываете вы — это пример из нашей базы'
        : n + ' ' + plural(n, 'карта', 'карты', 'карт') + ' в руке · новый пример каждые 25 с');
    html += '</div>';
    return html;
}

function bunkerHtml(data) {
    var html = '<div class="lt lt-bunker">';
    html += head('☢️ Катастрофа может быть такой');
    html += '<div class="lt-disaster">' + escapeHtml((data && data.teaser) || '') + '<span class="lt-more">… а дальше — уже в игре</span></div>';
    html += foot((data && data.total ? data.total + ' ' + plural(data.total, 'сценарий', 'сценария', 'сценариев') + ' конца света' : 'Сценарии конца света') + ' · новый каждые 25 с');
    html += '</div>';
    return html;
}

function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}
