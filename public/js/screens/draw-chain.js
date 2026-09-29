// ═══════════════════════════════════════════
// «ИСПОРЧЕННЫЙ ПРОТОТИП» — надстройка над классикой: продукт портится по цепочке игроков
//  • drawing — рисуете продукт по своим картам;
//  • naming  — видите чужой рисунок (без карт) и придумываете ему название;
//  • slogan  — (если включено) видите рисунок и название, пишете слоган;
//  • дальше подготовка: питчите продукт, над которым вы не работали, — рисунок, тексты и карты.
// На сцене питча рисунок проигрывается таймлапсом — штрих за штрихом (это и есть «разоблачение»).
// Холст сохраняется на сервер по ходу рисования: вышло время или обновили страницу — рисунок не пропадёт.
// Экран обновляется «на месте» (updateChainProgress), чтобы не стирать холст и поле ввода.
// ═══════════════════════════════════════════
import { state, escapeHtml, updateTimerUI, observerNoticeHtml } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';
import { CARD_TYPES } from './presentation.js';
import { playSound } from '../components/sound.js';
import { askConfirm } from '../components/confirm.js';

var W = 800, H = 600;
var COLORS = ['#111111', '#6b7280', '#ffffff', '#ef4444', '#f97316', '#facc15', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#8b5a2b', '#fcd9b6'];
var SIZES = [3, 7, 14, 24, 40];
var TOOLS = [
    { key: 'brush', emoji: '✏️', label: 'Кисть', hotkey: 'B' },
    { key: 'fill', emoji: '🪣', label: 'Заливка', hotkey: 'F' },
    { key: 'eraser', emoji: '🧽', label: 'Ластик', hotkey: 'E' },
];

// Состояние холста живёт между перерисовками экрана.
// strokes — всё нарисованное по порядку: штрихи, заливки и очистки. redo — отменённое, пока не нарисовали новое.
var pad = { strokes: [], redo: [], base: null, baseImg: null, color: COLORS[0], size: SIZES[1], tool: 'brush' };
var saveTimer = null;
var nameTimer = null;
var keyHandler = null;

function chain() { return state.chain || { stage: 'drawing', doneIds: [], total: 0 }; }
function amDone() { return !!chain().done; }
// Игрок работает на этом этапе (сервер прислал ему карты или чужой рисунок), а не смотрит со стороны
function isWorker() {
    var c = chain();
    if (state.isSpectator) return false;
    return c.stage === 'drawing' ? c.cards !== undefined : c.drawing !== undefined;
}

// Новый раунд — чистый холст (или рисунок, сохранённый на сервере, после перезагрузки)
export function resetChainPad(strokes, image) {
    pad.strokes = strokes && strokes.length ? fromWire(strokes) : [];
    pad.redo = [];
    pad.base = pad.strokes.length ? null : (image || null);
    pad.baseImg = null;
    pad.tool = 'brush';
}

// Штрихи в компактном виде для сервера: { t, c, w, p: [x, y, x, y, …] }
function toWire(list) {
    return list.map(function (s) {
        if (s.type === 'clear') return { t: 'c' };
        if (s.type === 'fill') return { t: 'f', c: s.color, p: [s.x, s.y] };
        var flat = [];
        s.points.forEach(function (pt) { flat.push(pt[0], pt[1]); });
        return { t: 's', c: s.color, w: s.size, p: flat };
    });
}

function fromWire(list) {
    return (list || []).map(function (s) {
        if (s.t === 'c') return { type: 'clear' };
        if (s.t === 'f') return { type: 'fill', x: s.p[0], y: s.p[1], color: s.c };
        var pts = [];
        for (var i = 0; i + 1 < s.p.length; i += 2) pts.push([s.p[i], s.p[i + 1]]);
        return { color: s.c, size: s.w, points: pts };
    });
}

// ─────────── разметка ───────────

function hudHtml() {
    var c = chain();
    var title = { drawing: '🎨 Нарисуйте свой продукт', naming: '🏷 Придумайте название', slogan: '📣 Придумайте слоган' }[c.stage] || '';
    var what = { drawing: 'рисунок', naming: 'название', slogan: 'слоган' }[c.stage] || '';
    var html = '<div class="bk-hud">';
    html += '  <div class="bk-hud-round"><span>Раунд</span><b>' + (c.round || state.currentRound || 1) + '<small class="bkd-of">/' + (c.totalRounds || state.totalRounds || 1) + '</small></b></div>';
    html += '  <div class="bk-hud-mid">';
    html += '    <div class="bkd-title">' + title + '</div>';
    html += '    <div class="bk-hud-line"><span>Этап ' + ((c.stageIndex || 0) + 1) + ' из ' + (c.stagesTotal || 2) + ' · ' + what + '</span><span data-timer-text></span></div>';
    html += '    <div class="timer-bar-container"><div class="timer-bar" data-timer-bar style="width:100%"></div></div>';
    html += '  </div>';
    html += '  <div class="bk-hud-seats" id="chain-progress"><span>Готовы</span><b>' + (c.doneIds || []).length + '<small class="bkd-of"> / ' + (c.total || 0) + '</small></b></div>';
    html += hostHtml();
    html += '  <button id="btn-exit-chain" class="bk-hud-exit" title="Выйти из игры">✕</button>';
    html += '</div>';
    return html;
}

// Карты — компактными плашками: их видно, пока рисуете, и холст не уезжает вниз
function cardsHtml(cards) {
    var html = '<div class="dc-chips">';
    CARD_TYPES.forEach(function (t) {
        if (!cards || !cards[t.key]) return;
        html += '<div class="dc-chip ' + t.gradient + '"><span>' + escapeHtml(t.label) + '</span><b>' + escapeHtml(cards[t.key]) + '</b></div>';
    });
    html += '</div>';
    return html;
}

function toolsHtml() {
    var html = '<div class="dc-tools">';
    html += '<div class="dc-row">';
    TOOLS.forEach(function (t) {
        html += '<button class="dc-tool' + (pad.tool === t.key ? ' dc-on' : '') + '" data-tool="' + t.key + '" title="' + t.label + ' (' + t.hotkey + ')"><span>' + t.emoji + '</span><small>' + t.label + '</small></button>';
    });
    html += '<span class="dc-sep"></span>';
    html += '<button class="dc-btn" data-action="undo" title="Отменить (Ctrl+Z)"' + (pad.strokes.length ? '' : ' disabled') + '>↩️</button>';
    html += '<button class="dc-btn" data-action="redo" title="Вернуть (Ctrl+Y)"' + (pad.redo.length ? '' : ' disabled') + '>↪️</button>';
    html += '<button class="dc-btn" data-action="clear" title="Очистить всё — можно отменить">🗑</button>';
    html += '<button id="btn-draw-done" class="dc-done-btn">✓ Готово</button>';
    html += '</div>';
    html += '<div class="dc-row">';
    html += '<div class="dc-colors">';
    COLORS.forEach(function (c) {
        html += '<button class="dc-color' + (pad.color === c ? ' dc-on' : '') + '" data-color="' + c + '" style="--c:' + c + '" aria-label="Цвет ' + c + '"></button>';
    });
    // Свой цвет — системная палитра
    var custom = COLORS.indexOf(pad.color) === -1;
    html += '<label class="dc-color dc-custom' + (custom ? ' dc-on' : '') + '" style="--c:' + (custom ? pad.color : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)') + '" title="Свой цвет"><input type="color" id="dc-color-input" aria-label="Свой цвет" value="' + pad.color + '"></label>';
    html += '</div>';
    html += '<div class="dc-sizes">';
    SIZES.forEach(function (sz) {
        var dot = Math.max(3, Math.min(26, Math.round(sz * 0.65)));
        html += '<button class="dc-size' + (pad.size === sz ? ' dc-on' : '') + '" data-size="' + sz + '" title="Толщина ' + sz + '"><i style="width:' + dot + 'px;height:' + dot + 'px"></i></button>';
    });
    html += '</div>';
    html += '</div>';
    html += '</div>';
    return html;
}

function drawingHtml() {
    var c = chain();
    var html = '';
    if (c.event) html += eventHtml(c.event);
    html += '<div class="dc-cards">' + cardsHtml(c.cards) + '<div class="dc-hint-line">Сосед увидит только рисунок, <b>без карт</b></div></div>';
    if (amDone()) {
        html += '<div class="dc-done">';
        html += '  <img class="dc-preview" src="' + (c.drawing || blankDataUrl()) + '" alt="Ваш рисунок">';
        html += '  <div class="bkd-done-title">Рисунок отправлен!</div>';
        html += '  <div class="bkd-done-sub" id="chain-wait">' + waitText() + '</div>';
        html += '  <button id="btn-draw-edit" class="dc-secondary">✏️ Дорисовать</button>';
        html += '</div>';
        return html;
    }
    html += '<div class="dc-board">';
    html += toolsHtml();
    html += '  <div class="dc-canvas-wrap"><canvas id="dc-canvas" width="' + W + '" height="' + H + '"></canvas></div>';
    html += '</div>';
    return html;
}

// Название или слоган к чужому рисунку
var TEXT_STAGE = {
    naming: {
        hint: 'Чей-то продукт. Карт не видно — только рисунок. Как он называется? Громко и по-маркетинговому: «ПароЗонт 3000».',
        placeholder: 'Название продукта', max: 60, sent: 'Название отправлено',
    },
    slogan: {
        hint: 'Рисунок и название уже есть — не хватает слогана. «Мы не спрашиваем, зачем. Мы продаём».',
        placeholder: 'Слоган продукта', max: 90, sent: 'Слоган отправлен',
    },
};

function textStageHtml() {
    var c = chain();
    var cfg = TEXT_STAGE[c.stage];
    var html = '<div class="dc-hint">' + cfg.hint + '</div>';
    html += '<div class="dc-text-stage">';
    html += '  <div class="dc-text-art"><img class="dc-preview dc-preview-fit" src="' + (c.drawing || blankDataUrl()) + '" alt="Чужой рисунок"></div>';
    html += '  <div class="dc-text-side">';
    if (!c.drawing) html += '<div class="dc-empty-note">Художник не успел нарисовать — придётся по белому листу 🙈</div>';
    if (c.stage === 'slogan') html += '<div class="dc-given-name">«' + escapeHtml(c.productName || 'Без названия') + '»</div>';
    if (amDone()) {
        html += '<div class="dc-name-sent">' + escapeHtml(c.text || '') + '</div>';
        html += '<div class="bkd-done-sub" id="chain-wait">' + cfg.sent + '. ' + waitText() + '</div>';
        html += '<button id="btn-text-edit" class="dc-secondary">✏️ Изменить</button>';
    } else {
        html += '<div class="dc-name-form">';
        html += '  <input id="dc-text" class="dc-name-input" maxlength="' + cfg.max + '" autocomplete="off" enterkeyhint="done" autocapitalize="sentences" placeholder="' + cfg.placeholder + '" value="' + escapeHtml(c.text || '') + '">';
        html += '  <button id="btn-text-done" class="dc-primary">✓ Готово</button>';
        html += '</div>';
    }
    html += '  </div>';
    html += '</div>';
    return html;
}

function eventHtml(ev) {
    return '<div class="bk-disaster bkd-event"><div class="bk-disaster-head" style="cursor:default"><span class="bk-disaster-icon">🎲</span><span class="bk-disaster-label">Событие раунда</span></div>'
        + '<div class="bk-disaster-body bk-disaster-full"><div class="bk-disaster-text">' + escapeHtml(ev) + '</div></div></div>';
}

function waitText() {
    var c = chain();
    var left = Math.max(0, (c.total || 0) - (c.doneIds || []).length);
    return left > 0 ? 'Ждём ещё ' + left + ' ' + plural(left, 'игрока', 'игроков', 'игроков') + '…' : 'Все готовы — дальше!';
}

function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

function spectatorHtml() {
    var c = chain();
    var html = observerNoticeHtml({
        drawing: 'Игроки рисуют свои продукты. Потом каждый рисунок уйдёт соседу — он придумает название, а питчить будет другой игрок.',
        naming: 'Игроки придумывают названия чужим рисункам.',
        slogan: 'Игроки пишут слоганы к чужим рисункам и названиям. Скоро начнётся подготовка питчей.',
    }[c.stage] || '');
    html += '<div class="bkd-who">';
    (state.players || []).forEach(function (p) {
        var ok = (c.doneIds || []).indexOf(p.id) !== -1;
        html += '<span class="bkd-who-chip' + (ok ? ' bkd-who-ok' : '') + '">' + (ok ? '✓ ' : ({ drawing: '🎨 ', naming: '🏷 ', slogan: '📣 ' }[c.stage] || '')) + escapeHtml(p.nickname) + '</span>';
    });
    html += '</div>';
    return html;
}

function hostHtml() {
    if (!state.isHost) return '';
    var c = chain();
    if ((c.doneIds || []).length >= (c.total || 0)) return '';
    var note = { drawing: 'Недорисованное уйдёт как есть', naming: 'Без названия останется «Без названия»', slogan: 'Продукт без слогана — тоже продукт' }[c.stage] || '';
    return '<button id="btn-chain-finish" class="dc-host-btn" title="Ведущий: дальше, не дожидаясь всех. ' + note + '">▶ Дальше</button>';
}

function innerHtml() {
    var c = chain();
    var html = hudHtml();
    if (state.isSpectator || !isWorker()) html += spectatorHtml();
    else html += c.stage === 'drawing' ? drawingHtml() : textStageHtml();
    return html;
}

// ─────────── рендер ───────────

export function renderChain(container) {
    container.innerHTML = '<div id="dc-root" class="bkd dc max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">' + innerHtml() + '</div>';
    bind(container.querySelector('#dc-root'));
}

function refresh() {
    var root = document.getElementById('dc-root');
    if (!root) return;
    root.innerHTML = innerHtml();
    bind(root);
    if (state.timerInterval) updateTimerUI();
}

// ─────────── всё на одном экране ───────────
// Холст и чужой рисунок занимают ровно ту высоту, что осталась под остальным экраном.
// Считаем от верха страницы: игра идёт без прокрутки, пока окно не совсем крошечное.
var MIN_ART_H = 170;

function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

export function fitArt(el, reserveBelow, ratio) {
    if (!el) return;
    ratio = ratio || 4 / 3;
    var h = Math.max(MIN_ART_H, Math.floor(window.innerHeight - docTop(el) - (reserveBelow || 16)));
    if (el.tagName === 'IMG' || el.tagName === 'CANVAS') {
        // Ширину считаем сами: у пустой заглушки 4×3 пикселя «родная» ширина крошечная
        var w = el.parentElement ? el.parentElement.clientWidth : window.innerWidth;
        var width = Math.min(w, Math.floor(h * ratio));
        el.style.width = width + 'px';
        el.style.height = Math.floor(width / ratio) + 'px';
        el.style.maxWidth = '100%';
        el.style.maxHeight = 'none';
    } else {
        el.style.maxWidth = Math.floor(h * ratio) + 'px';
    }
}

function fitChain(root) {
    if (!root) return;
    // Снизу на телефоне и планшете висит кнопка музыки — холст под неё не залезает
    var bottomGap = window.innerWidth < 1024 ? 62 : 16;
    var wrap = root.querySelector('.dc-canvas-wrap');
    var tools = root.querySelector('.dc-tools');
    // На телефоне инструменты стоят под холстом — оставляем место и им
    if (wrap && tools && tools.getBoundingClientRect().top > wrap.getBoundingClientRect().top) bottomGap += tools.offsetHeight + 10;
    fitArt(wrap, bottomGap);
    var art = root.querySelector('.dc-preview-fit');
    // На узком экране поле ввода стоит под рисунком — оставляем ему место
    if (art) fitArt(art, window.innerWidth <= 700 ? (root.querySelector('.dc-text-side') ? root.querySelector('.dc-text-side').offsetHeight + 28 : 150) : 16);
    var done = root.querySelector('.dc-done .dc-preview');
    if (done) fitArt(done, 150);
}

var fitBound = false;
function bindFit() {
    if (fitBound) return;
    fitBound = true;
    var t = null;
    window.addEventListener('resize', function () {
        clearTimeout(t);
        t = setTimeout(function () {
            fitChain(document.getElementById('dc-root'));
            var c = document.querySelector('.dc-canvas-wrap canvas');
            if (c) syncCursor(c);
        }, 120);
    });
}

// Кто-то закончил: обновляем счётчики, не трогая холст и поле ввода
export function updateChainProgress() {
    var root = document.getElementById('dc-root');
    if (!root) return;
    var c = chain();
    var box = root.querySelector('#chain-progress b');
    if (box) box.innerHTML = (c.doneIds || []).length + '<small class="bkd-of"> / ' + (c.total || 0) + '</small>';
    var wait = root.querySelector('#chain-wait');
    if (wait) wait.textContent = waitText();
    if (state.isSpectator || root.querySelector('.bkd-who')) { refresh(); return; }
    var host = root.querySelector('#btn-chain-finish');
    if (host && (c.doneIds || []).length >= (c.total || 0)) host.remove();
}

// ─────────── холст ───────────

function blankDataUrl() {
    var cv = document.createElement('canvas');
    cv.width = 4; cv.height = 3;
    var x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 3);
    return cv.toDataURL('image/png');
}

