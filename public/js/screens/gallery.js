// ═══════════════════════════════════════════
// ГАЛЕРЕЯ — финал «Испорченного прототипа» без микрофона и без жетонов.
// Продукты по одному выходят рекламным комиксом: рисунок оживает штрих за штрихом, название — печатью,
// кадры по картам, слоган по буквам — и в конце настоящие карты («а задумывалось так…»).
// Пока идёт показ, зал жмёт реакции: реакция засчитывается кадру, который сейчас на экране,
// и над кадром растёт счётчик. Лучший кадр и любимый продукт зала — в итогах раунда.
// Показ у всех синхронный (как по телевизору): пропустить нельзя — иначе реакции уйдут не тому кадру.
// ═══════════════════════════════════════════
import { state, escapeHtml } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';
import { playSound } from '../components/sound.js';
import { askConfirm } from '../components/confirm.js';
import { drawWireFinal, playWireTimelapse, chainCardsHtml } from './draw-chain.js';

// Длительности показа — те же, что на сервере (GALLERY_T): по ним сервер понимает, какой кадр на экране
var T = { intro: 1300, draw: 3800, panel: 4400, panelGap: 600, name: 1300, slogan: 2000, truth: 3000 };

function hudHtml(label, right) {
    var html = '<div class="bk-hud gal-hud">';
    html += '  <div class="bk-hud-round"><span>Раунд</span><b>' + (state.currentRound || 1) + '<small class="bkd-of">/' + (state.totalRounds || 1) + '</small></b></div>';
    html += '  <div class="bk-hud-mid">';
    html += '    <div class="bk-hud-line"><span>' + label + '</span><span data-timer-text></span></div>';
    html += '    <div class="timer-bar-container"><div class="timer-bar" data-timer-bar style="width:100%"></div></div>';
    html += '  </div>';
    html += right || '';
    html += '  <button id="btn-exit-gal" class="bk-hud-exit" title="Выйти из игры">✕</button>';
    html += '</div>';
    return html;
}

var shown = {};       // какие продукты уже «разыграны» — при перерисовке экрана не повторяем
var timers = [];

function clearTimers() {
    timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    timers = [];
}

function likesBadge(n) {
    return '❤️ ' + (n || 0);
}

export function renderGallery(container) {
    clearTimers();
    var g = state.gallery || {};
    var item = g.item;
    if (!item) { container.innerHTML = ''; return; }
    var likes = g.likes || {};
    var draws = item.frames.filter(function (f) { return f.kind === 'draw'; });
    var name = item.frames.find(function (f) { return f.stage === 'naming'; });
    var slogan = item.frames.find(function (f) { return f.stage === 'slogan'; });

    var right = '<div class="bk-hud-seats gal-product-likes"><span>Зал</span><b id="gal-product-likes">' + likesBadge(g.productLikes) + '</b></div>';
    if (state.isHost) right += '<button id="btn-gal-next" class="dc-host-btn gal-next">' + (g.index + 1 >= g.total ? '🏁 К итогам' : '⏭ Дальше') + '</button>';

    var html = '<div id="gal-root" class="bkd gal max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">';
    html += hudHtml('🖼️ ГАЛЕРЕЯ · продукт ' + (g.index + 1) + ' из ' + g.total, right);
    html += '<div class="gal-stage">';
    html += '  <div class="gal-caption"><span class="gal-caption-text"></span></div>';
    html += '  <div class="gal-title gal-hide" data-seq="' + (name ? name.id : 'naming') + '">' + (name && name.text ? '«' + escapeHtml(name.text) + '»' : '<i>Без названия</i>')
        + (name && !name.empty ? '<span class="gal-likes gal-likes-inline' + (likes[name.id] ? '' : ' gal-likes-zero') + '" data-likes="' + name.id + '">' + likesBadge(likes[name.id]) + '</span>' : '') + '</div>';
    html += '  <div class="gal-comic" data-count="' + draws.length + '">';
    draws.forEach(function (f) {
        html += '<figure class="gal-frame gal-hide" data-seq="' + f.id + '">';
        html += '  <figcaption class="gal-frame-head"><span>' + f.emoji + ' ' + escapeHtml(f.label) + '</span>' + (f.card ? '<b>' + escapeHtml(f.card) + '</b>' : '') + '</figcaption>';
        html += '  <div class="gal-frame-art"><canvas width="800" height="600"></canvas>' + (f.empty ? '<div class="gal-frame-empty">не успели нарисовать 🙈</div>' : '');
        if (!f.empty) html += '<span class="gal-likes' + (likes[f.id] ? '' : ' gal-likes-zero') + '" data-likes="' + f.id + '">' + likesBadge(likes[f.id]) + '</span>';
        html += '  </div>';
        html += '</figure>';
    });
    html += '  </div>';
    if (slogan) html += '<div class="gal-slogan gal-hide" data-seq="' + slogan.id + '">' + (slogan.text ? '«' + escapeHtml(slogan.text) + '»' : '<i>без слогана</i>')
        + (!slogan.empty ? '<span class="gal-likes gal-likes-inline' + (likes[slogan.id] ? '' : ' gal-likes-zero') + '" data-likes="' + slogan.id + '">' + likesBadge(likes[slogan.id]) + '</span>' : '') + '</div>';
    html += '  <div class="gal-truth gal-hide" data-seq="truth"><span class="gal-truth-label">🃏 А задумывалось так:</span>' + chainCardsHtml(item.cards) + '</div>';
    html += '  <div class="gal-wait">😂 🔥 👏 Жмите реакции, пока кадр на экране — лучший кадр выбирает зал' + (state.isHost ? '' : '. Листает ведущий') + '</div>';
    html += '</div>';
    html += '</div>';
    container.innerHTML = html;

    var root = container.querySelector('#gal-root');
    var exit = root.querySelector('#btn-exit-gal');
    if (exit) exit.addEventListener('click', async function () {
        if (await askConfirm('Выйти из игры?')) leaveRoom();
    });
    var next = root.querySelector('#btn-gal-next');
    if (next) next.addEventListener('click', function () {
        next.disabled = true;
        sendMsg({ type: 'galleryNext', index: g.index });
    });
    requestAnimationFrame(function () { fitComic(root); });
    bindComicResize();

    var key = state.currentRound + ':' + g.index;
    if (shown[key] || g.restored) { showAll(root, item); return; }
    shown[key] = true;
    playReveal(root, item);
}

