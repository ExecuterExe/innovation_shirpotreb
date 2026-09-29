// ═══════════════════════════════════════════
// ПОДТВЕРЖДЕНИЕ В СТИЛЕ ИГРЫ — вместо системного confirm().
// Системное окно в части встроенных браузеров (Telegram, приложения, панели превью)
// молча возвращает «нет», и кнопки вроде «Выйти» или «Дальше» просто не работали.
//   if (!(await askConfirm('Выйти из игры?'))) return;
// Опасные действия (выйти, исключить, удалить) — красная кнопка.
// ═══════════════════════════════════════════
import { escapeHtml } from '../app.js';

var DANGER = /выйти|исключ|удал|необратим/i;

export function askConfirm(text, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
        var prev = document.getElementById('game-confirm');
        if (prev) prev.remove();
        var danger = opts.danger !== undefined ? opts.danger : DANGER.test(text);
        var box = document.createElement('div');
        box.id = 'game-confirm';
        box.className = 'gc-back';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.innerHTML = '<div class="gc-card">'
            + '<div class="gc-text">' + escapeHtml(text) + '</div>'
            + '<div class="gc-actions">'
            + '<button type="button" class="gc-btn gc-cancel">' + escapeHtml(opts.cancel || 'Отмена') + '</button>'
            + '<button type="button" class="gc-btn gc-ok' + (danger ? ' gc-danger' : '') + '">' + escapeHtml(opts.ok || 'Да') + '</button>'
            + '</div></div>';
        var lastFocus = document.activeElement;
        function done(answer) {
            document.removeEventListener('keydown', onKey, true);
            box.remove();
            if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
            resolve(answer);
        }
        function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
            else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); }
        }
        box.addEventListener('click', function (e) { if (e.target === box) done(false); });
        box.querySelector('.gc-cancel').addEventListener('click', function () { done(false); });
        box.querySelector('.gc-ok').addEventListener('click', function () { done(true); });
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(box);
        box.querySelector('.gc-ok').focus();
    });
}