// Перерисовать всё с нуля: фон → сохранённый рисунок → действия по порядку (нужно для отмены)
function redraw(canvas) {
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    if (pad.baseImg && pad.baseImg.complete) ctx.drawImage(pad.baseImg, 0, 0, W, H);
    pad.strokes.forEach(function (s) { applyAction(ctx, s); });
}

function applyAction(ctx, s) {
    if (s.type === 'clear') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); return; }
    if (s.type === 'fill') { floodFill(ctx, s.x, s.y, s.color); return; }
    drawStroke(ctx, s);
}

function drawStroke(ctx, s) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var pts = s.points;
    if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0][0], pts[0][1], s.size / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
        var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.stroke();
}

function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Заливка области одного цвета (построчно, с допуском — чтобы не оставалось светлой каймы у сглаженных линий)
function floodFill(ctx, x, y, hex) {
    x = Math.max(0, Math.min(W - 1, x | 0));
    y = Math.max(0, Math.min(H - 1, y | 0));
    var img = ctx.getImageData(0, 0, W, H);
    var d = img.data;
    var c = hexToRgb(hex);
    var i0 = (y * W + x) * 4;
    var tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    if (Math.abs(tr - c[0]) + Math.abs(tg - c[1]) + Math.abs(tb - c[2]) < 6) return; // уже этого цвета
    var TOL = 110;
    var seen = new Uint8Array(W * H);
    function match(k) {
        var j = k * 4;
        return !seen[k] && Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) <= TOL;
    }
    var stack = [x, y];
    while (stack.length) {
        var cy = stack.pop(), cx = stack.pop();
        var row = cy * W;
        if (!match(row + cx)) continue;
        var lx = cx, rx = cx;
        while (lx > 0 && match(row + lx - 1)) lx--;
        while (rx < W - 1 && match(row + rx + 1)) rx++;
        var upOpen = false, downOpen = false;
        for (var xx = lx; xx <= rx; xx++) {
            var k = row + xx, j = k * 4;
            seen[k] = 1;
            d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
            if (cy > 0) {
                var up = match(k - W);
                if (up && !upOpen) stack.push(xx, cy - 1);
                upOpen = up;
            }
            if (cy < H - 1) {
                var down = match(k + W);
                if (down && !downOpen) stack.push(xx, cy + 1);
                downOpen = down;
            }
        }
    }
    ctx.putImageData(img, 0, 0);
}

