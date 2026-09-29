// ═══════════════════════════════════════════════════════════════════
// ГРАФИКА ПОД УСТРОЙСТВО
// Режимы: 'auto' (по умолчанию), 'lite' — облегчённая, 'full' — полная.
// В облегчённой: нет фоновых частиц и размытия фона, бесконечные анимации играют один раз,
// музыка без тяжёлого эффекта зала. Всё остальное в игре — то же самое.
// Авто: сразу смотрим на признаки слабого устройства, а потом следим за плавностью —
// если кадры несколько секунд подряд не успевают, сами включаем облегчённую графику.
// Выбор игрока хранится на устройстве (кнопка ♪ → «Графика»).
// ═══════════════════════════════════════════════════════════════════

var MODE_KEY = 'vparit-perf';
var mode = 'auto';
var autoLite = false;       // авто-режим решил, что устройству тяжело
var listeners = [];

try { var saved = localStorage.getItem(MODE_KEY); if (saved === 'lite' || saved === 'full') mode = saved; } catch (e) { }

export function getPerfMode() { return mode; }
export function isLite() { return mode === 'lite' || (mode === 'auto' && autoLite); }

// Подписка на смену режима: fn(isLite)
export function onPerfChange(fn) { listeners.push(fn); }

function apply() {
    var lite = isLite();
    document.documentElement.classList.toggle('perf-lite', lite);
    listeners.forEach(function (fn) { try { fn(lite); } catch (e) { } });
}

export function setPerfMode(next) {
    mode = next === 'lite' || next === 'full' ? next : 'auto';
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) { }
    apply();
    if (mode === 'auto' && !autoLite) watchFrames();
}

// Признаки слабого устройства или просьбы экономить — без замеров
function looksWeak() {
    var nav = navigator;
    var conn = nav.connection || {};
    if (conn.saveData) return true;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true; } catch (e) { }
    if (nav.deviceMemory && nav.deviceMemory <= 2) return true;
    if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) return true;
    if (nav.deviceMemory && nav.deviceMemory <= 4 && nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) return true;
    return false;
}

// Слежение за плавностью: окна по 4 с; два медленных окна подряд — облегчаем графику.
// Кадры считаем, только пока вкладка видна: в фоне браузер сам их тормозит.
var watching = false;
var notify = null;
export function onAutoLite(fn) { notify = fn; }

function watchFrames() {
    if (watching || mode !== 'auto' || autoLite) return;
    watching = true;
    var frames = 0, slow = 0, windowStart = 0, last = 0, badWindows = 0;
    function tick(t) {
        if (mode !== 'auto' || autoLite) { watching = false; return; }
        if (document.hidden) { windowStart = 0; last = 0; requestAnimationFrame(tick); return; }
        if (!windowStart) { windowStart = t; last = t; frames = 0; slow = 0; }
        var dt = t - last;
        last = t;
        // Длинная пауза — окно перекрыли или браузер притормозил фон: это не слабость устройства, замер заново
        if (dt > 250) { windowStart = t; frames = 0; slow = 0; requestAnimationFrame(tick); return; }
        frames++;
        if (dt > 34) slow++; // кадр дольше двух «шестидесятых» — заметный рывок
        if (t - windowStart >= 4000) {
            var fps = frames * 1000 / (t - windowStart);
            badWindows = (fps < 40 || slow > frames * 0.25) ? badWindows + 1 : 0;
            windowStart = t; frames = 0; slow = 0;
            if (badWindows >= 2) {
                autoLite = true;
                watching = false;
                apply();
                if (notify) notify();
                return;
            }
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

export function initPerf() {
    if (mode === 'auto' && looksWeak()) autoLite = true;
    apply();
    // Первые секунды после загрузки тяжёлые у всех — не принимаем их за слабое устройство
    setTimeout(watchFrames, 3000);
}
