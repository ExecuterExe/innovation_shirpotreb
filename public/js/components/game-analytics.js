// ═══════════════════════════════════════════
// РАЗБОР ПАРТИИ — отчёт после игры (включается галочкой «Разбор партии» в лобби)
// Данные собирает сервер (buildClassicAnalytics / buildBunkerAnalytics), здесь — показ по вкладкам:
//   классика: Обзор · Раунды · Питчи · Инвесторы · Игроки · Зал
//   «Бункер»: Обзор · Хроника · Голоса · Карты · Игроки
// плюс выгрузка в CSV для Excel.
// ═══════════════════════════════════════════
import { state, escapeHtml } from '../app.js';
import { reactionEmoji } from './reactions.js';
import { BUNKER_CARD_TYPES, bkColor } from '../screens/bunker-game.js';

// ─────────── утилиты ───────────
function hue(id) {
    var h = 0, s = String(id || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
}
function color(id) { return 'hsl(' + hue(id) + ',75%,62%)'; }
function esc(s) { return escapeHtml(String(s == null ? '' : s)); }
function plural(n, one, few, many) {
    var m10 = Math.abs(n) % 10, m100 = Math.abs(n) % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}
function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m ? m + ' мин' + (s ? ' ' + s + ' с' : '') : s + ' с';
}
function fmtSec(v) { return v == null ? '—' : (Math.round(v) + ' с'); }
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
function sum(arr) { return arr.reduce(function (a, b) { return a + (b || 0); }, 0); }

// Лидер по показателю. Номинация честная: если у всех одинаково — её нет, ничья двоих — оба в подписи
function best(list, key, opts) {
    opts = opts || {};
    var elig = list.filter(function (p) {
        var v = p[key];
        if (v == null || (opts.min !== undefined && v < opts.min)) return false;
        return !opts.filter || opts.filter(p);
    });
    if (!elig.length) return null;
    var bestV = elig.reduce(function (m, p) { return opts.lowest ? Math.min(m, p[key]) : Math.max(m, p[key]); }, opts.lowest ? Infinity : -Infinity);
    var winners = elig.filter(function (p) { return p[key] === bestV; });
    if (winners.length > 2 || (winners.length > 1 && winners.length === list.length)) return null;
    return Object.assign({}, winners[0], { nickname: winners.map(function (p) { return p.nickname; }).join(' и ') });
}
function cardType(key) {
    for (var i = 0; i < BUNKER_CARD_TYPES.length; i++) if (BUNKER_CARD_TYPES[i].key === key) return BUNKER_CARD_TYPES[i];
    return { key: key, label: key, emoji: '🃏' };
}
function productName(cards) {
    if (!cards) return '';
    return [cards.adjective, cards.item, cards.modifier].filter(Boolean).join(' ');
}
var EMO_ORDER = ['laugh', 'fire', 'clap', 'mindblown', 'money', 'love', 'think', 'scared', 'angry', 'tomato'];

// ─────────── тизер на экране финала ───────────
export function analyticsTeaserHtml(data) {
    if (!data) return '';
    var awards = data.mode === 'bunker' ? bunkerAwards(data) : classicAwards(data);
    var insights = data.mode === 'bunker' ? bunkerInsights(data) : classicInsights(data);
    var html = '<div class="ga-teaser">';
    html += '<div class="ga-teaser-head"><div><div class="ga-kicker">📊 Разбор партии</div><div class="ga-teaser-title">Что на самом деле происходило за игру</div></div>';
    html += '<button class="ga-open-btn" data-ga-open>Открыть разбор →</button></div>';
    if (insights.length) html += '<div class="ga-teaser-insight">💡 ' + insights[0] + '</div>';
    if (awards.length) {
        html += '<div class="ga-teaser-awards">';
        awards.slice(0, 3).forEach(function (a) {
            html += '<div class="ga-mini-award"><span>' + a.emoji + '</span><div><b>' + esc(a.title) + '</b><i>' + esc(a.who) + '</i></div></div>';
        });
        html += '</div>';
    }
    html += '<div class="ga-teaser-more">' + (awards.length > 3 ? '+ ещё ' + (awards.length - 3) + ' ' + plural(awards.length - 3, 'номинация', 'номинации', 'номинаций') + ' · ' : '') + (data.mode === 'bunker' ? 'хроника, блоки и вражда, стратегии раскрытий' : 'раунды, продукты, стиль инвесторов, связи') + '</div>';
    html += '</div>';
    return html;
}

export function bindAnalyticsTeaser(root, data) {
    (root || document).querySelectorAll('[data-ga-open]').forEach(function (b) {
        b.addEventListener('click', function () { openAnalytics(data); });
    });
}

// ─────────── окно отчёта с вкладками ───────────
var gaTab = 'overview';

export function openAnalytics(data, tab) {
    if (!data) return;
    closeAnalytics();
    gaTab = tab || 'overview';
    var wrap = document.createElement('div');
    wrap.id = 'ga-view';
    wrap.className = 'ga-view';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Разбор партии');
    document.body.appendChild(wrap);
    document.body.classList.add('ga-open');
    renderReport(wrap, data);
    document.addEventListener('keydown', escClose);
}
function escClose(e) { if (e.key === 'Escape') closeAnalytics(); }
export function closeAnalytics() {
    var v = document.getElementById('ga-view');
    if (v) v.remove();
    document.body.classList.remove('ga-open');
    document.removeEventListener('keydown', escClose);
}

function renderReport(wrap, d) {
    var bunker = d.mode === 'bunker';
    var tabs = bunker
        ? [['overview', '✨ Обзор'], ['chronicle', '🕰 Хроника'], ['votes', '🗳 Голоса'], ['cards', '🃏 Карты'], ['players', '👤 Игроки']]
        : [['overview', '✨ Обзор'], ['rounds', '🔁 Раунды'], ['pitches', '🎤 Питчи'], ['investors', '💼 Инвесторы'], ['players', '👤 Игроки']];
    if (!bunker && hasHall(d)) tabs.push(['hall', '👀 Зал']);
    if (!tabs.some(function (t) { return t[0] === gaTab; })) gaTab = 'overview';
    var html = '<div class="ga-page">';
    html += bunker
        ? headerHtml('Бункер · ' + d.rounds + ' ' + plural(d.rounds, 'раунд', 'раунда', 'раундов'), 'Игроков: ' + d.players.length + ' · мест в бункере: ' + d.survivorsCount + ' · длительность ' + fmtDur(d.durationSec))
        : headerHtml('Классика · ' + d.rounds + ' ' + plural(d.rounds, 'раунд', 'раунда', 'раундов'), 'Игроков: ' + d.players.length + ' · длительность ' + fmtDur(d.durationSec) + (state.roomCode ? ' · комната ' + esc(state.roomCode) : ''));
    html += '<nav class="ga-tabs" role="tablist">';
    tabs.forEach(function (t) { html += '<button class="ga-tab' + (t[0] === gaTab ? ' ga-tab-on' : '') + '" role="tab" aria-selected="' + (t[0] === gaTab) + '" data-ga-tab="' + t[0] + '">' + t[1] + '</button>'; });
    html += '</nav>';
    html += '<div class="ga-body">' + (bunker ? bunkerTab(d, gaTab) : classicTab(d, gaTab)) + '</div>';
    html += '</div>';
    wrap.innerHTML = html;
    wrap.querySelector('#ga-close').addEventListener('click', closeAnalytics);
    wrap.querySelector('#ga-csv').addEventListener('click', function () { downloadCsv(d); });
    wrap.querySelectorAll('[data-ga-tab]').forEach(function (b) {
        b.addEventListener('click', function () { gaTab = b.getAttribute('data-ga-tab'); renderReport(wrap, d); wrap.scrollTop = 0; });
    });
}