function exportImage(canvas) {
    return canvas.toDataURL('image/png');
}

// Сохраняем на сервер не на каждый штрих, а после паузы
function scheduleSave(canvas) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
        var img = exportImage(canvas);
        if (state.chain) state.chain.drawing = img;
        sendMsg({ type: 'drawSave', image: img, strokes: toWire(pad.strokes) });
    }, 1200);
}

// Новое действие: кладём в историю, «вернуть» больше нечего
function commit(root, canvas, action) {
    pad.strokes.push(action);
    pad.redo = [];
    syncTools(root);
    scheduleSave(canvas);
}

function undo(root, canvas) {
    if (!pad.strokes.length) return;
    pad.redo.push(pad.strokes.pop());
    redraw(canvas); syncTools(root); scheduleSave(canvas);
}

function redo(root, canvas) {
    if (!pad.redo.length) return;
    var a = pad.redo.pop();
    pad.strokes.push(a);
    applyAction(canvas.getContext('2d'), a);
    syncTools(root); scheduleSave(canvas);
}

function bindCanvas(root) {
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    var canvas = root.querySelector('#dc-canvas');
    if (!canvas) return;
    if (pad.base && !pad.baseImg) {
        pad.baseImg = new Image();
        pad.baseImg.onload = function () { redraw(canvas); };
        pad.baseImg.src = pad.base;
    }
    redraw(canvas);
    var ctx = canvas.getContext('2d');
    var current = null;
    syncCursor(canvas);

    function pos(e) {
        var r = canvas.getBoundingClientRect();
        return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)];
    }
    // Рисует один палец: второй касается экрана (ладонь, случайный тап) — не рвём и не начинаем новую линию
    var activePointer = null;
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('pointerdown', function (e) {
        if (e.button > 0) return;
        e.preventDefault();
        if (activePointer !== null) return;
        var p = pos(e);
        if (pad.tool === 'fill') {
            var action = { type: 'fill', x: p[0], y: p[1], color: pad.color };
            floodFill(ctx, action.x, action.y, action.color);
            commit(root, canvas, action);
            return;
        }
        activePointer = e.pointerId;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
        var eraser = pad.tool === 'eraser';
        // Ластик рисует белым и чуть шире кисти — так удобнее стирать
        current = { color: eraser ? '#ffffff' : pad.color, size: eraser ? Math.round(pad.size * 1.5) : pad.size, points: [p] };
        drawStroke(ctx, current);
    });
    canvas.addEventListener('pointermove', function (e) {
        if (!current || e.pointerId !== activePointer) return;
        // Быстрый росчерк пальцем: браузер склеивает промежуточные точки — берём их все, линия выходит гладкой
        var events = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
        if (!events || !events.length) events = [e];
        ctx.strokeStyle = current.color;
        ctx.lineWidth = current.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (var i = 0; i < events.length; i++) {
            var p = pos(events[i]);
            var last = current.points[current.points.length - 1];
            if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 2) continue;
            current.points.push(p);
            // Рисуем отрезок сразу, целиком штрих перерисуется при отмене
            ctx.beginPath();
            ctx.moveTo(last[0], last[1]);
            ctx.lineTo(p[0], p[1]);
            ctx.stroke();
        }
    });
    function end(e) {
        if (e && e.pointerId !== activePointer) return;
        activePointer = null;
        if (!current) return;
        var s = current;
        current = null;
        commit(root, canvas, s);
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    root.querySelectorAll('[data-color]').forEach(function (b) {
        b.addEventListener('click', function () {
            pad.color = b.getAttribute('data-color');
            if (pad.tool === 'eraser') pad.tool = 'brush'; // выбрали цвет — значит, хотят рисовать
            syncTools(root); syncCursor(canvas);
        });
    });
    var picker = root.querySelector('#dc-color-input');
    if (picker) picker.addEventListener('input', function () {
        pad.color = picker.value;
        if (pad.tool === 'eraser') pad.tool = 'brush';
        syncTools(root); syncCursor(canvas);
    });
    root.querySelectorAll('[data-size]').forEach(function (b) {
        b.addEventListener('click', function () {
            pad.size = parseInt(b.getAttribute('data-size'), 10);
            if (pad.tool === 'fill') pad.tool = 'brush';
            syncTools(root); syncCursor(canvas);
        });
    });
    root.querySelectorAll('[data-tool]').forEach(function (b) {
        b.addEventListener('click', function () {
            pad.tool = b.getAttribute('data-tool');
            syncTools(root); syncCursor(canvas);
        });
    });
    root.querySelectorAll('[data-action]').forEach(function (b) {
        b.addEventListener('click', function () {
            var a = b.getAttribute('data-action');
            if (a === 'undo') undo(root, canvas);
            else if (a === 'redo') redo(root, canvas);
            else if (a === 'clear') {
                if (!pad.strokes.length && !pad.base) return;
                var clear = { type: 'clear' };
                applyAction(ctx, clear);
                commit(root, canvas, clear);
            }
        });
    });

    // Горячие клавиши: Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z), B — кисть, F — заливка, E — ластик, [ ] — толщина
    keyHandler = function (e) {
        if (!document.body.contains(canvas)) { document.removeEventListener('keydown', keyHandler); keyHandler = null; return; }
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        var k = e.key.toLowerCase();
        var mod = e.ctrlKey || e.metaKey;
        if (mod && (k === 'z' || k === 'я')) { e.preventDefault(); if (e.shiftKey) redo(root, canvas); else undo(root, canvas); return; }
        if (mod && (k === 'y' || k === 'н')) { e.preventDefault(); redo(root, canvas); return; }
        if (mod || e.altKey) return;
        var tool = { b: 'brush', 'и': 'brush', f: 'fill', 'а': 'fill', e: 'eraser', 'у': 'eraser' }[k];
        if (tool) { pad.tool = tool; syncTools(root); syncCursor(canvas); return; }
        if (k === '[' || k === ']' || k === 'х' || k === 'ъ') {
            var i = SIZES.indexOf(pad.size) + (k === '[' || k === 'х' ? -1 : 1);
            if (i >= 0 && i < SIZES.length) { pad.size = SIZES[i]; syncTools(root); syncCursor(canvas); }
        }
    };
    document.addEventListener('keydown', keyHandler);

    var done = root.querySelector('#btn-draw-done');
    if (done) done.addEventListener('click', function () {
        clearTimeout(saveTimer);
        var img = exportImage(canvas);
        state.chain.drawing = img;
        state.chain.done = true;
        sendMsg({ type: 'drawSave', image: img, strokes: toWire(pad.strokes), done: true });
        playSound('success');
        refresh();
    });
}

