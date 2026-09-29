// ═══════════════════════════════════════════
// СБОРКА ПРОДУКТА — «Бункер» (bunkerDraft) и классика (productDraft)
// Бункер: перед первым ходом каждый выбирает по 1 карте из 3 в каждой из 9 категорий.
// Классика: то же в начале каждого раунда, но только из карт, включённых в настройках.
// Экран один, различия — в режиме (mode): набор шагов, подсказки, контекст сверху, сообщения серверу.
// Первым — предмет: прилагательное и особенность сервер присылает уже согласованными с его родом.
// Экран обновляется «на месте» (refreshBunkerDraft), а не через navigate — иначе сбивается таймер
// и стирается недописанное сообщение в чате.
// ═══════════════════════════════════════════
import { state, escapeHtml, updateTimerUI } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';
import { renderBunkerChat } from '../components/bunker-chat.js';
import { playSound } from '../components/sound.js';
import { BUNKER_CARD_TYPES, bkColor } from './bunker-game.js';
import { askConfirm } from '../components/confirm.js';

var DRAFT_ORDER = ['item', 'adjective', 'modifier', 'feature', 'gift', 'hiddenDefect', 'packaging', 'review', 'historicalFact'];

var mode = 'bunker';   // 'bunker' | 'classic'
function classic() { return mode === 'classic'; }

var HINTS = {
    item: 'Основа вашего продукта. От него зависит, как согласуются прилагательное и особенность.',
    adjective: 'Свойство продукта — уже согласовано с вашим предметом.',
    modifier: 'Одно слово, которое приклеивается к предмету: «Утюг СПРАВЕДЛИВОСТИ».',
    feature: 'Что продукт умеет или чем необычен — уже согласовано с предметом.',
    gift: 'Приятный довесок, который идёт в комплекте.',
    hiddenDefect: 'Недостаток продукта. Берите тот, который проще всего оправдать.',
    packaging: 'В чём продукт принесут в бункер.',
    review: 'Цитата первого покупателя — чужие слова о продукте.',
    historicalFact: 'Деталь из прошлого продукта или его автора.',
};

// В классике продаём инвесторам, а не спасаемся от катастрофы — подсказки про другое
var CLASSIC_HINTS = {
    item: 'Основа продукта, который вы будете продавать инвесторам. От него зависит, как согласуются прилагательное и особенность.',
    modifier: 'Слово, которое приклеивается к предмету: «Утюг СПРАВЕДЛИВОСТИ».',
    targetAudience: 'Кому вы продаёте. Чем неожиданнее аудитория, тем смешнее питч.',
    hiddenDefect: 'Недостаток продукта. Берите тот, который проще всего выдать за достоинство.',
    packaging: 'В чём продукт увидят инвесторы.',
    review: 'Цитата первого покупателя — придётся с ней жить на питче.',
};

var SHORT = {
    item: 'Предмет', adjective: 'Свойство', modifier: 'Модиф.', feature: 'Умеет', gift: 'Бонус',
    hiddenDefect: 'Дефект', packaging: 'Упаковка', review: 'Отзыв', historicalFact: 'Факт', targetAudience: 'Для кого',
};

// Карт «Целевая аудитория» в «Бункере» нет — описываем её здесь
var EXTRA_TYPES = { targetAudience: { key: 'targetAudience', label: 'Целевая аудитория', emoji: '🎯' } };
var EXTRA_COLORS = { targetAudience: '#ec4899' };
function color(key) { return EXTRA_COLORS[key] || bkColor(key); }

function hint(key) {
    if (classic()) {
        if (key === 'modifier' && draft().modifierKind === 'metaphor') return 'Два слова, которые приклеиваются к предмету: «Утюг ВНЕЗАПНОГО УСПЕХА».';
        if (CLASSIC_HINTS[key]) return CLASSIC_HINTS[key];
    }
    return HINTS[key] || '';
}

var currentStep = null;   // какой шаг открыт у игрока (может вернуться к пройденному)
var problemFull = false;