// Реакция из зала: растим счётчик над кадром, который её получил
export function onGalleryReaction(msg) {
    if (state.phase !== 'gallery' || !state.gallery) return;
    var score = function (t) { return t ? t.total - ((t.byEmotion && t.byEmotion.tomato) || 0) : 0; };
    if (msg.galleryFrameId) {
        var n = score(msg.frameTally);
        state.gallery.likes = state.gallery.likes || {};
        state.gallery.likes[msg.galleryFrameId] = n;
        var el = document.querySelector('[data-likes="' + msg.galleryFrameId + '"]');
        if (el) {
            el.textContent = likesBadge(n);
            el.classList.remove('gal-likes-zero', 'gal-likes-pop'); void el.offsetWidth; el.classList.add('gal-likes-pop');
        }
    }
    if (msg.productTally && state.gallery.item && msg.galleryProduct === state.gallery.item.index) {
        state.gallery.productLikes = score(msg.productTally);
        var p = document.getElementById('gal-product-likes');
        if (p) p.textContent = likesBadge(state.gallery.productLikes);
    }
}

// Кадры — как можно крупнее: подбираем число колонок под свободное место
function fitComic(root) {
    var comic = root && root.querySelector('.gal-comic');
    if (!comic) return;
    var n = parseInt(comic.getAttribute('data-count'), 10) || 1;
    var below = 0;
    ['.gal-slogan', '.gal-truth', '.gal-wait'].forEach(function (sel) {
        var el = root.querySelector(sel);
        if (el) below += el.offsetHeight + 10;
    });
    var top = comic.getBoundingClientRect().top + window.scrollY;
    var bottomGap = window.innerWidth < 1024 ? 64 : 18;
    var availH = Math.max(160, window.innerHeight - top - below - bottomGap);
    var availW = comic.clientWidth;
    var gap = 10, head = 30;
    var best = 0;
    for (var cols = 1; cols <= n; cols++) {
        var rows = Math.ceil(n / cols);
        var w = Math.min((availW - gap * (cols - 1)) / cols, ((availH - gap * (rows - 1)) / rows - head) * 4 / 3);
        if (w > best) best = w;
    }
    comic.style.setProperty('--gal-w', Math.max(120, Math.floor(best)) + 'px');
}

var resizeBound = false;
function bindComicResize() {
    if (resizeBound) return;
    resizeBound = true;
    var t = null;
    window.addEventListener('resize', function () {
        clearTimeout(t);
        t = setTimeout(function () { fitComic(document.getElementById('gal-root')); }, 120);
    });
}

