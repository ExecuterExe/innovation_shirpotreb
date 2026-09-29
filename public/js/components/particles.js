// Фоновые частицы — лёгкое «созвездие» за интерфейсом.
// Экономия: 30 кадров в секунду вместо 60, частиц меньше на маленьких экранах,
// на скрытой вкладке и в облегчённой графике — стоп.
import { isLite, onPerfChange } from './perf.js';

var canvas, ctx;
var particles = [];
var running = false;
var lastFrame = 0;
var FRAME_MS = 1000 / 30;
var LINK_DIST = 150;

function targetCount() {
    var area = window.innerWidth * window.innerHeight;
    // ~40 на большом мониторе, ~18 на телефоне
    return Math.max(14, Math.min(40, Math.round(area / 40000)));
}

function seed() {
    var n = targetCount();
    particles = [];
    for (var i = 0; i < n; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.2 - 0.08,
            radius: Math.random() * 1.8 + 0.5,
            opacity: Math.random() * 0.22 + 0.06,
        });
    }
}

export function initParticles() {
    canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    var resizeTimer = null;
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (particles.length !== targetCount()) seed();
    }
    resize();
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
    });

    onPerfChange(function (lite) { if (lite) stop(); else start(); });
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else if (!isLite()) start();
    });
    if (!isLite()) start();
}

function start() {
    if (running || !ctx) return;
    running = true;
    lastFrame = 0;
    requestAnimationFrame(animate);
}

function stop() {
    running = false;
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function animate(t) {
    if (!running) return;
    requestAnimationFrame(animate);
    if (t - lastFrame < FRAME_MS) return;
    // Шаг движения пропорционален прошедшему времени — скорость та же, что при 60 кадрах
    var step = lastFrame ? Math.min(3, (t - lastFrame) / 16.7) : 1;
    lastFrame = t;

    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx * step;
        p.y += p.vy * step;
        if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 180, 255, ' + p.opacity + ')';
        ctx.fill();
    }

    // Линии между близкими частицами — без квадратного корня, пока не нужно
    ctx.lineWidth = 0.5;
    var max2 = LINK_DIST * LINK_DIST;
    for (var a = 0; a < particles.length; a++) {
        var pa = particles[a];
        for (var b = a + 1; b < particles.length; b++) {
            var pb = particles[b];
            var dx = pa.x - pb.x, dy = pa.y - pb.y;
            var d2 = dx * dx + dy * dy;
            if (d2 >= max2) continue;
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.strokeStyle = 'rgba(0, 180, 255, ' + (0.07 * (1 - Math.sqrt(d2) / LINK_DIST)) + ')';
            ctx.stroke();
        }
    }
}