function cardType(key) {
    for (var i = 0; i < BUNKER_CARD_TYPES.length; i++) if (BUNKER_CARD_TYPES[i].key === key) return BUNKER_CARD_TYPES[i];
    return EXTRA_TYPES[key] || { key: key, label: key, emoji: '🃏' };
}

function draft() { return (classic() ? state.productDraft : state.bunkerDraft) || { options: {}, picks: {}, doneIds: [], total: 0 }; }

// Шаги сборки: в классике — только карты, включённые в настройках (присылает сервер)
function order() {
    var o = draft().order;
    return o && o.length ? o : DRAFT_ORDER;
}

function isPicked(key) { return draft().picks[key] !== undefined && draft().picks[key] !== null; }

function pickedText(key) {
    var d = draft();
    if (!isPicked(key)) return null;
    var opts = d.options[key] || [];
    return opts[d.picks[key]] || null;
}

function firstUnpicked() {
    var o = order();
    for (var i = 0; i < o.length; i++) if (!isPicked(o[i])) return o[i];
    return null;
}

function pickedCount() {
    var n = 0;
    order().forEach(function (k) { if (isPicked(k)) n++; });
    return n;
}

// Новая партия — шаг сбрасывается на первый
export function resetBunkerDraftStep() {
    currentStep = null;
    problemFull = false;
}

// ─────────── разметка частей ───────────

function hudHtml(isPlayer) {
    var d = draft();
    var done = (d.doneIds || []).length;
    var total = d.total || (state.players || []).length;
    var html = '<div class="bk-hud">';
    html += classic()
        ? '  <div class="bk-hud-round"><span>Раунд</span><b>' + (draft().round || state.currentRound || 1) + '<small class="bkd-of">/' + (draft().totalRounds || state.totalRounds || 1) + '</small></b></div>'
        : '  <div class="bk-hud-round"><span>Этап</span><b>🧪</b></div>';
    html += '  <div class="bk-hud-mid">';
    html += '    <div class="bkd-title">Соберите свой продукт</div>';
    html += '    <div class="bk-hud-line"><span>' + (isPlayer ? 'Выбрано карт: ' + pickedCount() + ' из ' + order().length : 'Игроки выбирают карты') + '</span><span data-timer-text></span></div>';
    html += '    <div class="timer-bar-container"><div class="timer-bar" data-timer-bar style="width:100%"></div></div>';
    html += '  </div>';
    html += '  <div class="bk-hud-seats" id="bkd-progress"><span>Собрали</span><b>' + done + '<small class="bkd-of"> / ' + total + '</small></b></div>';
    html += '  <button id="btn-exit-bunker" class="bk-hud-exit" title="Выйти из игры">✕</button>';
    html += '</div>';
    return html;
}

// Классика: вместо катастрофы — событие раунда (если включены события) или короткое напоминание
function roundContextHtml() {
    var ev = draft().event;
    if (ev) {
        var text = typeof ev === 'string' ? ev : (ev.text || ev.title || ev.name || '');
        var html = '<div class="bk-disaster bkd-event">';
        html += '  <div class="bk-disaster-head" style="cursor:default">';
        html += '    <span class="bk-disaster-icon">🎲</span>';
        html += '    <span class="bk-disaster-label">Событие раунда</span>';
        html += '    <span class="bk-disaster-hint">собирайте продукт с оглядкой на него</span>';
        html += '  </div>';
        html += '  <div class="bk-disaster-body bk-disaster-full"><div class="bk-disaster-text">' + escapeHtml(text) + '</div></div>';
        html += '</div>';
        return html;
    }
    return '<div class="bkd-classic-intro">Соберите продукт, который потом будете продавать инвесторам. Выбирайте то, что сможете смешно и убедительно защитить.</div>';
}