// Курсор — кружок размером с кисть (на экране, с учётом масштаба холста)
function syncCursor(canvas) {
    if (pad.tool === 'fill') { canvas.style.cursor = 'cell'; return; }
    var r = canvas.getBoundingClientRect();
    var scale = r.width ? r.width / W : 1;
    var size = (pad.tool === 'eraser' ? pad.size * 1.5 : pad.size) * scale;
    var d = Math.max(6, Math.min(64, Math.round(size)));
    var h = d / 2;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (d + 2) + '" height="' + (d + 2) + '"><circle cx="' + (h + 1) + '" cy="' + (h + 1) + '" r="' + h + '" fill="none" stroke="black" stroke-width="1"/><circle cx="' + (h + 1) + '" cy="' + (h + 1) + '" r="' + Math.max(0, h - 1) + '" fill="none" stroke="white" stroke-width="1"/></svg>';
    canvas.style.cursor = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '") ' + (h + 1) + ' ' + (h + 1) + ', crosshair';
}

function syncTools(root) {
    root.querySelectorAll('[data-color]').forEach(function (b) {
        b.classList.toggle('dc-on', b.getAttribute('data-color') === pad.color);
    });
    var custom = root.querySelector('.dc-custom');
    if (custom) {
        var isCustom = COLORS.indexOf(pad.color) === -1;
        custom.classList.toggle('dc-on', isCustom);
        custom.style.setProperty('--c', isCustom ? pad.color : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)');
    }
    root.querySelectorAll('[data-size]').forEach(function (b) {
        b.classList.toggle('dc-on', parseInt(b.getAttribute('data-size'), 10) === pad.size);
    });
    root.querySelectorAll('[data-tool]').forEach(function (b) {
        b.classList.toggle('dc-on', b.getAttribute('data-tool') === pad.tool);
    });
    var u = root.querySelector('[data-action="undo"]');
    if (u) u.disabled = !pad.strokes.length;
    var r = root.querySelector('[data-action="redo"]');
    if (r) r.disabled = !pad.redo.length;
}