function say(root, text) {
    var cap = root.querySelector('.gal-caption-text');
    if (!cap) return;
    cap.textContent = text;
    cap.classList.remove('dc-seq-pop'); void cap.offsetWidth; cap.classList.add('dc-seq-pop');
}

function reveal(el, cls) {
    if (!el) return;
    el.classList.remove('gal-hide');
    if (cls) el.classList.add(cls);
}

// Нет штрихов (пустой кадр) — рисуем картинку
function paintImage(canvas, src) {
    var img = new Image();
    img.onload = function () { canvas.getContext('2d').drawImage(img, 0, 0, 800, 600); };
    img.src = src;
}

function showAll(root, item) {
    clearTimers();
    var draws = item.frames.filter(function (x) { return x.kind === 'draw'; });
    root.querySelectorAll('.gal-frame canvas').forEach(function (c, i) {
        var f = draws[i];
        if (!f) return;
        if (f.strokes && f.strokes.length) drawWireFinal(c, f.strokes);
        else if (f.image) paintImage(c, f.image);
        else drawWireFinal(c, []);
    });
    root.querySelectorAll('.gal-hide, .dc-seq-hide').forEach(function (el) { el.classList.remove('gal-hide', 'dc-seq-hide'); });
    say(root, state.isHost ? '👀 Нажмите «Дальше», когда насмотритесь' : '👀 Любуемся');
    requestAnimationFrame(function () { fitComic(root); });
}

function playReveal(root, item) {
    var at = function (ms, fn) { timers.push(setTimeout(function () { if (document.body.contains(root)) fn(); }, ms)); };
    // Холсты — белые, пока кадр не вышел
    root.querySelectorAll('.gal-frame canvas').forEach(function (c) { drawWireFinal(c, []); });

    var g = state.gallery || {};
    var t0 = g.delay || 0;
    at(t0, function () {
        say(root, '🥁 Продукт ' + (g.index + 1) + ' из ' + g.total + '…');
        playSound('drumroll');
    });
    var t = t0 + T.intro;

    item.frames.forEach(function (f) {
        var el = root.querySelector('[data-seq="' + f.id + '"]');
        if (f.stage === 'naming') {
            at(t, function () { say(root, '🏷 Как это называется'); reveal(el, 'dc-stamp'); playSound('stamp'); });
            t += T.name;
        } else if (f.stage === 'slogan') {
            at(t, function () {
                say(root, '📣 Слоган');
                if (!el) return;
                var full = el.innerHTML, text = (el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild.textContent : el.textContent);
                el.textContent = '';
                reveal(el);
                var n = 0, step = Math.max(20, Math.min(60, (T.slogan - 300) / Math.max(1, text.length)));
                var typer = setInterval(function () {
                    if (!document.body.contains(el)) { clearInterval(typer); return; }
                    n++;
                    el.textContent = text.slice(0, n);
                    if (n >= text.length) { clearInterval(typer); el.innerHTML = full; }
                }, step);
                timers.push(typer);
            });
            t += T.slogan;
        } else {
            var dur = f.stage === 'drawing' ? T.draw : T.panel - T.panelGap;
            at(t, function () {
                say(root, f.stage === 'drawing' ? '🎨 Продукт' : f.emoji + ' ' + f.label + (f.card ? ': ' + f.card : ''));
                reveal(el, 'gal-frame-in');
                playSound('whoosh');
                var canvas = el && el.querySelector('canvas');
                if (!canvas) return;
                if (f.strokes && f.strokes.length) playWireTimelapse(canvas, f.strokes, dur, function () { drawWireFinal(canvas, f.strokes); });
                else if (f.image) paintImage(canvas, f.image);
            });
            t += f.stage === 'drawing' ? T.draw : T.panel;
        }
    });

    // Разоблачение: что было на картах на самом деле
    at(t, function () {
        say(root, '🃏 А задумывалось так…');
        var truth = root.querySelector('[data-seq="truth"]');
        reveal(truth, 'gal-truth-in');
        (truth ? truth.querySelectorAll('.dc-chip') : []).forEach(function (chip, i) {
            chip.classList.add('dc-seq-hide');
            at(t + 250 + i * 260, function () { chip.classList.remove('dc-seq-hide'); chip.classList.add('dc-seq-in'); playSound('tick'); });
        });
        playSound('stamp');
    });
    t += T.truth;
    at(t, function () { showAll(root, item); playSound('success'); });
}