function disasterHtml() {
    var html = '<div class="bk-disaster">';
    html += '  <div class="bk-disaster-head" style="cursor:default">';
    html += '    <span class="bk-disaster-icon">☢️</span>';
    html += '    <span class="bk-disaster-label">Катастрофа</span>';
    html += '    <span class="bk-disaster-hint">собирайте продукт, который от неё спасёт</span>';
    html += '  </div>';
    html += '  <div id="problem-body" class="bk-disaster-body' + (problemFull ? ' bk-disaster-full' : '') + '">';
    html += '    <div class="bk-disaster-text">' + escapeHtml(draft().globalProblem || '') + '</div>';
    html += '    <button id="btn-problem-more" class="bk-disaster-more">читать полностью ▾</button>';
    html += '  </div>';
    html += '</div>';
    return html;
}

// Живое превью: название продукта собирается по мере выбора
function productHtml() {
    function part(key, cls) {
        var v = pickedText(key);
        if (order().indexOf(key) === -1) return '';
        var style = ' style="--bk:' + color(key) + '"';
        if (v) return '<span class="bkd-part bkd-part-on ' + cls + '"' + style + '>' + escapeHtml(v) + '</span>';
        return '<span class="bkd-part bkd-part-off"' + style + '>' + cardType(key).label.toLowerCase() + '</span>';
    }
    var html = '<div class="bkd-product">';
    html += '  <div class="bkd-product-label">Ваш продукт <span>🔒 видите только вы</span></div>';
    html += '  <div class="bkd-product-name">' + part('adjective') + ' ' + part('item') + ' ' + part('modifier') + '</div>';
    var feat = part('feature');
    if (feat) html += '  <div class="bkd-product-feature">' + feat + '</div>';
    html += '</div>';
    return html;
}

function stepsHtml(active) {
    var html = '<div class="bkd-steps">';
    order().forEach(function (key, i) {
        var ct = cardType(key);
        var picked = isPicked(key);
        var locked = (key === 'adjective' || key === 'feature') && !isPicked('item');
        var cls = 'bkd-stepbtn' + (key === active ? ' bkd-step-now' : '') + (picked ? ' bkd-step-done' : '') + (locked ? ' bkd-step-locked' : '');
        html += '<button class="' + cls + '" style="--bk:' + color(key) + '" data-draft-step="' + key + '"' + (locked ? ' disabled' : '') + ' title="' + escapeHtml(ct.label) + '">';
        html += '  <span class="bkd-stepbtn-num">' + (picked ? '✓' : (i + 1)) + '</span>';
        html += '  <span class="bkd-stepbtn-emoji">' + ct.emoji + '</span>';
        html += '  <span class="bkd-stepbtn-label">' + SHORT[key] + '</span>';
        html += '</button>';
    });
    html += '</div>';
    return html;
}

function optionsHtml(key) {
    var d = draft();
    var ct = cardType(key);
    var idx = order().indexOf(key);
    var opts = d.options[key] || [];
    var html = '<div class="bkd-step" style="--bk:' + color(key) + '">';
    html += '  <div class="bkd-step-kicker">Шаг ' + (idx + 1) + ' из ' + order().length + '</div>';
    html += '  <div class="bkd-step-title">' + ct.emoji + ' ' + ct.label + '</div>';
    html += '  <div class="bkd-step-hint">' + hint(key) + '</div>';
    html += '  <div class="bkd-opts">';
    var pending = !opts.length || opts.some(function (o) { return o === null || o === undefined; });
    for (var i = 0; i < 3; i++) {
        if (pending) {
            html += '<div class="bkd-opt bkd-opt-wait"><span class="bkd-opt-num">' + (i + 1) + '</span><span class="bkd-opt-text">согласуем с предметом…</span></div>';
            continue;
        }
        if (opts[i] === undefined) continue;
        var chosen = d.picks[key] === i;
        html += '<button class="bkd-opt' + (chosen ? ' bkd-opt-chosen' : '') + '" data-draft-pick="' + key + '" data-draft-option="' + i + '" style="animation-delay:' + (i * 70) + 'ms">';
        html += '  <span class="bkd-opt-num">' + (chosen ? '✓' : (i + 1)) + '</span>';
        html += '  <span class="bkd-opt-text">' + escapeHtml(opts[i]) + '</span>';
        html += '</button>';
    }
    html += '  </div>';
    html += '</div>';
    return html;
}