// ─────────── события ───────────

function bind(root) {
    if (!root) return;
    fitChain(root);
    bindFit();
    bindCanvas(root);

    var edit = root.querySelector('#btn-draw-edit');
    if (edit) edit.addEventListener('click', function () {
        state.chain.done = false;
        sendMsg({ type: 'drawEdit' });
        refresh();
    });

    var input = root.querySelector('#dc-text');
    if (input) {
        input.addEventListener('input', function () {
            state.chain.text = input.value;
            clearTimeout(nameTimer);
            nameTimer = setTimeout(function () { sendMsg({ type: 'chainText', text: input.value }); }, 700);
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); submitText(root); }
        });
        if (window.innerWidth >= 640) setTimeout(function () { input.focus(); }, 50);
    }
    var textDone = root.querySelector('#btn-text-done');
    if (textDone) textDone.addEventListener('click', function () { submitText(root); });

    var textEdit = root.querySelector('#btn-text-edit');
    if (textEdit) textEdit.addEventListener('click', function () {
        state.chain.done = false;
        sendMsg({ type: 'chainText', text: state.chain.text || '', done: false });
        refresh();
    });

    var fin = root.querySelector('#btn-chain-finish');
    if (fin) fin.addEventListener('click', async function () {
        if (!await askConfirm('Перейти дальше, не дожидаясь всех? ' + fin.title.replace(/^.*?\. /, ''))) return;
        sendMsg({ type: 'chainFinish' });
    });

    var exit = root.querySelector('#btn-exit-chain');
    if (exit) exit.addEventListener('click', async function () {
        if (await askConfirm('Выйти из игры?')) leaveRoom();
    });
}