function headerHtml(title, sub) {
    var html = '<div class="ga-top">';
    html += '<div><div class="ga-kicker">📊 Разбор партии</div><h2 class="ga-title">' + title + '</h2><div class="ga-sub">' + sub + '</div></div>';
    html += '<div class="ga-top-actions"><button class="ga-btn" id="ga-csv">⬇ Таблица для Excel</button><button class="ga-close" id="ga-close" aria-label="Закрыть">✕</button></div>';
    html += '</div>';
    return html;
}

function tiles(list) {
    var html = '<div class="ga-tiles">';
    list.forEach(function (t) {
        if (t[1] === null || t[1] === undefined) return;
        html += '<div class="ga-tile"><span class="ga-tile-emoji">' + t[0] + '</span><b>' + t[1] + '</b><i>' + t[2] + '</i></div>';
    });
    html += '</div>';
    return html;
}
function section(title, note, body, cls) {
    return '<section class="ga-section' + (cls ? ' ' + cls : '') + '"><h3 class="ga-h">' + title + '</h3>' + (note ? '<p class="ga-note">' + note + '</p>' : '') + body + '</section>';
}
function insightsHtml(list) {
    if (!list.length) return '';
    return section('💡 Главное за партию', '', '<ul class="ga-insights">' + list.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>');
}
function awardsHtml(awards) {
    if (!awards.length) return '';
    var html = '<div class="ga-awards">';
    awards.forEach(function (a, i) {
        html += '<div class="ga-award" style="animation-delay:' + (i * 50) + 'ms"><div class="ga-award-emoji">' + a.emoji + '</div>';
        html += '<div class="ga-award-title">' + esc(a.title) + '</div><div class="ga-award-who">' + esc(a.who) + '</div><div class="ga-award-why">' + esc(a.why) + '</div></div>';
    });
    html += '</div>';
    return section('🏅 Номинации', '', html);
}
function metric(emoji, label, value, hint) {
    return '<div class="ga-metric"' + (hint ? ' title="' + esc(hint) + '"' : '') + '><span>' + emoji + '</span><i>' + label + '</i><b>' + value + '</b></div>';
}
function avatar(p) { return '<span class="ga-avatar" style="background:' + color(p.id) + '">' + esc((p.nickname || '?').charAt(0).toUpperCase()) + '</span>'; }
function nameDot(p) { return '<span class="ga-dot" style="background:' + color(p.id) + '"></span>' + esc(p.nickname); }

// Горизонтальные полосы «значение из максимума»
function hbars(rows, unit) {
    if (!rows.length) return '<div class="ga-empty">Нет данных</div>';
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    return '<div class="ga-hbars">' + rows.map(function (r) {
        return '<div class="ga-hbar"><span class="ga-hbar-label">' + r.label + '</span><span class="ga-hbar-track"><i style="width:' + Math.max(2, r.v / max * 100) + '%;background:' + (r.color || '#ffc72c') + '"></i></span><b>' + r.v + (unit || '') + '</b></div>';
    }).join('') + '</div>';
}

// Сколько времени на что ушло — одна полоса из сегментов
function stackBar(parts) {
    var total = sum(parts.map(function (p) { return p.v; }));
    if (!total) return '<div class="ga-empty">Нет данных</div>';
    var html = '<div class="ga-stack">' + parts.filter(function (p) { return p.v > 0; }).map(function (p) {
        return '<i style="width:' + (p.v / total * 100) + '%;background:' + p.color + '" title="' + esc(p.label) + ': ' + fmtDur(p.v) + '"></i>';
    }).join('') + '</div><div class="ga-stack-legend">';
    parts.forEach(function (p) { if (p.v > 0) html += '<span><em style="background:' + p.color + '"></em>' + p.label + ' <b>' + fmtDur(p.v) + '</b> · ' + pct(p.v, total) + '%</span>'; });
    return html + '</div>';
}

// Тепловая карта «кто → кому»
function matrixHtml(players, matrix, rowLabel, cellUnit) {
    var max = 0;
    Object.keys(matrix).forEach(function (a) { Object.keys(matrix[a]).forEach(function (b) { max = Math.max(max, matrix[a][b]); }); });
    if (!max) return '<div class="ga-empty">Нет данных</div>';
    var html = '<div class="ga-matrix-wrap"><table class="ga-matrix"><thead><tr><th class="ga-corner">' + rowLabel + '</th>';
    players.forEach(function (p) { html += '<th>' + nameDot(p) + '</th>'; });
    html += '<th class="ga-corner">всего</th></tr></thead><tbody>';
    players.forEach(function (row) {
        html += '<tr><th>' + nameDot(row) + '</th>';
        var rowSum = 0;
        players.forEach(function (col) {
            if (row.id === col.id) { html += '<td class="ga-self">·</td>'; return; }
            var v = (matrix[row.id] && matrix[row.id][col.id]) || 0;
            rowSum += v;
            var a = v / max;
            html += '<td' + (v ? ' style="background:rgba(255,199,44,' + (0.12 + a * 0.68).toFixed(2) + ');color:' + (a > 0.55 ? '#15151e' : '#f0f0f5') + '"' : '') + ' title="' + esc(row.nickname) + ' → ' + esc(col.nickname) + ': ' + v + ' ' + cellUnit + '">' + (v || '') + '</td>';
        });
        html += '<td class="ga-sum">' + rowSum + '</td></tr>';
    });
    html += '<tr><th class="ga-corner">получил</th>';
    players.forEach(function (col) {
        var s = 0;
        players.forEach(function (row) { s += (matrix[row.id] && matrix[row.id][col.id]) || 0; });
        html += '<td class="ga-sum">' + s + '</td>';
    });
    html += '<td class="ga-sum"></td></tr></tbody></table></div>';
    return html;
}

// Линии по раундам (капитал) или «лесенка» мест (invert — первое место сверху)
function lineChart(series, labels, opts) {
    opts = opts || {};
    var n = labels.length;
    if (n < 2) return '<div class="ga-empty">Нужно хотя бы два раунда</div>';
    var max = opts.max || 1, min = opts.min || 0;
    if (!opts.max) series.forEach(function (s) { s.values.forEach(function (v) { max = Math.max(max, v || 0); }); });
    var W = 640, H = 240, L = 34, R = 118, T = 16, B = 30;
    var x = function (i) { return L + (W - L - R) * (i / (n - 1)); };
    var y = function (v) { var f = (v - min) / ((max - min) || 1); return T + (H - T - B) * (opts.invert ? f : 1 - f); };
    var svg = '<svg class="ga-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || 'график') + '">';
    var ticks = opts.ticks || [0, 0.25, 0.5, 0.75, 1].map(function (f) { return Math.round(min + (max - min) * f); });
    ticks.forEach(function (gv) { var gy = y(gv); svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" class="ga-grid"/><text x="' + (L - 6) + '" y="' + (gy + 4) + '" class="ga-axis" text-anchor="end">' + (opts.tickFmt ? opts.tickFmt(gv) : gv) + '</text>'; });
    labels.forEach(function (lb, i) { svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" class="ga-axis" text-anchor="middle">' + lb + '</text>'; });
    var ends = series.map(function (s) { return { s: s, y: y(s.values[s.values.length - 1] || 0) }; }).sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;
    series.forEach(function (s) {
        var pts = s.values.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v || 0).toFixed(1); }).join(' ');
        svg += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" class="ga-line"/>';
        s.values.forEach(function (v, i) { svg += '<circle cx="' + x(i) + '" cy="' + y(v || 0) + '" r="4" fill="' + s.color + '"><title>' + esc(s.name) + ': ' + v + '</title></circle>'; });
    });
    ends.forEach(function (e) {
        var last = e.s.values[e.s.values.length - 1];
        svg += '<text x="' + (W - R + 8) + '" y="' + (e.y + 4) + '" class="ga-label" fill="' + e.s.color + '">' + esc(e.s.name.slice(0, 11)) + ' · ' + (opts.lastFmt ? opts.lastFmt(last) : last) + '</text>';
    });
    return svg + '</svg>';
}

function bars(values, colorCss, labelFn) {
    var max = Math.max.apply(null, values.concat([1]));
    return '<div class="ga-bars">' + values.map(function (v, i) {
        return '<span title="' + (labelFn ? labelFn(i) : 'Раунд ' + (i + 1)) + ': ' + v + '"><i style="height:' + Math.max(4, v / max * 100) + '%;background:' + colorCss + '"></i><em>' + v + '</em><small>Р' + (i + 1) + '</small></span>';
    }).join('') + '</div>';
}

function corrText(r, what, good) {
    if (r == null) return null;
    var a = Math.abs(r);
    if (a < 0.3) return { tone: 'none', text: what + ' почти не влияли на вложения' };
    var strength = a >= 0.6 ? 'сильно' : 'заметно';
    return { tone: r > 0 ? 'up' : 'down', text: r > 0 ? good + ' — ' + strength + ' чаще собирали больше вложений' : good + ' — ' + strength + ' реже собирали вложения' };
}

// ═══════════════════ КЛАССИКА ═══════════════════

function hasHall(d) {
    var t = d.totals || {};
    return !!(t.reactionsSpectators || t.reactionsTwitch || t.audienceVotes || t.peakViewers || d.chatSpectators);
}

function classicAwards(d) {
    var P = d.players, out = [], a;
    if ((a = best(P, 'accuracy', { filter: function (p) { return p.invested >= 3; }, min: 1 }))) out.push({ emoji: '🎯', title: 'Снайпер', who: a.nickname, why: a.accuracy + '% жетонов — на победителей раундов' });
    var peak = null;
    (d.pitchRows || []).forEach(function (r) { if (r.attracted > 0 && (!peak || r.attracted > peak.attracted)) peak = r; });
    if (peak) out.push({ emoji: '🚀', title: 'Пиковый питч', who: peak.nickname, why: peak.attracted + ' ' + plural(peak.attracted, 'жетон', 'жетона', 'жетонов') + ' за раунд ' + peak.round });
    // Камбэк: сильнее всех поднялся по местам от первого раунда к последнему
    var comeback = null;
    P.forEach(function (p) {
        var rk = p.rankByRound || [];
        if (rk.length < 2) return;
        var up = rk[0] - rk[rk.length - 1];
        if (up > 0 && (!comeback || up > comeback.up)) comeback = { p: p, up: up, from: rk[0], to: rk[rk.length - 1] };
    });
    if (comeback) out.push({ emoji: '📈', title: 'Камбэк', who: comeback.p.nickname, why: 'поднялся с ' + comeback.from + ' места на ' + comeback.to + ' по капиталу' });
    if ((a = best(P, 'invested', { min: 1 }))) out.push({ emoji: '💎', title: 'Меценат', who: a.nickname, why: 'вложил в чужие идеи ' + a.invested + ' ' + plural(a.invested, 'жетон', 'жетона', 'жетонов') });
    if ((a = best(P, 'allIn', { min: 1 }))) out.push({ emoji: '🎰', title: 'Ва-банк', who: a.nickname, why: a.allIn + ' ' + plural(a.allIn, 'раз', 'раза', 'раз') + ' вкладывал почти весь капитал' });
    if ((a = best(P, 'spendShare', { lowest: true, filter: function (p) { return p.spendShare != null; } }))) out.push({ emoji: '🐿', title: 'Копилка', who: a.nickname, why: 'вкладывал в среднем ' + a.spendShare + '% капитала — самый осторожный' });
    if ((a = best(P, 'spreadAvg', { min: 2 }))) out.push({ emoji: '🧺', title: 'Диверсификатор', who: a.nickname, why: 'раскладывал жетоны на ' + a.spreadAvg + ' ' + plural(Math.round(a.spreadAvg), 'проект', 'проекта', 'проектов') + ' за раунд' });
    if ((a = best(P, 'investSpeedAvg', { lowest: true, filter: function (p) { return p.investSpeedAvg > 0; } }))) out.push({ emoji: '⏱', title: 'Решительный', who: a.nickname, why: 'подтверждал вложения за ' + Math.round(a.investSpeedAvg) + ' с' });
    var ally = null;
    P.forEach(function (x) {
        P.forEach(function (y) {
            if (x.id >= y.id) return;
            var ab = (d.matrix[x.id] && d.matrix[x.id][y.id]) || 0, ba = (d.matrix[y.id] && d.matrix[y.id][x.id]) || 0;
            var score = Math.min(ab, ba);
            if (score > 0 && (!ally || score > ally.score)) ally = { x: x, y: y, ab: ab, ba: ba, score: score };
        });
    });
    if (ally) out.push({ emoji: '🤝', title: 'Союз', who: ally.x.nickname + ' ⇄ ' + ally.y.nickname, why: 'поддерживали друг друга: ' + ally.ab + ' и ' + ally.ba + ' жетонов' });
    if ((a = best(P, 'reciprocity', { min: 2 }))) out.push({ emoji: '🔁', title: 'Взаимность', who: a.nickname, why: a.reciprocity + ' ' + plural(a.reciprocity, 'раз', 'раза', 'раз') + ' вкладывал в тех, кто вкладывал в него' });
    if ((a = best(P, 'reactions', { min: 1 }))) out.push({ emoji: '❤️', title: 'Любимец зала', who: a.nickname, why: a.reactions + ' ' + plural(a.reactions, 'реакция', 'реакции', 'реакций') + ' на выступления' });
    var laughs = P.map(function (p) { return Object.assign({}, p, { laughs: (p.reactionsBy || {}).laugh || 0, tomatoes: (p.reactionsBy || {}).tomato || 0 }); });
    if ((a = best(laughs, 'laughs', { min: 2 }))) out.push({ emoji: '😂', title: 'Комик', who: a.nickname, why: a.laughs + ' раз зал смеялся над питчем' });
    if ((a = best(laughs, 'tomatoes', { min: 2 }))) out.push({ emoji: '🍅', title: 'Помидорный магнит', who: a.nickname, why: 'поймал ' + a.tomatoes + ' ' + plural(a.tomatoes, 'помидор', 'помидора', 'помидоров') + ' — зал спорил' });
    if (d.questionsOn && (a = best(P, 'questionsReceived', { min: 1 }))) out.push({ emoji: '🙋', title: 'Под обстрелом', who: a.nickname, why: a.questionsReceived + ' ' + plural(a.questionsReceived, 'вопрос', 'вопроса', 'вопросов') + ' после питчей' });
    if ((a = best(P, 'firstHands', { min: 2 }))) out.push({ emoji: '✋', title: 'Первая рука', who: a.nickname, why: a.firstHands + ' ' + plural(a.firstHands, 'раз', 'раза', 'раз') + ' первым поднимал руку' });
    else if ((a = best(P, 'handsRaised', { min: 1 }))) out.push({ emoji: '🧐', title: 'Самый любопытный', who: a.nickname, why: 'поднимал руку ' + a.handsRaised + ' ' + plural(a.handsRaised, 'раз', 'раза', 'раз') });
    if ((a = best(P, 'readyAvg', { lowest: true, filter: function (p) { return p.readyAvg > 0; } }))) out.push({ emoji: '⚡', title: 'Скорострел', who: a.nickname, why: 'готов к питчу за ' + Math.round(a.readyAvg) + ' с в среднем' });
    if ((a = best(P, 'reactionsSent', { min: 3 }))) out.push({ emoji: '📣', title: 'Заводила', who: a.nickname, why: 'отправил ' + a.reactionsSent + ' ' + plural(a.reactionsSent, 'реакцию', 'реакции', 'реакций') + ' другим' });
    if ((a = best(P, 'chat', { min: 3 }))) out.push({ emoji: '🗣', title: 'Душа чата', who: a.nickname, why: a.chat + ' ' + plural(a.chat, 'сообщение', 'сообщения', 'сообщений') + ' в чате' });
    if ((a = best(P, 'audienceVotes', { min: 1 }))) out.push({ emoji: '🎟', title: 'Выбор зрителей', who: a.nickname, why: a.audienceVotes + ' ' + plural(a.audienceVotes, 'голос', 'голоса', 'голосов') + ' зала за игру' });
    return out;
}

function classicInsights(d) {
    var out = [], P = d.players, rows = d.pitchRows || [];
    var top = rows.slice().sort(function (a, b) { return b.attracted - a.attracted; })[0];
    if (top && top.attracted > 0) {
        var pl = P.filter(function (p) { return p.id === top.id; })[0];
        var prod = pl && (pl.products || []).filter(function (x) { return x.round === top.round; })[0];
        out.push('Продукт партии — <b>«' + esc(productName(prod && prod.cards) || '?') + '»</b> от ' + esc(top.nickname) + ': ' + top.attracted + ' ' + plural(top.attracted, 'жетон', 'жетона', 'жетонов') + ' в раунде ' + top.round);
    }
    var rt = d.roundsTable || [];
    var uni = rt.filter(function (r) { return r.topShare != null; }).sort(function (a, b) { return b.topShare - a.topShare; })[0];
    if (uni && uni.topShare >= 55 && rt.length > 1) out.push('Самый единодушный раунд — ' + uni.round + ': ' + uni.topShare + '% всех жетонов ушли одному проекту (' + esc(uni.winners.join(', ')) + ')');
    var spread = rt.filter(function (r) { return r.topShare != null; }).sort(function (a, b) { return a.topShare - b.topShare; })[0];
    if (spread && spread !== uni && spread.topShare < 45) out.push('Раунд ' + spread.round + ' — самый спорный: лидер собрал только ' + spread.topShare + '% жетонов');
    var cb = null;
    P.forEach(function (p) { var rk = p.rankByRound || []; if (rk.length > 1) { var up = rk[0] - rk[rk.length - 1]; if (up > 0 && (!cb || up > cb.up)) cb = { p: p, up: up, a: rk[0], b: rk[rk.length - 1] }; } });
    if (cb) out.push('Камбэк партии: ' + esc(cb.p.nickname) + ' поднялся с ' + cb.a + ' места на ' + cb.b);
    var aud = rt.filter(function (r) { return r.audienceMatch !== null && r.audienceMatch !== undefined; });
    if (aud.length) out.push('Зрители и инвесторы выбрали одного победителя в ' + aud.filter(function (r) { return r.audienceMatch; }).length + ' из ' + aud.length + ' ' + plural(aud.length, 'раунда', 'раундов', 'раундов'));
    [['pitchSec', 'Длина питча', 'Длинные питчи'], ['hands', 'Вопросы', 'Питчи, после которых задавали больше вопросов'], ['reactions', 'Реакции зала', 'Питчи с бурной реакцией зала']].forEach(function (c) {
        var ct = corrText((d.correlations || {})[c[0]], c[1], c[2]);
        if (ct && ct.tone !== 'none') out.push(ct.text);
    });
    var pt = d.phaseTime;
    if (pt) {
        var parts = [['подготовку', pt.prep], ['питчи', pt.pitch], ['вопросы', pt.questions], ['инвестиции', pt.invest], ['итоги', pt.results]];
        var tot = sum(parts.map(function (x) { return x[1]; }));
        var big = parts.slice().sort(function (a, b) { return b[1] - a[1]; })[0];
        if (tot > 0 && big[1] > 0) out.push('Больше всего времени ушло на ' + big[0] + ' — ' + pct(big[1], tot) + '%');
    }
    var swans = sum(rt.map(function (r) { return (r.swan || []).length; }));
    if (swans) out.push('«Чёрный лебедь» прилетал ' + swans + ' ' + plural(swans, 'раз', 'раза', 'раз'));
    var ties = rt.filter(function (r) { return r.tie; });
    if (ties.length) out.push('Ничья и переигровка — в ' + plural(ties.length, 'раунде', 'раундах', 'раундах') + ' ' + ties.map(function (r) { return r.round; }).join(', '));
    return out.slice(0, 7);
}

function classicTab(d, tab) {
    var P = d.players, tt = d.totals;
    var sorted = P.slice().sort(function (a, b) { return b.attractedTotal - a.attractedTotal; });
    var labels = ['старт'];
    for (var i = 1; i <= d.rounds; i++) labels.push('Р' + i);

    if (tab === 'overview') {
        var h = tiles([
            ['⏱', fmtDur(d.durationSec), 'длилась игра'],
            ['🎤', tt.pitches, plural(tt.pitches, 'питч', 'питча', 'питчей')],
            ['💼', tt.invested, 'жетонов вложено'],
            ['🔥', tt.reactions + tt.reactionsSpectators + tt.reactionsTwitch, 'реакций'],
            d.questionsOn ? ['🙋', tt.questions, 'вопросов задано'] : ['', null, ''],
            tt.audienceVotes ? ['🎟', tt.audienceVotes, 'голосов зрителей'] : ['', null, ''],
        ]);
        h += insightsHtml(classicInsights(d));
        h += awardsHtml(classicAwards(d));
        h += section('🏆 Итоговая таблица', '', '<div class="ga-rank">' + sorted.map(function (p, i) {
            return '<div class="ga-rank-row"><span class="ga-rank-n">' + (i + 1) + '</span>' + avatar(p) + '<b>' + esc(p.nickname) + '</b><div class="ga-rank-stats"><span>привлёк <b>' + p.attractedTotal + '</b></span><span>капитал <b>' + p.capital[p.capital.length - 1] + '</b></span><span>побед <b>' + p.wins + '</b></span></div></div>';
        }).join('') + '</div>');
        return h;
    }

    if (tab === 'rounds') {
        var h2 = section('🔁 По раундам', 'Единодушие — какая доля всех жетонов раунда ушла победителю.', '<div class="ga-rounds">' + (d.roundsTable || []).map(function (r) {
            var tags = '';
            if (r.tie) tags += '<span class="ga-tag ga-tag-red">⚔️ ничья</span>';
            (r.swan || []).forEach(function (n) { tags += '<span class="ga-tag">🦢 лебедь у ' + esc(n) + '</span>'; });
            if (r.audience) tags += '<span class="ga-tag ' + (r.audienceMatch ? 'ga-tag-green' : '') + '">🎟 зал: ' + esc(r.audience.join(', ')) + (r.audienceMatch ? ' ✓' : '') + '</span>';
            return '<div class="ga-round"><div class="ga-round-n">Раунд ' + r.round + '</div>'
                + '<div class="ga-round-main"><b>🏆 ' + esc(r.winners.join(', ') || '—') + '</b><span>' + r.invested + ' жетонов в раунде · единодушие ' + (r.topShare == null ? '—' : r.topShare + '%') + '</span>'
                + (r.event ? '<div class="ga-round-event">⚡ ' + esc(r.event) + '</div>' : '') + (tags ? '<div class="ga-tags">' + tags + '</div>' : '') + '</div>'
                + '<div class="ga-round-meter" title="Единодушие ' + (r.topShare || 0) + '%"><i style="width:' + (r.topShare || 0) + '%"></i></div></div>';
        }).join('') + '</div>');
        var pt = d.phaseTime || {};
        h2 += section('⏳ Куда ушло время', 'Сумма по всем раундам.', stackBar([
            { label: 'Подготовка', v: pt.prep, color: '#60a5fa' }, { label: 'Питчи', v: pt.pitch, color: '#ffc72c' },
            { label: 'Вопросы', v: pt.questions, color: '#c084fc' }, { label: 'Инвестиции', v: pt.invest, color: '#34d399' }, { label: 'Итоги', v: pt.results, color: '#8a8a9a' },
        ]));
        h2 += '<div class="ga-grid2">';
        h2 += section('📈 Капитал по раундам', 'Старт — ' + d.startCapital + ' жетонов.', lineChart(P.map(function (p) { return { name: p.nickname, color: color(p.id), values: p.capital }; }), labels, { aria: 'Капитал по раундам' }));
        var n = P.length, ranks = [];
        for (var k = 1; k <= n; k++) ranks.push(k);
        h2 += section('🪜 Места по раундам', 'Место по капиталу после каждого раунда.', lineChart(P.map(function (p) { return { name: p.nickname, color: color(p.id), values: p.rankByRound || [] }; }), labels.slice(1), { min: 1, max: Math.max(2, n), invert: true, ticks: ranks, tickFmt: function (v) { return v + '-е'; }, lastFmt: function (v) { return v + '-е'; }, aria: 'Места по раундам' }));
        h2 += '</div>';
        return h2;
    }

    if (tab === 'pitches') {
        var rows = (d.pitchRows || []).slice().sort(function (a, b) { return b.attracted - a.attracted || a.round - b.round; });
        var h3 = '';
        var corr = [['pitchSec', 'Длина питча', 'Длинные питчи'], ['hands', 'Вопросы', 'Питчи, после которых задавали больше вопросов'], ['reactions', 'Реакции зала', 'Питчи с бурной реакцией зала']].map(function (c) {
            var r = (d.correlations || {})[c[0]];
            var ct = corrText(r, c[1], c[2]);
            var noData = (d.pitchRows || []).length >= 4 ? 'все питчи были одинаковыми по этому показателю — не с чем сравнить' : 'мало данных — нужно хотя бы 4 питча';
            return '<div class="ga-corr ga-corr-' + (ct ? ct.tone : 'na') + '"><b>' + c[1] + ' → вложения</b><span>' + (ct ? ct.text : noData) + '</span>' + (r != null ? '<i>связь ' + (r > 0 ? '+' : '') + r + '</i>' : '') + '</div>';
        }).join('');
        h3 += section('🔗 Что помогало собирать вложения', 'Связь по всем питчам партии: от −1 (чем больше, тем меньше вложений) до +1 (чем больше, тем больше).', '<div class="ga-corrs">' + corr + '</div>');
        h3 += section('🏷 Продукты партии', 'Что продавал каждый — от самого успешного питча.', '<div class="ga-products">' + rows.map(function (r) {
            var pl = P.filter(function (p) { return p.id === r.id; })[0];
            var prod = pl && (pl.products || []).filter(function (x) { return x.round === r.round; })[0];
            var c = prod ? prod.cards : null;
            return '<div class="ga-product' + (prod && prod.won ? ' ga-product-win' : '') + '"><div class="ga-product-top"><b>' + nameDot(pl || { id: r.id, nickname: r.nickname }) + '</b><span>раунд ' + r.round + (prod && prod.won ? ' · 🏆' : '') + (prod && prod.swan ? ' · 🦢' : '') + '</span></div>'
                + '<div class="ga-product-name">' + esc(productName(c) || '—') + '</div>' + (c && c.feature ? '<div class="ga-product-feat">' + esc(c.feature) + '</div>' : '')
                + '<div class="ga-product-stats"><span>💼 <b>' + r.attracted + '</b></span><span>🎤 ' + fmtSec(r.pitchSec) + '</span>' + (d.questionsOn ? '<span>🙋 ' + r.hands + '</span>' : '') + '<span>🔥 ' + r.reactions + '</span></div></div>';
        }).join('') + '</div>');
        h3 += section('🎭 Реакции на выступления', 'Какие эмоции вызывал каждый.', emotionsHtml(P));
        return h3;
    }

    if (tab === 'investors') {
        var h4 = section('🤝 Кто кого поддерживал', 'Строка — кто вкладывал, столбец — в кого. Жетоны за всю игру.', matrixHtml(P, d.matrix, 'кто ↓ / кому →', 'жет.'));
        h4 += section('🧭 Стиль инвестора', 'Доля капитала — сколько в среднем вкладывал от того, что было на руках. Ва-банк — раунды, где вложено 90% и больше.', investorTable(P));
        return h4;
    }

    if (tab === 'hall') {
        var h5 = tiles([
            ['👀', tt.peakViewers || 0, 'зрителей максимум'],
            ['🔥', tt.reactionsSpectators, 'реакций зрителей'],
            tt.reactionsTwitch ? ['📺', tt.reactionsTwitch, 'реакций из Twitch-чата'] : ['', null, ''],
            ['🎟', tt.audienceVotes, 'голосов «Выбор зрителей»'],
            d.chatSpectators ? ['💬', d.chatSpectators, 'сообщений зрителей'] : ['', null, ''],
        ]);
        var ar = (d.roundsTable || []).filter(function (r) { return r.audience; });
        h5 += section('🎟 Выбор зрителей по раундам', '', ar.length ? '<div class="ga-rounds">' + ar.map(function (r) {
            return '<div class="ga-round"><div class="ga-round-n">Раунд ' + r.round + '</div><div class="ga-round-main"><b>Зал: ' + esc(r.audience.join(', ')) + '</b><span>Инвесторы: ' + esc(r.winners.join(', ')) + ' · ' + (r.audienceMatch ? '✓ совпали' : '✗ разошлись') + '</span></div></div>';
        }).join('') + '</div>' : '<div class="ga-empty">Зрители не голосовали</div>');
        h5 += section('❤️ Голоса зала по игрокам', '', hbars(P.slice().sort(function (a, b) { return b.audienceVotes - a.audienceVotes; }).map(function (p) { return { label: nameDot(p), v: p.audienceVotes, color: color(p.id) }; })));
        return h5;
    }

    // игроки
    return '<div class="ga-players">' + sorted.map(function (p, i) { return classicPlayerCard(p, i + 1, d); }).join('') + '</div>'
        + '<p class="ga-foot">Точность ставок — доля ваших жетонов, вложенных в победителя раунда. Время питча и готовности — по таймеру игры.</p>';
}

function emotionsHtml(P) {
    var rows = P.filter(function (p) { return p.reactions > 0; }).sort(function (a, b) { return b.reactions - a.reactions; });
    if (!rows.length) return '<div class="ga-empty">Реакций не было</div>';
    var max = Math.max.apply(null, rows.map(function (p) { return p.reactions; }));
    return '<div class="ga-emos">' + rows.map(function (p) {
        var segs = EMO_ORDER.filter(function (k) { return (p.reactionsBy || {})[k]; }).map(function (k) {
            var v = p.reactionsBy[k];
            return '<i style="flex:' + v + '" title="' + (reactionEmoji(k) || k) + ' ' + v + '">' + (v / p.reactions > 0.12 ? (reactionEmoji(k) || '') + (v > 1 ? '<small>' + v + '</small>' : '') : '') + '</i>';
        }).join('');
        return '<div class="ga-emo-row"><span class="ga-hbar-label">' + nameDot(p) + '</span><span class="ga-emo-track"><span class="ga-emo-fill" style="width:' + Math.max(12, p.reactions / max * 100) + '%">' + segs + '</span></span><b>' + p.reactions + '</b></div>';
    }).join('') + '</div>';
}

function investorStyle(p) {
    if (p.spendShare == null) return '—';
    if (p.spendShare >= 85) return '🎰 азартный';
    if (p.spendShare <= 40) return '🐿 осторожный';
    return '⚖️ сбалансированный';
}

function investorTable(P) {
    var html = '<div class="ga-table-wrap"><table class="ga-table"><thead><tr><th>Инвестор</th><th>Стиль</th><th>Доля капитала</th><th>Ва-банк</th><th>Проектов за раунд</th><th>Решает за</th><th>Точность</th><th>Доход</th><th>Взаимность</th></tr></thead><tbody>';
    P.slice().sort(function (a, b) { return (b.accuracy || 0) - (a.accuracy || 0); }).forEach(function (p) {
        html += '<tr><th>' + nameDot(p) + '</th><td>' + investorStyle(p) + '</td><td>' + (p.spendShare == null ? '—' : p.spendShare + '%') + '</td><td>' + p.allIn + '</td><td>' + (p.spreadAvg == null ? '—' : p.spreadAvg) + '</td><td>' + fmtSec(p.investSpeedAvg) + '</td><td>' + (p.accuracy == null ? '—' : p.accuracy + '%') + '</td><td>+' + p.betIncome + '</td><td>' + p.reciprocity + '</td></tr>';
    });
    return html + '</tbody></table></div>';
}

function classicPlayerTips(p, d) {
    var tips = [];
    if (p.pitchAvg != null && d.presentTime) {
        var ratio = p.pitchAvg / d.presentTime;
        if (ratio < 0.45) tips.push('Питчи короткие: ' + Math.round(p.pitchAvg) + ' с из ' + d.presentTime + '. Есть запас времени на аргументы и пример из жизни');
        else if (ratio > 0.92) tips.push('Использует всё время питча — стоит потренировать короткую версию «в двух фразах»');
    }
    if (p.accuracy != null && p.invested >= 3 && p.accuracy >= 60) tips.push('Хорошо чувствует сильные идеи: ' + p.accuracy + '% ставок пришлись на победителей');
    if (p.attractedTotal === 0 && p.pitches > 0) tips.push('Пока не привлёк инвестиций — попробуйте начинать питч с боли покупателя');
    if (d.questionsOn && p.questionsReceived >= 3) tips.push('Питч вызывает интерес: ' + p.questionsReceived + ' вопросов от слушателей');
    if (p.spendShare != null && p.spendShare < 35) tips.push('Вкладывает мало — жетоны без вложений не приносят дохода');
    var rk = p.rankByRound || [];
    if (rk.length > 1 && rk[rk.length - 1] > rk[0]) tips.push('К концу игры потерял позиции: с ' + rk[0] + ' места на ' + rk[rk.length - 1]);
    return tips.slice(0, 3);
}

function classicPlayerCard(p, rank, d) {
    var em = Object.keys(p.reactionsBy || {}).sort(function (a, b) { return p.reactionsBy[b] - p.reactionsBy[a]; }).slice(0, 3)
        .map(function (k) { return (reactionEmoji(k) || '') + '<small>' + p.reactionsBy[k] + '</small>'; }).join(' ');
    var html = '<div class="ga-player">';
    html += '<div class="ga-player-head">' + avatar(p) + '<div><b>' + esc(p.nickname) + '</b><i>' + rank + ' место по привлечённым · ' + p.wins + ' ' + plural(p.wins, 'победа', 'победы', 'побед') + ' · ' + investorStyle(p) + ' инвестор</i></div></div>';
    html += '<div class="ga-player-body">';
    html += '<div class="ga-mlabel">Привлёк по раундам · всего <b>' + p.attractedTotal + '</b></div>' + bars(p.attracted, color(p.id));
    html += '<div class="ga-metrics">';
    html += metric('💼', 'Вложил', p.invested);
    html += metric('🎯', 'Точность ставок', p.accuracy == null ? '—' : p.accuracy + '%');
    html += metric('💰', 'Доход от ставок', '+' + p.betIncome);
    html += metric('🧭', 'Доля капитала', p.spendShare == null ? '—' : p.spendShare + '%');
    html += metric('🎤', 'Питч в среднем', p.pitchAvg == null ? '—' : fmtSec(p.pitchAvg) + ' / ' + d.presentTime);
    html += metric('⚡', 'Готов за', p.readyAvg == null ? '—' : fmtSec(p.readyAvg));
    html += metric('⏱', 'Решает за', fmtSec(p.investSpeedAvg));
    if (d.questionsOn) { html += metric('🙋', 'Вопросов получил', p.questionsReceived); html += metric('🧐', 'Задал вопросов', p.handsRaised); }
    html += metric('📣', 'Реакций отправил', p.reactionsSent);
    if (p.chat) html += metric('💬', 'Сообщений в чате', p.chat);
    if (p.audienceVotes) html += metric('🎟', 'Голосов зала', p.audienceVotes);
    html += '</div>';
    if ((p.products || []).length) html += '<div class="ga-mini-products">' + p.products.map(function (x) { return '<span' + (x.won ? ' class="ga-mp-win"' : '') + '><em>Р' + x.round + '</em>' + esc(productName(x.cards)) + (x.attracted != null ? ' · ' + x.attracted : '') + '</span>'; }).join('') + '</div>';
    if (em) html += '<div class="ga-emo">Реакции на выступления: ' + em + '</div>';
    var tips = classicPlayerTips(p, d);
    if (tips.length) html += '<ul class="ga-tips">' + tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    html += '</div></div>';
    return html;
}

// ═══════════════════ БУНКЕР ═══════════════════

var VIA = { vote: 'выгнали голосованием', hostKick: 'исключил ведущий', disconnect: 'пропала связь', left: 'вышел сам' };

function bunkerAwards(d) {
    var P = d.players, out = [], a;
    if ((a = best(P, 'votesReceived', { min: 1 }))) out.push({ emoji: '🎯', title: 'Главная мишень', who: a.nickname, why: a.votesReceived + ' ' + plural(a.votesReceived, 'голос', 'голоса', 'голосов') + ' против за игру' });
    if ((a = best(P, 'closeCalls', { min: 1 }))) out.push({ emoji: '😅', title: 'На волоске', who: a.nickname, why: a.closeCalls + ' ' + plural(a.closeCalls, 'раз', 'раза', 'раз') + ' был вторым по голосам — и остался' });
    if ((a = best(P, 'votesOnTarget', { min: 1 }))) out.push({ emoji: '🔮', title: 'Провидец', who: a.nickname, why: a.votesOnTarget + ' ' + plural(a.votesOnTarget, 'раз', 'раза', 'раз') + ' голосовал за того, кто вылетел' });
    if ((d.blocs || [])[0] && d.blocs[0].n >= 2 && (!d.blocs[1] || d.blocs[1].n < d.blocs[0].n)) out.push({ emoji: '🤝', title: 'Блок', who: d.blocs[0].a + ' и ' + d.blocs[0].b, why: d.blocs[0].n + ' ' + plural(d.blocs[0].n, 'раз', 'раза', 'раз') + ' голосовали одинаково' });
    if ((d.feuds || [])[0]) out.push({ emoji: '⚔️', title: 'Вражда', who: d.feuds[0].a + ' и ' + d.feuds[0].b, why: d.feuds[0].n + ' ' + plural(d.feuds[0].n, 'раз', 'раза', 'раз') + ' голосовали друг против друга' });
    if ((a = best(P, 'defectRound', { lowest: true, filter: function (p) { return p.defectRound != null; } }))) out.push({ emoji: '📖', title: 'Открытая книга', who: a.nickname, why: 'признался в дефекте уже в раунде ' + a.defectRound });
    var survivors = P.filter(function (p) { return p.survived; }).map(function (p) { return Object.assign({}, p, { revealCount: p.reveals.length }); });
    if ((a = best(survivors, 'revealCount', { lowest: true }))) out.push({ emoji: '🫣', title: 'Тёмная лошадка', who: a.nickname, why: 'выжил, открыв всего ' + a.revealCount + ' ' + plural(a.revealCount, 'карту', 'карты', 'карт') });
    if ((a = best(P, 'skips', { min: 1 }))) out.push({ emoji: '🕊', title: 'Миротворец', who: a.nickname, why: a.skips + ' ' + plural(a.skips, 'раз', 'раза', 'раз') + ' предлагал оставить всех' });
    var withActions = P.map(function (p) { return Object.assign({}, p, { actionCount: p.actions.length }); });
    if ((a = best(withActions, 'actionCount', { min: 1 }))) out.push({ emoji: '⚡', title: 'Тактик', who: a.nickname, why: 'сыграл ' + a.actionCount + ' ' + plural(a.actionCount, 'карту действия', 'карты действия', 'карт действия') });
    if ((a = best(P, 'turnAvg', { lowest: true, filter: function (p) { return p.turnAvg > 0; } }))) out.push({ emoji: '⏱', title: 'Быстрый ход', who: a.nickname, why: 'в среднем ' + Math.round(a.turnAvg) + ' с на ход' });
    if ((a = best(P, 'chat', { min: 3 }))) out.push({ emoji: '🗣', title: 'Голос бункера', who: a.nickname, why: a.chat + ' ' + plural(a.chat, 'сообщение', 'сообщения', 'сообщений') + ' в чате' });
    if ((a = best(P, 'audienceSaves', { min: 1 }))) out.push({ emoji: '💚', title: 'Любимец зала', who: a.nickname, why: 'зал спасал его ' + a.audienceSaves + ' ' + plural(a.audienceSaves, 'раз', 'раза', 'раз') });
    return out;
}

function topKey(map) {
    var k = Object.keys(map || {}).sort(function (a, b) { return map[b] - map[a]; });
    return k.length ? { key: k[0], n: map[k[0]], total: sum(Object.keys(map).map(function (x) { return map[x]; })) } : null;
}

function bunkerInsights(d) {
    var out = [], P = d.players;
    var first = topKey(d.firstPop);
    if (first) out.push('Первой чаще всего открывали карту «' + esc(cardType(first.key).label) + '» — ' + first.n + ' из ' + first.total);
    var pop = topKey(d.revealPop);
    if (pop && (!first || pop.key !== first.key)) out.push('Самая раскрываемая карта за игру — «' + esc(cardType(pop.key).label) + '»: ' + pop.n + ' ' + plural(pop.n, 'раз', 'раза', 'раз'));
    var out1 = P.filter(function (p) { return !p.survived && p.elimVia === 'vote'; });
    if (out1.length) out.push('Дефект до своего вылета признали ' + out1.filter(function (p) { return p.defectRound; }).length + ' из ' + out1.length + ' ' + plural(out1.length, 'выбывшего', 'выбывших', 'выбывших'));
    var surv = P.filter(function (p) { return p.survived; });
    if (surv.length) out.push('Выжившие открыли в среднем ' + Math.round(sum(surv.map(function (p) { return p.reveals.length; })) / surv.length * 10) / 10 + ' карты, выбывшие — ' + (out1.length ? Math.round(sum(out1.map(function (p) { return p.reveals.length; })) / out1.length * 10) / 10 : '—'));
    if ((d.blocs || [])[0] && d.blocs[0].n >= 2) out.push('Самый крепкий блок — ' + esc(d.blocs[0].a) + ' и ' + esc(d.blocs[0].b) + ': голосовали одинаково ' + d.blocs[0].n + ' ' + plural(d.blocs[0].n, 'раз', 'раза', 'раз'));
    if ((d.feuds || [])[0]) out.push('Вражда: ' + esc(d.feuds[0].a) + ' и ' + esc(d.feuds[0].b) + ' голосовали друг против друга');
    var cc = best(P, 'closeCalls', { min: 1 });
    if (cc) out.push('На волоске: ' + esc(cc.nickname) + ' — ' + cc.closeCalls + ' ' + plural(cc.closeCalls, 'раз', 'раза', 'раз') + ' был вторым по голосам и остался');
    var skipped = (d.roundsTable || []).filter(function (r) { return r.voted && !r.eliminated; }).length;
    if (skipped) out.push('В ' + skipped + ' ' + plural(skipped, 'голосовании', 'голосованиях', 'голосованиях') + ' бункер решил никого не выгонять');
    var pt = d.phaseTime || {};
    if (pt.reveal + pt.vote > 0) out.push('На раскрытия ушло ' + pct(pt.reveal, pt.reveal + pt.vote) + '% времени, на голосования — ' + pct(pt.vote, pt.reveal + pt.vote) + '%');
    return out.slice(0, 7);
}

function bunkerTab(d, tab) {
    var P = d.players, tt = d.totals;
    if (tab === 'overview') {
        var h = tiles([
            ['⏱', fmtDur(d.durationSec), 'длилась игра'],
            ['🃏', tt.reveals, 'карт открыто' + (tt.autoReveals ? ' (авто: ' + tt.autoReveals + ')' : '')],
            ['🗳', tt.votes, 'голосов «за вылет»'],
            ['⚡', tt.actions, 'карт действия'],
            tt.reactionsSpectators + tt.reactionsTwitch ? ['🔥', tt.reactionsSpectators + tt.reactionsTwitch, 'реакций зала'] : ['', null, ''],
            tt.peakViewers ? ['👀', tt.peakViewers, 'зрителей максимум'] : ['', null, ''],
        ]);
        h += insightsHtml(bunkerInsights(d));
        h += awardsHtml(bunkerAwards(d));
        return h;
    }
    if (tab === 'chronicle') {
        var h2 = section('🕰 Раунд за раундом', '', '<div class="ga-rounds">' + (d.roundsTable || []).map(function (r) {
            var tags = '';
            if (r.actions) tags += '<span class="ga-tag">⚡ карт действия: ' + r.actions + '</span>';
            if (r.skips) tags += '<span class="ga-tag">🕊 за «оставить всех»: ' + r.skips + '</span>';
            if (r.audience) tags += '<span class="ga-tag ga-tag-green">💚 зал спас бы: ' + esc(r.audience.join(', ')) + '</span>';
            var res = !r.voted ? '<span class="ga-muted">голосования не было</span>' : (r.eliminated ? '<b class="ga-tl-out">🚪 ' + esc(r.eliminated) + '</b>' : '<b class="ga-tl-safe">🤝 никто не выбыл</b>');
            return '<div class="ga-round"><div class="ga-round-n">Раунд ' + r.round + '</div><div class="ga-round-main">' + res + '<span>🃏 открыто карт: ' + r.reveals + ' · ход в среднем ' + fmtSec(r.turnAvg) + '</span>' + (tags ? '<div class="ga-tags">' + tags + '</div>' : '') + '</div></div>';
        }).join('') + '</div>');
        if ((d.exits || []).length) h2 += section('🚪 Ушли не голосованием', '', '<div class="ga-rounds">' + d.exits.map(function (e) { return '<div class="ga-round"><div class="ga-round-n">Раунд ' + e.round + '</div><div class="ga-round-main"><b>' + esc(e.nickname) + '</b><span>' + (VIA[e.via] || e.via) + '</span></div></div>'; }).join('') + '</div>');
        var pt = d.phaseTime || {};
        h2 += section('⏳ Куда ушло время', '', stackBar([{ label: 'Раскрытия и защита', v: pt.reveal, color: '#ffc72c' }, { label: 'Голосования', v: pt.vote, color: '#ff6b6b' }]));
        return h2;
    }
    if (tab === 'votes') {
        var h3 = section('🗳 Кто против кого голосовал', 'Строка — кто голосовал, столбец — за чей вылет.', matrixHtml(P, d.matrix, 'кто ↓ / против →', 'гол.'));
        h3 += '<div class="ga-grid2">';
        h3 += section('🤝 Блоки', 'Голосовали за одного и того же.', pairsHtml(d.blocs, 'раз вместе'));
        h3 += section('⚔️ Вражда', 'Голосовали друг против друга в одном раунде.', pairsHtml(d.feuds, 'раз друг против друга'));
        h3 += '</div>';
        h3 += section('📊 Голоса против по раундам', 'Чем выше столбик — тем ближе был вылет.', '<div class="ga-vbr">' + P.map(function (p) {
            return '<div class="ga-vbr-row"><span class="ga-hbar-label">' + nameDot(p) + (p.survived ? ' <em class="ga-surv">в бункере</em>' : '') + '</span>' + bars(p.votesByRound || [], color(p.id)) + '</div>';
        }).join('') + '</div>');
        return h3;
    }
    if (tab === 'cards') {
        var h4 = section('🃏 Стратегия раскрытий', 'Цифра на карточке — раунд. Оранжевая рамка — скрытый дефект, пунктир — открыто автоматически по таймеру.', revealsHtml(d));
        h4 += '<div class="ga-grid2">';
        h4 += section('🥇 Что открывали первым', '', hbars(keysSorted(d.firstPop).map(function (k) { return { label: cardType(k).emoji + ' ' + esc(cardType(k).label), v: d.firstPop[k], color: bkColor(k) }; })));
        h4 += section('📈 Какие карты открывали чаще', '', hbars(keysSorted(d.revealPop).map(function (k) { return { label: cardType(k).emoji + ' ' + esc(cardType(k).label), v: d.revealPop[k], color: bkColor(k) }; })));
        h4 += '</div>';
        if (Object.keys(d.actionPop || {}).length) h4 += section('⚡ Карты действия', '', hbars(keysSorted(d.actionPop).map(function (k) { return { label: esc(k), v: d.actionPop[k], color: '#ffc72c' }; })));
        if (Object.keys(d.draftAuto || {}).length) h4 += section('🧪 Сборка продукта', 'Сколько карт выбрано случайно — не успели выбрать за время.', hbars(Object.keys(d.draftAuto).map(function (n) { return { label: esc(n), v: d.draftAuto[n], color: '#8a8a9a' }; }), ' из 9'));
        return h4;
    }
    // игроки
    return '<div class="ga-players">' + P.slice().sort(function (a, b) { return (b.survived ? 1 : 0) - (a.survived ? 1 : 0) || (b.elimRound || 99) - (a.elimRound || 99); })
        .map(bunkerPlayerCard).join('') + '</div>';
}

function keysSorted(map) { return Object.keys(map || {}).sort(function (a, b) { return map[b] - map[a]; }); }

function pairsHtml(list, unit) {
    if (!list || !list.length) return '<div class="ga-empty">Не было</div>';
    return '<div class="ga-pairs">' + list.map(function (x) { return '<div class="ga-pair"><b>' + esc(x.a) + ' + ' + esc(x.b) + '</b><span>' + x.n + ' ' + unit + '</span></div>'; }).join('') + '</div>';
}

function revealsHtml(d) {
    var html = '<div class="ga-reveals">';
    d.players.forEach(function (p) {
        html += '<div class="ga-reveal-row"><span class="ga-reveal-name">' + nameDot(p) + (p.survived ? ' <em class="ga-surv">в бункере</em>' : '') + '</span><div class="ga-reveal-chips">';
        if (!p.reveals.length) html += '<i class="ga-muted">ничего не открыл</i>';
        p.reveals.forEach(function (r) {
            var ct = cardType(r.key);
            html += '<span class="ga-chip' + (r.key === 'hiddenDefect' ? ' ga-chip-defect' : '') + (r.auto ? ' ga-chip-auto' : '') + '" style="--c:' + bkColor(r.key) + '" title="Раунд ' + r.round + ': ' + esc(ct.label) + (r.auto ? ' (открыто автоматически)' : '') + '">' + ct.emoji + '<small>' + r.round + '</small></span>';
        });
        html += '</div></div>';
    });
    return html + '</div>';
}

function bunkerPlayerCard(p) {
    var html = '<div class="ga-player">';
    html += '<div class="ga-player-head">' + avatar(p) + '<div><b>' + esc(p.nickname) + '</b><i>' + (p.survived ? '✅ в бункере' : '🚪 выбыл в раунде ' + (p.elimRound || '?') + (p.elimVia && p.elimVia !== 'vote' ? ' · ' + (VIA[p.elimVia] || '') : '')) + '</i></div></div>';
    html += '<div class="ga-player-body">';
    if (p.cards) html += '<div class="ga-product-name ga-product-inline">' + esc(productName(p.cards)) + '</div>';
    html += '<div class="ga-mlabel">Голоса против по раундам</div>' + bars(p.votesByRound || [], color(p.id));
    html += '<div class="ga-metrics">';
    html += metric('🎯', 'Голосов против', p.votesReceived);
    html += metric('😅', 'На волоске', p.closeCalls);
    html += metric('🗳', 'Голосовал', p.votesCast);
    html += metric('🔮', 'Попаданий', p.votesCast ? p.votesOnTarget + ' из ' + p.votesCast : '—');
    html += metric('🕊', 'Оставить всех', p.skips);
    html += metric('🃏', 'Открыл карт', p.reveals.length);
    html += metric('⚠️', 'Дефект открыт', p.defectRound ? 'раунд ' + p.defectRound : 'нет');
    html += metric('⚡', 'Карт действия', p.actions.length);
    html += metric('⏱', 'Средний ход', fmtSec(p.turnAvg));
    if (p.chat) html += metric('💬', 'Сообщений', p.chat);
    if (p.audienceSaves) html += metric('💚', 'Спасения зала', p.audienceSaves);
    html += '</div></div></div>';
    return html;
}

// ─────────── выгрузка в CSV (Excel открывает по двойному клику) ───────────
function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv(d) {
    var rows;
    if (d.mode === 'bunker') {
        rows = [['Игрок', 'Итог', 'Выбыл в раунде', 'Как выбыл', 'Продукт', 'Голосов против', 'На волоске', 'Голосовал', 'Попаданий', 'Оставить всех', 'Открыл карт', 'Порядок раскрытий', 'Дефект открыт в раунде', 'Карт действия', 'Средний ход, с', 'Сообщений в чате', 'Спасения зала']];
        d.players.forEach(function (p) {
            rows.push([p.nickname, p.survived ? 'в бункере' : 'выбыл', p.elimRound || '', p.elimVia ? (VIA[p.elimVia] || p.elimVia) : '', productName(p.cards), p.votesReceived, p.closeCalls, p.votesCast, p.votesOnTarget, p.skips, p.reveals.length,
                p.reveals.map(function (r) { return cardType(r.key).label + ' (р' + r.round + ')'; }).join(', '), p.defectRound || '', p.actions.length, p.turnAvg == null ? '' : p.turnAvg, p.chat || 0, p.audienceSaves]);
        });
    } else {
        var head = ['Игрок', 'Итоговый капитал', 'Привлёк всего'];
        for (var r = 1; r <= d.rounds; r++) head.push('Привлёк, раунд ' + r);
        for (var r2 = 1; r2 <= d.rounds; r2++) head.push('Продукт, раунд ' + r2);
        head = head.concat(['Побед в раундах', 'Вложил', 'Точность ставок, %', 'Доход от ставок', 'Доля капитала, %', 'Ва-банк, раз', 'Проектов за раунд', 'Решает за, с', 'Взаимность',
            'Питч в среднем, с', 'Вопросов получил', 'Готов за, с', 'Реакций получил', 'Реакций отправил', 'Задал вопросов', 'Первым поднимал руку', 'Сообщений в чате', 'Голосов зала']);
        rows = [head];
        d.players.forEach(function (p) {
            var prods = [];
            for (var i = 1; i <= d.rounds; i++) { var x = (p.products || []).filter(function (y) { return y.round === i; })[0]; prods.push(x ? productName(x.cards) : ''); }
            rows.push([p.nickname, p.capital[p.capital.length - 1], p.attractedTotal].concat(p.attracted).concat(prods).concat([p.wins, p.invested, p.accuracy == null ? '' : p.accuracy, p.betIncome,
                p.spendShare == null ? '' : p.spendShare, p.allIn, p.spreadAvg == null ? '' : p.spreadAvg, p.investSpeedAvg == null ? '' : p.investSpeedAvg, p.reciprocity,
                p.pitchAvg == null ? '' : p.pitchAvg, p.questionsReceived, p.readyAvg == null ? '' : p.readyAvg, p.reactions, p.reactionsSent, p.handsRaised, p.firstHands || 0, p.chat || 0, p.audienceVotes]));
        });
    }
    var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vparit-razbor-' + (state.roomCode || 'igra') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