function doneHtml() {
    var d = draft();
    var waiting = Math.max(0, (d.total || 0) - (d.doneIds || []).length);
    var html = '<div class="bkd-done">';
    html += '  <div class="bkd-done-icon">✅</div>';
    html += '  <div class="bkd-done-title">Продукт собран!</div>';
    html += '  <div class="bkd-done-sub">' + (waiting > 0
        ? 'Ждём ещё ' + waiting + ' ' + plural(waiting, 'игрока', 'игроков', 'игроков') + '. Пока все не закончили, любую карту можно поменять — нажмите на шаг выше.'
        : (classic() ? 'Все готовы — начинаем подготовку…' : 'Все готовы — заходим в бункер…')) + '</div>';
    html += '  <div class="bkd-summary">';
    order().forEach(function (key) {
        var ct = cardType(key);
        html += '<button class="bkd-sum" style="--bk:' + color(key) + '" data-draft-step="' + key + '">';
        html += '  <span class="bkd-sum-label">' + ct.emoji + ' ' + ct.label + '</span>';
        html += '  <span class="bkd-sum-value">' + escapeHtml(pickedText(key) || '—') + '</span>';
        html += '</button>';
    });
    html += '  </div>';
    html += '</div>';
    return html;
}

function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

// Кто уже собрал — для зрителей и ведущего
function whoHtml() {
    var d = draft();
    var html = '<div class="bkd-who">';
    (state.players || []).forEach(function (p) {
        var ok = (d.doneIds || []).indexOf(p.id) !== -1;
        html += '<span class="bkd-who-chip' + (ok ? ' bkd-who-ok' : '') + '">' + (ok ? '✓ ' : '🃏 ') + escapeHtml(p.nickname) + '</span>';
    });
    html += '</div>';
    return html;
}

function innerHtml() {
    var isPlayer = !state.isSpectator;
    var html = '';
    html += hudHtml(isPlayer);
    html += classic() ? roundContextHtml() : disasterHtml();

    if (isPlayer) {
        var step = currentStep && order().indexOf(currentStep) !== -1 ? currentStep : firstUnpicked();
        html += productHtml();
        html += stepsHtml(step);
        html += step ? optionsHtml(step) : doneHtml();
    } else {
        html += '<div class="bkd-done"><div class="bkd-done-icon">🧪</div><div class="bkd-done-title">Игроки собирают продукты</div>';
        html += '<div class="bkd-done-sub">Каждый выбирает по одной карте из трёх в каждой категории. Как только все закончат — ' + (classic() ? 'начнётся подготовка питчей' : 'начнётся первый раунд') + '.</div></div>';
        html += whoHtml();
    }

    if (state.isHost) {
        var d = draft();
        var allDone = (d.doneIds || []).length >= (d.total || 0);
        if (!allDone) {
            html += '<div class="bkd-host">';
            html += '  <button id="btn-draft-finish" class="bkd-host-btn">' + (classic() ? '▶ Начать подготовку сейчас' : '▶ Начать игру сейчас') + '</button>';
            html += '  <div class="bkd-host-note">Кто не успел — недобранные карты выберутся случайно из их трёх вариантов</div>';
            html += '</div>';
        }
    }
    return html;
}

// ─────────── рендер и события ───────────

export function renderBunkerDraft(container) {
    mode = 'bunker';
    var html = '';
    html += '<div class="bunker-layout">';
    html += '<div id="bunker-main-content" class="bunker-main-col">';
    html += '<div id="bkd-root" class="bkd max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">' + innerHtml() + '</div>';
    html += '</div>';
    html += '</div>';
    container.innerHTML = html;
    renderBunkerChat(container);
    bind(container.querySelector('#bkd-root'));
}

