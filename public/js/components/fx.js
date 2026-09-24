// ═══════════════════════════════════════════
// Короткие эффекты поверх интерфейса: монеты, конфетти, набегающие цифры.
// Частицы живут в body с position:fixed и сами удаляются.
// ═══════════════════════════════════════════

function reducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
}

var CONFETTI_COLORS = ['#ffc72c', '#1b2fe8', '#00b4ff', '#ff3b3b', '#22c55e', '#f5f5f0'];

/**
 * Разлёт частиц из центра элемента.
 * opts: emojis — массив символов (иначе цветные квадратики-конфетти),
 *       count, spread (px), lift (насколько вверх), size (px)
 */
export function burst(el, opts) {
    // Элемент мог исчезнуть, пока ждали таймера (экран сменился) — тогда молчим,
    // иначе частицы вылетели бы из левого верхнего угла
    if (!el || !document.body.contains(el) || reducedMotion()) return;
    opts = opts || {};
    var rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var count = opts.count || 14;
    var spread = opts.spread || 140;
    var lift = opts.lift === undefined ? 90 : opts.lift;

    for (var i = 0; i < count; i++) {
        var p = document.createElement('div');
        p.className = 'fx-particle';
        var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
        var dist = spread * (0.55 + Math.random() * 0.6);
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist * 0.75 - lift * (0.5 + Math.random() * 0.7);
        if (opts.emojis) {
            p.textContent = opts.emojis[i % opts.emojis.length];
            p.style.fontSize = (opts.size || 22) + 'px';
            p.style.lineHeight = '1';
        } else {
            var sz = 6 + Math.random() * 6;
            p.style.width = sz + 'px';
            p.style.height = (Math.random() > 0.5 ? sz : sz * 0.45) + 'px';
            p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
            p.style.borderRadius = Math.random() > 0.6 ? '50%' : '2px';
        }
        p.style.setProperty('--x0', (cx - 8) + 'px');
        p.style.setProperty('--y0', (cy - 8) + 'px');
        p.style.setProperty('--dx', dx.toFixed(0) + 'px');
        p.style.setProperty('--dy', dy.toFixed(0) + 'px');
        p.style.setProperty('--rot', ((Math.random() - 0.5) * 540).toFixed(0) + 'deg');
        p.style.setProperty('--s', (0.8 + Math.random() * 0.5).toFixed(2));
        p.style.setProperty('--dur', (0.75 + Math.random() * 0.5).toFixed(2) + 's');
        document.body.appendChild(p);
        (function (node) { setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1400); })(p);
    }
}

// Монеты — для вложений
export function coinBurst(el) {
    burst(el, { emojis: ['🪙', '💰', '🪙', '💸'], count: 12, spread: 160, lift: 120, size: 24 });
}

/**
 * Цифры «набегают» от нуля до значения из data-countup.
 * Итоговое число уже стоит в разметке — без анимации оно просто остаётся.
 */
export function countUp(root, delay) {
    if (!root || reducedMotion()) return;
    var els = root.querySelectorAll('[data-countup]');
    if (!els.length) return;
    var start = performance.now() + (delay || 250);
    var duration = 900;
    function frame(now) {
        var t = Math.min(1, Math.max(0, (now - start) / duration));
        var eased = 1 - Math.pow(1 - t, 3);
        for (var i = 0; i < els.length; i++) {
            var target = parseInt(els[i].getAttribute('data-countup'), 10) || 0;
            els[i].textContent = Math.round(target * eased);
        }
        if (t < 1 && document.body.contains(root)) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