function submitText(root) {
    var input = root.querySelector('#dc-text');
    var text = input ? input.value.replace(/\s+/g, ' ').trim() : '';
    if (!text) {
        if (input) { input.classList.add('dc-shake'); setTimeout(function () { input.classList.remove('dc-shake'); }, 500); input.focus(); }
        return;
    }
    clearTimeout(nameTimer);
    state.chain.text = text;
    state.chain.done = true;
    sendMsg({ type: 'chainText', text: text, done: true });
    playSound('success');
    refresh();
}

// ─────────── продукт на подготовке и сцене ───────────

// Рисунок, тексты, авторы и карты — одним блоком, чтобы экран помещался без прокрутки.
// stage — на сцене питча: продукт «вскрывается» по шагам (startProductReplay), есть «повтор» рисования
export function chainProductHtml(product, cards, stage) {
    if (!product) return '';
    var replay = stage && product.strokes && product.strokes.length;
    var html = '<div class="dc-product' + (stage ? ' dc-product-stage' : '') + (replay ? ' dc-has-replay' : '') + '">';
    if (stage) {
        // Рассказчик разоблачения: что сейчас вскрывается
        html += '<div class="dc-seq-caption"><span class="dc-seq-text"></span><button class="dc-seq-skip" type="button">Пропустить ⏭</button></div>';
    }
    html += '  <div class="dc-product-art">';
    if (replay) {
        html += '<canvas class="dc-replay" width="' + W + '" height="' + H + '"></canvas>';
        html += '<button class="dc-replay-btn" title="Показать, как рисовали">▶ Как рисовали</button>';
    } else {
        html += '<img class="dc-product-img" src="' + (product.drawing || blankDataUrl()) + '" alt="Рисунок продукта">';
    }
    if (stage) html += '<div class="dc-curtain"><span>?</span></div>';
    html += '  </div>';
    html += '  <div class="dc-product-meta">';
    html += '    <div class="dc-product-name" data-seq="name">' + escapeHtml(product.name || 'Без названия') + '</div>';
    if (product.withSlogan) html += '<div class="dc-product-slogan" data-seq="slogan">' + (product.slogan ? '«' + escapeHtml(product.slogan) + '»' : '<i>без слогана</i>') + '</div>';
    html += '    <div class="dc-product-credits" data-seq="credits">🎨 ' + escapeHtml(product.artist || '—') + ' · 🏷 ' + escapeHtml(product.namer || '—') + (product.withSlogan ? ' · 📣 ' + escapeHtml(product.sloganAuthor || '—') : '') + '</div>';
    if (!product.drawing) html += '<div class="dc-product-empty" data-seq="credits">художник не успел нарисовать</div>';
    html += '  </div>';
    // Карты — отдельной ячейкой: на компьютере под текстами справа, на телефоне лентой на всю ширину
    if (cards) html += '<div class="dc-product-cards">' + cardsHtml(cards) + '</div>';
    html += '</div>';
    return html;
}

