// Короткая полноэкранная заставка между этапами игры: «Поехали!», «Раунд 2»...
// Не перехватывает клики и сама исчезает — под ней уже рисуется следующий экран.
import { logoSvg } from './logo.js';

var current = null;

/**
 * @param {object} opts
 *   title    — крупная надпись (можно с <span class="stage-accent">)
 *   subtitle — строка под ней
 *   logo     — показать логотип над надписью
 *   emoji    — или крупный значок вместо логотипа
 *   tone     — 'danger' для тревожных моментов (красный фон)
 *   duration — сколько держать, мс (по умолчанию 1700)
 */
export function showStageOverlay(opts) {
    opts = opts || {};
    hideNow();

    var el = document.createElement('div');
    el.className = 'stage-overlay' + (opts.tone === 'danger' ? ' stage-danger' : '');
    var html = '';
    if (opts.logo) html += '<div class="stage-logo">' + logoSvg({ size: 180, animated: true }) + '</div>';
    else if (opts.emoji) html += '<div class="stage-emoji">' + opts.emoji + '</div>';
    html += '<div class="stage-title">' + (opts.title || '') + '</div>';
    if (opts.subtitle) html += '<div class="stage-sub">' + opts.subtitle + '</div>';
    el.innerHTML = html;
    document.body.appendChild(el);

    var hideTimer = setTimeout(function () {
        el.classList.add('stage-out');
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
            if (current && current.el === el) current = null;
        }, 360);
    }, opts.duration || 1700);

    current = { el: el, timer: hideTimer };
}

function hideNow() {
    if (!current) return;
    clearTimeout(current.timer);
    if (current.el.parentNode) current.el.parentNode.removeChild(current.el);
    current = null;
}
