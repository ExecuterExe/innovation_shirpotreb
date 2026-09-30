import { escapeHtml } from '../app.js';

// ═══════════════════════════════════════════
// Финал-прожарка: каждый разносит продукт соперника из этой партии,
// инвесторы вкладываются в самую разгромную прожарку.
// ═══════════════════════════════════════════

function victimName(r) {
    return r && r.ownerName ? escapeHtml(r.ownerName) : null;
}

function tokens(n) {
    n = parseInt(n, 10) || 0;
    var m10 = n % 10, m100 = n % 100;
    var w = (m10 === 1 && m100 !== 11) ? 'жетон' : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? 'жетона' : 'жетонов';
    return n + ' ' + w;
}

// «Продукт Бори · 2 раунд · собрал 7 жетонов»
export function roastOriginText(r) {
    if (!r || !r.ownerName) return 'продукт из колоды — у соперника не было своего';
    var parts = [];
    if (r.round) parts.push('звучал в ' + r.round + ' раунде');
    if (r.total !== null && r.total !== undefined) parts.push(r.total > 0 ? 'собрал ' + tokens(r.total) : 'не собрал ни жетона');
    return parts.join(' · ');
}

// Строка «🔥 прожаривал продукт Бори» — для инвестиций и итогов
export function roastByHtml(r, verb, inline) {
    if (!r) return '';
    var who = victimName(r);
    var tag = inline ? 'span' : 'div';
    return '<' + tag + ' class="roast-by' + (inline ? ' roast-by-inline' : '') + '">🔥 ' + (verb || 'прожаривал') + ' ' + (who ? 'продукт игрока <b>' + who + '</b>' : 'продукт из колоды') + '</' + tag + '>';
}

// Шапка подготовки: чья жертва, что делать и как жечь — одним блоком, чтобы экран влез без прокрутки
export function roastPrepHtml(r) {
    var who = victimName(r);
    var html = '<div class="roast-prep">';
    html += '<div class="roast-prep-kick"><span class="roast-flame">🔥</span> Финал · прожарка <span class="roast-prep-origin">· ' + escapeHtml(roastOriginText(r)) + '</span></div>';
    html += '<h2 class="roast-prep-title">' + (who ? 'Ваша жертва — продукт игрока <b>' + who + '</b>' : 'Ваша жертва — продукт из колоды') + '</h2>';
    html += '<p class="roast-prep-lead">Разнесите его в пух и прах. Инвесторы вкладываются в <b>самую разгромную прожарку</b> — жетоны получаете вы.</p>';
    html += '<div class="roast-prep-tips">';
    [['💀', 'что сломается первым'], ['🤡', 'кому испортит жизнь'], ['📉', 'цифры позора'], ['⚰️', 'почему инвестор потеряет всё']].forEach(function (t) {
        html += '<span class="roast-prep-tip">' + t[0] + ' ' + t[1] + '</span>';
    });
    html += '</div>';
    html += '</div>';
    return html;
}

// На сцене: чей продукт жарят + реакция владельца
export function roastStageHtml(r, myId, compact) {
    if (!r) return '';
    var who = victimName(r);
    var html = '<div class="roast-target' + (compact ? ' roast-target-compact' : '') + '">';
    html += '<span class="roast-target-label">разносит</span> ';
    html += who ? 'продукт игрока <b>' + who + '</b>' : 'продукт из колоды';
    if (r.ownerName) html += '<span class="roast-target-origin"> · ' + escapeHtml(roastOriginText(r)) + '</span>';
    html += '</div>';
    if (r.ownerId && r.ownerId === myId) {
        html += '<div class="roast-victim-me">😱 Это ВАШ продукт — держитесь!</div>';
    }
    return html;
}