// Сколько длится разоблачение — сервер добавляет примерно столько же к таймеру питча
export var REVEAL = { intro: 1300, card: 280, draw: 4000, name: 900, slogan: 1500 };

// ─────────── разоблачение на сцене ───────────
// 🥁 интрига → 🃏 карты по одной → 🎨 рисунок штрих за штрихом → 🏷 название печатью → 📣 слоган по буквам → 🎤 питч
var replayed = {};
export function startProductReplay(root, product, key) {
    var block = root && root.querySelector('.dc-product-stage');
    if (!block || !product) return;
    var canvas = block.querySelector('.dc-replay');
    var actions = canvas && product.strokes ? fromWire(product.strokes) : [];
    var btn = block.querySelector('.dc-replay-btn');
    var caption = block.querySelector('.dc-seq-text');
    var timers = [];

    function finalFrame() {
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
        actions.forEach(function (a) { applyAction(ctx, a); });
    }
    function replayDrawing() {
        if (!canvas) return;
        if (btn) btn.disabled = true;
        playTimelapse(canvas, actions, REVEAL.draw, function () { finalFrame(); if (btn) btn.disabled = false; });
    }
    if (btn) btn.addEventListener('click', replayDrawing);

    // Всё видно сразу: перерисовка той же сцены (реакции, вопросы) или «Пропустить»
    function showAll() {
        timers.forEach(clearTimeout);
        timers = [];
        if (canvas) { canvas._replayId = (canvas._replayId || 0) + 1; finalFrame(); }
        block.classList.remove('dc-seq');
        block.classList.add('dc-seq-done');
        block.querySelectorAll('.dc-seq-hide').forEach(function (el) { el.classList.remove('dc-seq-hide'); });
        var slogan = block.querySelector('[data-seq="slogan"]');
        if (slogan && slogan._full !== undefined) slogan.innerHTML = slogan._full;
        if (caption) caption.textContent = '🎤 Питч!';
        if (btn) btn.disabled = false;
    }
    if (key && replayed[key]) { showAll(); return; }
    if (key) replayed[key] = true;

    var at = function (ms, fn) { timers.push(setTimeout(function () { if (document.body.contains(block)) fn(); }, ms)); };
    var say = function (text) {
        if (!caption) return;
        caption.textContent = text;
        caption.classList.remove('dc-seq-pop'); void caption.offsetWidth; caption.classList.add('dc-seq-pop');
    };

    // Исходное состояние: всё спрятано, рисунок под занавесом
    block.classList.add('dc-seq');
    var chips = Array.prototype.slice.call(block.querySelectorAll('.dc-product-cards .dc-chip'));
    var steps = chips.concat(Array.prototype.slice.call(block.querySelectorAll('[data-seq]')));
    steps.forEach(function (el) { el.classList.add('dc-seq-hide'); });
    if (canvas) { var c0 = canvas.getContext('2d'); c0.fillStyle = '#ffffff'; c0.fillRect(0, 0, W, H); }
    if (btn) btn.disabled = true;
    var skip = block.querySelector('.dc-seq-skip');
    if (skip) skip.addEventListener('click', showAll);

    // 1. Интрига
    say('🥁 Что же получилось?..');
    playSound('drumroll');
    var t = REVEAL.intro;

    // 2. Задумка: карты по одной
    at(t, function () { say('🃏 Задумка'); });
    chips.forEach(function (chip, i) {
        at(t + i * REVEAL.card, function () { chip.classList.remove('dc-seq-hide'); chip.classList.add('dc-seq-in'); playSound('tick'); });
    });
    t += chips.length * REVEAL.card + 300;

    // 3. Рисунок: занавес вверх, штрих за штрихом
    at(t, function () {
        say('🎨 Рисует ' + (product.artist || '…'));
        block.classList.add('dc-curtain-up');
        playSound('whoosh');
        if (canvas && actions.length) playTimelapse(canvas, actions, REVEAL.draw, finalFrame);
    });
    t += canvas && actions.length ? REVEAL.draw : 800;

    // 4. Название — печатью
    var name = block.querySelector('[data-seq="name"]');
    at(t, function () {
        say('🏷 Называет ' + (product.namer || '…'));
        if (name) { name.classList.remove('dc-seq-hide'); name.classList.add('dc-stamp'); }
        block.classList.add('dc-shake');
        playSound('stamp');
    });
    t += REVEAL.name;

    // 5. Слоган — по буквам
    var slogan = block.querySelector('[data-seq="slogan"]');
    if (slogan) {
        at(t, function () {
            say('📣 Слоган — ' + (product.sloganAuthor || '…'));
            slogan._full = slogan.innerHTML;
            var text = slogan.textContent;
            slogan.textContent = '';
            slogan.classList.remove('dc-seq-hide');
            var n = 0, stepMs = Math.max(20, Math.min(60, (REVEAL.slogan - 300) / Math.max(1, text.length)));
            var typer = setInterval(function () {
                if (!document.body.contains(slogan) || slogan._full === undefined) { clearInterval(typer); return; }
                n++;
                slogan.textContent = text.slice(0, n);
                if (n >= text.length) { clearInterval(typer); slogan.innerHTML = slogan._full; }
            }, stepMs);
            timers.push(typer);
        });
        t += REVEAL.slogan;
    }

    // 6. Питч!
    at(t, function () {
        block.querySelectorAll('.dc-seq-hide').forEach(function (el) { el.classList.remove('dc-seq-hide'); });
        say('🎤 Питч!');
        block.classList.remove('dc-seq');
        block.classList.add('dc-seq-done');
        if (btn) btn.disabled = false;
        playSound('success');
    });
}