// Классика: тот же экран, без чата бункера
export function renderProductDraft(container) {
    mode = 'classic';
    container.innerHTML = '<div id="bkd-root" class="bkd bkd-classic max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">' + innerHtml() + '</div>';
    bind(container.querySelector('#bkd-root'));
}

// Обновить экран без navigate: таймер, прокрутка и чат остаются как были
export function refreshBunkerDraft() {
    var root = document.getElementById('bkd-root');
    if (!root) return;
    root.innerHTML = innerHtml();
    bind(root);
    if (state.timerInterval) updateTimerUI();
}

// Кто-то собрал продукт: обновляем только счётчики, не трогая варианты у игрока в руках
export function updateBunkerDraftProgress() {
    var root = document.getElementById('bkd-root');
    if (!root) return;
    // На экране «продукт собран», у зрителя и когда кнопка хоста должна исчезнуть — перерисовка дешёвая
    var d = draft();
    var allDone = (d.doneIds || []).length >= (d.total || 0);
    if (root.querySelector('.bkd-done') || (allDone && root.querySelector('#btn-draft-finish'))) {
        refreshBunkerDraft();
        return;
    }
    var box = root.querySelector('#bkd-progress b');
    if (box) {
        box.innerHTML = (d.doneIds || []).length + '<small class="bkd-of"> / ' + (d.total || 0) + '</small>';
        box.classList.remove('bkd-bump');
        void box.offsetWidth;
        box.classList.add('bkd-bump');
    }
}

function bind(root) {
    if (!root) return;

    root.querySelectorAll('[data-draft-pick]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var key = btn.getAttribute('data-draft-pick');
            var opt = parseInt(btn.getAttribute('data-draft-option'), 10);
            var d = draft();
            d.picks = Object.assign({}, d.picks);
            d.picks[key] = opt;
            // Предмет сменился — старые склонения неактуальны, ждём новые от сервера
            if (key === 'item') {
                d.options = Object.assign({}, d.options, { adjective: [null, null, null], feature: [null, null, null] });
            }
            sendMsg({ type: classic() ? 'productDraftPick' : 'bunkerDraftPick', cardKey: key, option: opt });
            playSound('tick');
            // Дальше — следующий невыбранный шаг (при правке уже выбранной карты тоже вперёд)
            currentStep = null;
            var r = document.getElementById('bkd-root');
            if (r) {
                r.innerHTML = innerHtml();
                bind(r);
                if (state.timerInterval) updateTimerUI();
                var chosen = r.querySelector('.bkd-steps');
                if (chosen && window.innerWidth < 640) chosen.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    });

    root.querySelectorAll('[data-draft-step]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.disabled) return;
            currentStep = btn.getAttribute('data-draft-step');
            refreshBunkerDraft();
        });
    });

    var more = root.querySelector('#btn-problem-more');
    if (more) more.addEventListener('click', function () {
        problemFull = true;
        var body = root.querySelector('#problem-body');
        if (body) body.classList.add('bk-disaster-full');
    });

    var fin = root.querySelector('#btn-draft-finish');
    if (fin) fin.addEventListener('click', async function () {
        if (!await askConfirm((classic() ? 'Начать подготовку сейчас?' : 'Начать игру сейчас?') + ' Кто не успел, получит недобранные карты случайно.')) return;
        sendMsg({ type: classic() ? 'productDraftFinish' : 'bunkerDraftFinish' });
    });

    var exit = root.querySelector('#btn-exit-bunker');
    if (exit) exit.addEventListener('click', async function () {
        if (await askConfirm('Выйти из игры?')) leaveRoom();
    });

    // Прокрутка ленты шагов к текущему (на телефоне она прокручивается вбок)
    var now = root.querySelector('.bkd-step-now');
    var strip = root.querySelector('.bkd-steps');
    if (now && strip && strip.scrollWidth > strip.clientWidth) {
        strip.scrollLeft = now.offsetLeft - strip.clientWidth / 2 + now.clientWidth / 2;
    }
}