// ─────────── миниатюра и просмотр на весь экран (инвестиции) ───────────

export function chainThumbHtml(product) {
    if (!product) return '';
    return '<button type="button" class="dc-thumb" data-art-open title="Посмотреть рисунок">'
        + '<img src="' + (product.drawing || blankDataUrl()) + '" alt="Рисунок продукта"><span class="dc-thumb-zoom">⤢</span></button>';
}

// Нажали на миниатюру — рисунок на весь экран с названием; закрывается касанием или Esc
export function bindArtLightbox(root) {
    if (!root) return;
    root.querySelectorAll('[data-art-open]').forEach(function (b) {
        b.addEventListener('click', function () {
            var card = b.closest('[data-product-name]');
            var title = card ? card.getAttribute('data-product-name') : '';
            var sub = card ? card.getAttribute('data-product-slogan') : '';
            var box = document.createElement('div');
            box.className = 'dc-lightbox';
            box.innerHTML = '<div class="dc-lightbox-inner"><img src="' + b.querySelector('img').src + '" alt="Рисунок продукта">'
                + (title ? '<div class="dc-lightbox-name">' + escapeHtml(title) + '</div>' : '')
                + (sub ? '<div class="dc-lightbox-slogan">«' + escapeHtml(sub) + '»</div>' : '')
                + '<div class="dc-lightbox-hint">нажмите, чтобы закрыть</div></div>';
            function close() { box.remove(); document.removeEventListener('keydown', onKey); }
            function onKey(e) { if (e.key === 'Escape') close(); }
            box.addEventListener('click', close);
            document.addEventListener('keydown', onKey);
            document.body.appendChild(box);
        });
    });
}

function playTimelapse(canvas, actions, duration, onDone) {
    var ctx = canvas.getContext('2d');
    // Вес шага: точка штриха — 1, заливка и очистка — заметная пауза
    var steps = [];
    actions.forEach(function (a, ai) {
        if (a.type === 'fill' || a.type === 'clear') steps.push({ a: ai, i: 0, w: 12 });
        else a.points.forEach(function (pt, pi) { steps.push({ a: ai, i: pi, w: 1 }); });
    });
    var total = steps.reduce(function (sum, st) { return sum + st.w; }, 0) || 1;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    var done = 0, acc = 0, start = null;
    canvas._replayId = (canvas._replayId || 0) + 1;
    var myId = canvas._replayId;
    function frame(ts) {
        if (canvas._replayId !== myId || !document.body.contains(canvas)) return;
        if (start === null) start = ts;
        var target = Math.min(total, total * (ts - start) / duration);
        while (done < steps.length && acc + steps[done].w <= target + 0.0001) {
            var st = steps[done], a = actions[st.a];
            if (a.type === 'fill' || a.type === 'clear') applyAction(ctx, a);
            else if (st.i === 0) drawStroke(ctx, { color: a.color, size: a.size, points: [a.points[0]] });
            else {
                var p0 = a.points[st.i - 1], p1 = a.points[st.i];
                ctx.strokeStyle = a.color; ctx.lineWidth = a.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
            }
            acc += st.w;
            done++;
        }
        if (done < steps.length) requestAnimationFrame(frame);
        else if (onDone) onDone();
    }
    requestAnimationFrame(frame);
}

// Подготовка и сцена: рисунок продукта занимает столько, сколько осталось под всем остальным
export function fitProductArt(container) {
    var art = container && container.querySelector('.dc-product-img, .dc-replay');
    if (!art) return;
    var page = container.firstElementChild || container;
    var bottom = 0;
    Array.prototype.forEach.call(page.children, function (k) {
        if (k.contains(art)) return;
        bottom = Math.max(bottom, k.getBoundingClientRect().bottom + window.scrollY);
    });
    var block = art.closest('.dc-product');
    var blockBottom = block ? block.getBoundingClientRect().bottom + window.scrollY : 0;
    var artBottom = art.getBoundingClientRect().bottom + window.scrollY;
    // Что стоит ниже рисунка: остаток блока продукта и всё, что под ним
    var reserve = Math.max(0, blockBottom - artBottom) + Math.max(0, bottom - blockBottom) + 20;
    fitArt(art, reserve);
}
