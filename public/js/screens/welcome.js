import { sendMsg } from '../socket.js';
import { showNotification } from '../components/notification.js';
import { navigate } from '../app.js';
import { logoSvg } from '../components/logo.js';
import { playSound } from '../components/sound.js';

var startupInterval = null;

export function renderWelcome(container) {
    var html = '';
    // Бегущая строка «биржи стартапов» — наполняется продуктами с сервера
    html += '<div class="ticker" aria-hidden="true">';
    html += '<div class="ticker-label">📈 БИРЖА ВПАРИТЬ</div>';
    html += '<div class="ticker-window"><div id="ticker-track" class="ticker-track"></div></div>';
    html += '</div>';

    html += '<div class="welcome-page px-5 sm:px-8 py-10 lg:py-14">';
    // Мягкое свечение фона: жёлтое за заголовком, синее — от логотипа
    html += '<div class="welcome-glow welcome-glow-yellow"></div>';
    html += '<div class="welcome-glow welcome-glow-blue"></div>';

    html += '<div class="welcome-grid max-w-6xl mx-auto">';

    // ═══════ ЗАГОЛОВОК ═══════
    html += '<div class="welcome-top">';
    html += '<div class="flex flex-col items-center lg:items-start text-center lg:text-left">';
    // Появление и парение логотипа — на разных элементах: обе анимации задают animation
    html += '<div class="hero-reveal-1 mb-3">';
    html += '<div class="animate-float">';
    html += '<div id="hero-logo" class="hero-logo select-none" title="Впарь!">' + logoSvg({ size: 170, animated: true }) + '</div>';
    html += '</div>';
    html += '</div>';
    html += '<h1 class="hero-reveal-2 hero-title font-display font-black text-6xl md:text-8xl leading-none" style="letter-spacing:-0.03em">ВПАРИТЬ</h1>';
    // Бывшее название — пока все привыкают к новому
    html += '<div class="hero-reveal-2 welcome-ex mt-3">';
    html += '<span class="welcome-ex-tag">ex</span>';
    html += '<span>Инновационный ширпотреб</span>';
    html += '</div>';
    html += '<p class="hero-reveal-3 font-display font-black text-2xl md:text-3xl text-accent-brand mt-5">Сделай бред инвестицией</p>';
    html += '<p class="hero-reveal-3 text-base md:text-lg text-corp-dim leading-relaxed mt-3 max-w-xl">';
    html += 'Онлайн-игра, где нужно продать инвесторам абсурдный продукт. ';
    html += 'Тренирует импровизацию и убедительную подачу — и это очень смешно.';
    html += '</p>';
    html += '</div>';
    html += '</div>'; // end welcome-top

    // ═══════ ФОРМА ВХОДА ═══════
    html += '<div class="welcome-side">';
    html += '<div class="hero-reveal-4 corp-card-elevated welcome-card p-6 sm:p-7 space-y-5">';

    html += '<div>';
    html += '<label class="block text-[0.6rem] font-black text-corp-muted uppercase tracking-[0.16em] mb-2">Ваш позывной</label>';
    html += '<input type="text" id="w-nickname" class="input-corp" placeholder="Как вас называть?" maxlength="20" autocomplete="off">';
    html += '</div>';

    html += '<button id="btn-create" class="btn-neon-solid w-full py-4 rounded-2xl text-sm font-black tracking-wider uppercase cursor-pointer">';
    html += '📣 Создать комнату';
    html += '</button>';

    html += '<div class="flex items-center gap-3">';
    html += '<div class="flex-1 h-px" style="background:linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)"></div>';
    html += '<span class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-[0.15em]">или войти по коду</span>';
    html += '<div class="flex-1 h-px" style="background:linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)"></div>';
    html += '</div>';

    html += '<div class="flex gap-3">';
    html += '<input type="text" id="w-room-code" class="input-corp input-corp-code flex-1 min-w-0" placeholder="КОД" maxlength="5" autocomplete="off">';
    html += '<button id="btn-join" class="btn-neon px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer">';
    html += 'Войти →';
    html += '</button>';
    html += '</div>';

    html += '<div id="w-password-wrap" class="hidden">';
    html += '<input type="text" id="w-password" class="input-corp text-sm" placeholder="🔑 Пароль (для закрытой комнаты)" maxlength="30" autocomplete="off">';
    html += '<button id="btn-watch" class="watch-link">👀 Не играть, а смотреть игру</button>';
    html += '</div>';

    html += '<button id="btn-solo" class="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold cursor-pointer btn-ghost">';
    html += '  <span>🎲</span>';
    html += '  <span class="text-corp-dim">Потренироваться одному</span>';
    html += '  <span class="hidden sm:inline text-xs text-corp-muted font-normal">— без комнаты</span>';
    html += '</button>';

    html += '</div>'; // end card

    // Открытые комнаты
    html += '<div class="hero-reveal-5 mt-6">';
    html += '<div class="text-[0.6rem] font-black text-corp-muted uppercase tracking-[0.18em] mb-3 text-center lg:text-left">🌐 Открытые комнаты</div>';
    html += '<div id="rooms-list" class="space-y-2">';
    html += '<div class="text-center text-xs text-corp-dim py-3">Загрузка...</div>';
    html += '</div>';
    html += '</div>';

    // Fake door: замеряем спрос на платную «преподавательскую» версию.
    // Кнопка ведёт не в продукт, а в форму ожидания — клики и оставленные почты
    // и есть данные о готовности платить.
    html += '<div class="hero-reveal-6 mt-5">';
    html += '<button id="btn-teacher" class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[0.7rem] font-black uppercase tracking-wider cursor-pointer ';
    html += 'bg-accent-green-dim border border-accent-green/25 text-accent-green hover:bg-accent-green/15 hover:border-accent-green/45 transition-all">';
    html += '  <span>📊</span>';
    html += '  <span>Для преподавателей и тренеров</span>';
    html += '</button>';
    html += '<div id="teacher-panel" class="hidden corp-card p-5 mt-3 space-y-3 text-left">';
    html += '  <div class="text-sm font-black text-corp-white">Режим ведущего</div>';
    html += '  <p class="text-xs text-corp-dim leading-relaxed">Сценарий занятия на 60–90 минут, критерии разбора питчей и отчёт по группе: кто сколько инвестиций привлёк и как рос от игры к игре. Сейчас в разработке — оставьте почту, позовём первыми.</p>';
    html += '  <input type="email" id="teacher-email" class="input-corp text-sm" placeholder="Почта" maxlength="120" autocomplete="email">';
    html += '  <input type="text" id="teacher-role" class="input-corp text-sm" placeholder="Кто вы? (преподаватель, HR, тренер…)" maxlength="60" autocomplete="off">';
    html += '  <button id="btn-teacher-send" class="btn-neon w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer">Записаться</button>';
    html += '  <div id="teacher-result" class="hidden text-xs font-bold text-accent-green text-center"></div>';
    html += '</div>';
    html += '</div>';
    html += '</div>'; // end welcome-side

    // ═══════ ЖИВОЙ ПРИМЕР + КАК ИГРАТЬ ═══════
    html += '<div class="welcome-bottom">';

    html += '<div class="hero-reveal-5">';
    html += '<div class="flex items-center justify-between gap-3 mb-4">';
    html += '<div class="text-[0.65rem] font-black text-corp-muted uppercase tracking-[0.18em]">🃏 Что может выпасть</div>';
    html += '<button id="btn-demo-shuffle" class="demo-shuffle-btn" title="Другой продукт">🎲 Ещё</button>';
    html += '</div>';
    html += '<div id="demo-cards" class="demo-cards">';
    html += demoCardHtml('adjective', 'Прилагательное', 'ЛЕТАЮЩИЙ');
    html += demoCardHtml('item', 'Предмет', 'УТЮГ');
    html += demoCardHtml('feature', 'Особенность', 'КОТОРЫЙ ОТПУГИВАЕТ КОМАРОВ');
    html += '</div>';
    html += '<p class="text-sm text-corp-muted mt-3 text-center lg:text-left">Сложите карты в продукт — и убедите всех, что без него жить нельзя.</p>';
    html += '</div>';

    // Три шага
    html += '<div class="hero-reveal-6 welcome-steps mt-8">';
    html += welcomeStep('1', '🃏', 'Получите карты', 'Случайные слова — основа вашего «инновационного» продукта');
    html += welcomeStep('2', '🎤', 'Впарьте продукт', 'Питч перед остальными: кому нужно и почему это прорыв');
    html += welcomeStep('3', '💰', 'Соберите инвестиции', 'Игроки вкладывают жетоны. Угадал победителя — ×2');
    html += '</div>';

    // Коротко о формате
    html += '<div class="hero-reveal-6 flex flex-wrap justify-center lg:justify-start gap-2 mt-6">';
    html += welcomeFact('👥', '3–18 игроков');
    html += welcomeFact('💸', 'Бесплатно');
    html += welcomeFact('📱', 'С телефона');
    html += welcomeFact('⚙️', 'Свои настройки');
    html += welcomeFact('😂', 'Реакции зала');
    html += '</div>';

    // Два режима — каждый со своими правилами
    html += '<div class="hero-reveal-6 mt-10">';
    html += '<div class="text-[0.65rem] font-black text-corp-muted uppercase tracking-[0.18em] mb-4 text-center lg:text-left">🎮 Два режима</div>';
    html += '<div class="mode-cards">';
    html += '<div class="mode-card mode-card-classic">';
    html += '  <div class="mode-card-emoji">📣</div>';
    html += '  <div class="mode-card-title">Классика</div>';
    html += '  <div class="mode-card-desc">Получите карты, впарьте продукт и вложите жетоны в чужие стартапы. Кто соберёт больше всех инвестиций?</div>';
    html += '  <button id="btn-rules" class="mode-card-btn">📖 Правила <span id="rules-arrow" class="mode-card-arrow">▼</span></button>';
    html += '</div>';
    html += '<div class="mode-card mode-card-bunker">';
    html += '  <div class="mode-card-emoji">🏠</div>';
    html += '  <div class="mode-card-title">Бункер</div>';
    html += '  <div class="mode-card-desc">Конец света, мест мало. Раскрывайте карты стартапа по одной и голосуйте, кто человечество не спасёт.</div>';
    html += '  <button id="btn-bunker-rules" class="mode-card-btn">📖 Правила <span id="bunker-rules-arrow" class="mode-card-arrow">▼</span></button>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // end welcome-bottom
    html += '</div>'; // end welcome-grid

    // Панели правил — во всю ширину под сеткой
    html += '<div id="rules-panel" class="hidden w-full max-w-5xl mx-auto mt-10">';
    html += buildRulesContent();
    html += '</div>';
    html += '<div id="bunker-rules-panel" class="hidden w-full max-w-5xl mx-auto mt-10">';
    html += buildBunkerRulesContent();
    html += '</div>';

    // Footer
    html += '<div class="flex flex-wrap items-center justify-center gap-5 mt-12">';
    html += '<a href="https://t.me/innovative_shirpotreb" target="_blank" class="flex items-center gap-1.5 text-[0.65rem] font-semibold text-corp-muted hover:text-accent-blue transition-colors uppercase tracking-wider">⚡ Telegram</a>';
    html += '<div class="w-px h-3 bg-corp-border"></div>';
    html += '<a href="https://www.donationalerts.com/r/tortyaka" target="_blank" class="flex items-center gap-1.5 text-[0.65rem] font-semibold text-corp-muted hover:text-accent-gold transition-colors uppercase tracking-wider">🍕 Поддержать</a>';
    html += '<div class="w-px h-3 bg-corp-border"></div>';
    html += '<a href="mailto:lokomas@inbox.ru" class="flex items-center gap-1.5 text-[0.65rem] font-semibold text-corp-muted hover:text-corp-light transition-colors uppercase tracking-wider">✉ Фидбек</a>';
    html += '</div>';

    html += '<div id="conn-status" class="flex items-center justify-center gap-2 mt-4">';
    html += '<div class="conn-dot bg-accent-gold"></div>';
    html += '<span class="conn-text text-xs font-semibold text-accent-gold">Подключение...</span>';
    html += '</div>';

    html += '</div>'; // end welcome-page

    container.innerHTML = html;

    // ═══════ LISTENERS ═══════
    // Пасхалка: по клику мегафон «кричит» ещё раз
    var heroLogo = container.querySelector('#hero-logo');
    if (heroLogo) heroLogo.addEventListener('click', function () {
        var svg = heroLogo.querySelector('svg');
        if (!svg) return;
        svg.classList.remove('vp-logo-shout');
        void svg.getBoundingClientRect(); // перезапуск анимации
        svg.classList.add('vp-logo-shout');
        playSound('invest');
    });

    var btnCreate = container.querySelector('#btn-create');
    var btnJoin = container.querySelector('#btn-join');
    var btnSolo = container.querySelector('#btn-solo');
    if (btnSolo) {
        btnSolo.addEventListener('click', function () {
            trackClick('solo_opened');
            navigate('soloSettings');
        });
    }

    setupTeacherFakeDoor(container);
    var nicknameInput = container.querySelector('#w-nickname');
    var codeInput = container.querySelector('#w-room-code');
    var btnRules = container.querySelector('#btn-rules');
    var btnBunkerRules = container.querySelector('#btn-bunker-rules');

    if (btnCreate) {
        btnCreate.addEventListener('click', function () {
            doCreateRoom(container);
        });
    }

    if (btnJoin) {
        btnJoin.addEventListener('click', function () {
            doJoinRoom(container, container.dataset.watch === '1');
        });
    }
    var btnWatch = container.querySelector('#btn-watch');
    if (btnWatch) btnWatch.addEventListener('click', function () { doJoinRoom(container, true); });

    if (nicknameInput) {
        nicknameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                if (codeInput && codeInput.value.trim()) doJoinRoom(container, container.dataset.watch === '1');
                else doCreateRoom(container);
            }
        });
    }

    if (codeInput) {
        codeInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') doJoinRoom(container, container.dataset.watch === '1');
        });
        codeInput.addEventListener('input', function () {
            var wrap = container.querySelector('#w-password-wrap');
            if (wrap) {
                if (codeInput.value.trim().length >= 3) wrap.classList.remove('hidden');
                else wrap.classList.add('hidden');
            }
        });
    }

    // Rules toggle (закрываем правила бункера, если открывали их)
    if (btnRules) {
        btnRules.addEventListener('click', function () {
            var panel = container.querySelector('#rules-panel');
            var arrow = container.querySelector('#rules-arrow');
            var otherPanel = container.querySelector('#bunker-rules-panel');
            var otherArrow = container.querySelector('#bunker-rules-arrow');
            if (otherPanel && !otherPanel.classList.contains('hidden')) {
                otherPanel.classList.add('hidden');
                if (otherArrow) otherArrow.style.transform = '';
            }
            if (panel) {
                panel.classList.toggle('hidden');
                if (arrow) {
                    arrow.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(180deg)';
                }
                if (!panel.classList.contains('hidden')) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    }

    // Bunker rules toggle (закрываем основные правила, если открывали их)
    if (btnBunkerRules) {
        btnBunkerRules.addEventListener('click', function () {
            var panel = container.querySelector('#bunker-rules-panel');
            var arrow = container.querySelector('#bunker-rules-arrow');
            var otherPanel = container.querySelector('#rules-panel');
            var otherArrow = container.querySelector('#rules-arrow');
            if (otherPanel && !otherPanel.classList.contains('hidden')) {
                otherPanel.classList.add('hidden');
                if (otherArrow) otherArrow.style.transform = '';
            }
            if (panel) {
                panel.classList.toggle('hidden');
                if (arrow) {
                    arrow.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(180deg)';
                }
                if (!panel.classList.contains('hidden')) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    }

    applyInviteLink(container);

    var btnShuffle = container.querySelector('#btn-demo-shuffle');
    if (btnShuffle) btnShuffle.addEventListener('click', function () {
        showNextDemo(container);
        restartDemoTimer(container);
    });

    startRotating(container);
}

// ═══════════════════════════════════════════
// ЖИВЫЕ КАРТЫ — случайный продукт с сервера, карты переворачиваются
// ═══════════════════════════════════════════

var DEMO_INTERVAL_MS = 5500;

function demoCardHtml(kind, label, word) {
    return '<div class="demo-card demo-card-' + kind + '" data-demo="' + kind + '">'
        + '<div class="demo-card-inner">'
        + '<div class="demo-card-label">' + label + '</div>'
        + '<div class="demo-card-word">' + escapeText(word) + '</div>'
        + '</div>'
        + '</div>';
}

function welcomeStep(num, emoji, title, desc) {
    return '<div class="welcome-step">'
        + '<div class="welcome-step-num">' + num + '</div>'
        + '<div class="welcome-step-emoji">' + emoji + '</div>'
        + '<div class="welcome-step-title">' + title + '</div>'
        + '<div class="welcome-step-desc">' + desc + '</div>'
        + '</div>';
}

function welcomeFact(emoji, text) {
    return '<span class="welcome-fact"><span>' + emoji + '</span>' + text + '</span>';
}

function escapeText(t) {
    return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fetchRandomCombo(callback) {
    fetch('/api/random-combo')
        .then(function (res) { return res.json(); })
        .then(function (data) { if (data && data.item) callback(data); })
        .catch(function () { /* сервер недоступен — остаются прежние карты */ });
}

// Карты по очереди переворачиваются и показывают новый продукт
function showNextDemo(container) {
    fetchRandomCombo(function (combo) {
        ['adjective', 'item', 'feature'].forEach(function (kind, i) {
            setTimeout(function () {
                var card = container.querySelector('[data-demo="' + kind + '"]');
                if (!card) return;
                card.classList.remove('demo-card-flip');
                void card.offsetWidth; // перезапуск анимации
                card.classList.add('demo-card-flip');
                // Слово меняется в середине переворота, когда карта стоит ребром
                setTimeout(function () {
                    var w = card.querySelector('.demo-card-word');
                    if (w) w.textContent = combo[kind];
                }, 260);
            }, i * 140);
        });
    });
}

function restartDemoTimer(container) {
    if (startupInterval) clearInterval(startupInterval);
    startupInterval = setInterval(function () {
        if (!container.querySelector('#demo-cards')) {
            clearInterval(startupInterval);
            startupInterval = null;
            return;
        }
        showNextDemo(container);
    }, DEMO_INTERVAL_MS);
}

function startRotating(container) {
    // Первый продукт — сразу, а не через интервал
    setTimeout(function () { showNextDemo(container); }, 700);
    restartDemoTimer(container);
    startTicker(container);
    setupDemoTilt(container);
}

// ═══════ БИРЖА СТАРТАПОВ — бегущая строка сверху ═══════
function startTicker(container) {
    var track = container.querySelector('#ticker-track');
    if (!track) return;
    fetch('/api/random-combos?n=10')
        .then(function (r) { return r.json(); })
        .then(function (list) {
            if (!Array.isArray(list) || !list.length) throw new Error('empty');
            var items = list.map(function (c) {
                // Котировки выдуманные: почти всё растёт, но иногда рынок не верит в утюги
                var up = Math.random() > 0.22;
                var pct = up ? Math.floor(40 + Math.random() * 900) : Math.floor(5 + Math.random() * 60);
                return '<span class="ticker-item"><span class="ticker-name">' + escapeText(c.adjective + ' ' + c.item) + '</span>'
                    + '<span class="' + (up ? 'ticker-up' : 'ticker-down') + '">' + (up ? '▲ +' : '▼ −') + pct + '%</span></span>';
            }).join('<span class="ticker-dot">•</span>');
            // Дважды подряд — чтобы лента крутилась без шва
            track.innerHTML = '<span class="ticker-run">' + items + '<span class="ticker-dot">•</span></span>'
                + '<span class="ticker-run">' + items + '<span class="ticker-dot">•</span></span>';
            var run = track.querySelector('.ticker-run');
            var speed = 70; // пикселей в секунду
            track.style.animationDuration = Math.max(20, run.offsetWidth / speed) + 's';
            track.classList.add('ticker-go');
        })
        .catch(function () {
            var t = container.querySelector('.ticker');
            if (t) t.classList.add('hidden');
        });
}

// ═══════ Карты слегка наклоняются за курсором ═══════
var DEMO_BASE_TILT = { adjective: -2, item: 0, feature: 2 };

function setupDemoTilt(container) {
    if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { }
    container.querySelectorAll('.demo-card').forEach(function (card) {
        var base = DEMO_BASE_TILT[card.getAttribute('data-demo')] || 0;
        card.addEventListener('mousemove', function (e) {
            var r = card.getBoundingClientRect();
            var px = (e.clientX - r.left) / r.width - 0.5;
            var py = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = 'rotate(' + base + 'deg) perspective(700px) rotateY(' + (px * 16).toFixed(1) + 'deg) rotateX(' + (-py * 14).toFixed(1) + 'deg) scale(1.04)';
            card.style.setProperty('--shine-x', ((px + 0.5) * 100).toFixed(0) + '%');
            card.style.setProperty('--shine-y', ((py + 0.5) * 100).toFixed(0) + '%');
            card.classList.add('demo-card-hover');
        });
        card.addEventListener('mouseleave', function () {
            card.style.transform = '';
            card.classList.remove('demo-card-hover');
        });
    });
}

// ═══════════════════════════════════════════
// ПРАВИЛА — классика и «Бункер»
// ═══════════════════════════════════════════

function rulesSection(label, inner) {
    return '<div class="rules-section"><div class="rules-section-label">' + label + '</div>' + inner + '</div>';
}

// Схема этапов: карточки со стрелками между ними
function rulesFlow(steps) {
    var html = '<div class="rules-flow">';
    steps.forEach(function (st, i) {
        html += '<div class="rules-flow-step">';
        html += '<div class="rules-flow-head"><span class="rules-flow-num">' + (i + 1) + '</span><span class="rules-flow-emoji">' + st[0] + '</span></div>';
        html += '<div class="rules-flow-title">' + st[1] + '</div>';
        html += '<div class="rules-flow-desc">' + st[2] + '</div>';
        html += '</div>';
    });
    html += '</div>';
    return html;
}

function rulesTiles(tiles, cols) {
    var html = '<div class="rules-tiles rules-tiles-' + (cols || 2) + '">';
    tiles.forEach(function (t) {
        html += '<div class="rules-tile rules-tone-' + (t[3] || 'gold') + '">';
        html += '<div class="rules-tile-emoji">' + t[0] + '</div>';
        html += '<div class="rules-tile-title">' + t[1] + '</div>';
        html += '<div class="rules-tile-desc">' + t[2] + '</div>';
        html += '</div>';
    });
    html += '</div>';
    return html;
}

function buildRulesContent() {
    var html = '<div class="rules-card">';

    html += '<div class="rules-kicker">📖 ПРАВИЛА · КЛАССИКА</div>';
    html += '<h3 class="rules-title">Продайте то, что продать невозможно</h3>';
    html += '<p class="rules-lead">Каждый получает случайные карты, складывает из них «инновационный продукт» и убеждает остальных вложиться. Например:</p>';
    html += '<div class="rules-example">«Жидкий утюг, который следит за вашим здоровьем»<span> — прорыв тысячелетия, не иначе</span></div>';

    html += rulesSection('📋 Как проходит раунд', rulesFlow([
        ['🃏', 'Подготовка', 'Каждый получает карты и придумывает, как сложить их в один продукт'],
        ['🎤', 'Питчи', 'По очереди выступаете: что это, кому нужно и почему это прорыв'],
        ['💰', 'Инвестиции', 'Тайно распределяете жетоны между чужими проектами. В себя — нельзя'],
        ['🏆', 'Итоги', 'Больше всех собрал — лучший предприниматель. Вложился в него — получаешь ×2'],
    ]));

    html += rulesSection('🎭 Две роли одновременно', rulesTiles([
        ['🎤', 'Предприниматель', 'Презентуйте абсурдный продукт с серьёзным лицом. Чем убедительнее — тем больше инвестиций.', 'gold'],
        ['💼', 'Инвестор', 'Найдите будущий хит среди чужих проектов. Угадали победителя — ставка удваивается.', 'blue'],
    ], 2));

    html += rulesSection('🏅 Три способа победить', rulesTiles([
        ['💼', 'Лучший инвестор', 'Больше всех личного капитала к финалу', 'green'],
        ['🎤', 'Лучший предприниматель', 'Больше всех привлёк инвестиций за игру', 'gold'],
        ['🎭', 'Любимец зала', 'Больше всех реакций от зала во время своих выступлений', 'pink'],
    ], 3));

    var rules = [
        ['no', 'Нельзя игнорировать карты', 'Выпало «Бетонный»? Объясните, почему продукт из бетона. «Ну просто так» — без инвестиций.'],
        ['no', 'Нельзя вкладывать в себя', 'Только в чужие проекты — рискуйте чужими идеями.'],
        ['yes', 'Банкрот не выбывает', 'Потеряли всё? Банк выдаст 1 жетон — вы всё ещё в игре.'],
        ['yes', 'Ничья — это шоу', 'Дополнительные питчи лидеров и переголосование.'],
    ];
    var rh = '<div class="rules-golden">';
    rules.forEach(function (r) {
        rh += '<div class="rules-golden-row">';
        rh += '<span class="rules-golden-mark rules-golden-' + r[0] + '">' + (r[0] === 'no' ? '✕' : '✓') + '</span>';
        rh += '<div><div class="rules-golden-title">' + r[1] + '</div><div class="rules-golden-desc">' + r[2] + '</div></div>';
        rh += '</div>';
    });
    rh += '</div>';
    html += rulesSection('⚡ Золотые правила', rh);

    // Всё, что можно включить, — тремя группами, чтобы было ясно, что есть что
    html += rulesSection('🃏 Колоды карт <span class="rules-where">лобби → «Карты»</span>',
        '<p class="rules-group-lead">Что добавляется в руку каждого игрока — продукт становится сложнее и смешнее.</p>' + rulesTiles([
        ['💬', 'Первый отзыв', '«Пока ждал — успел состариться!» Объясните, почему это хорошо', 'gold'],
        ['🎯', 'Аудитория', 'Для кого продукт: «для трудоголиков», «для инопланетян»', 'pink'],
        ['⚠️', 'Скрытый дефект', 'Недостаток, о котором знают все. Превратите его в преимущество', 'orange'],
        ['📦', 'Упаковка', '«Замотано в 5 слоёв изоленты» — и это тоже ценность', 'teal'],
        ['📜', 'Слово к предмету', '«Утюг ЛЮБВИ» или «Утюг ВНЕЗАПНОГО УСПЕХА»', 'green'],
        ['🌱', 'Без особенности', 'Лайт-режим «Псевдоинновации»: только прилагательное и предмет', 'green'],
    ], 3) + '<div class="rules-inline-note">🧟 <b>Генератор абсурда</b> — вместо нашей базы слова придумывают сами игроки, и всё перемешивается.</div>');

    html += rulesSection('🎲 Сюрпризы раунда <span class="rules-where">лобби → «Карты»</span>',
        '<p class="rules-group-lead">Случайности, которые ломают заготовки и заставляют импровизировать.</p>' + rulesTiles([
        ['🎲', 'События', 'Новое условие для всех каждый раунд: «продаём только государству»', 'blue'],
        ['🦢', 'Чёрный лебедь', '20% шанс, что одну карту заменят прямо перед питчем', 'purple'],
    ], 2));

    html += rulesSection('⚙️ Настройки комнаты <span class="rules-where">лобби → «Партия»</span>',
        '<p class="rules-group-lead">Как устроена сама партия: кто ведёт, сколько длится, как выступают.</p>' + rulesTiles([
        ['🙋', 'Вопросы после питча', 'Слушатели поднимают руку и задают каверзные вопросы', 'gold'],
        ['🎙', 'Ведущий без карт', 'Преподаватель ведёт партию, а играют участники', 'gold'],
        ['⏱', 'Раунды и тайминги', 'Сколько раундов, капитал и время на каждый этап', 'blue'],
        ['🎬', 'Стримерский режим', 'Питч текстом — для стрима и игры без микрофона', 'blue'],
        ['🔊', 'Озвучка', 'Браузер зачитывает карты и питчи вслух', 'blue'],
        ['🔒', 'Закрытая комната', 'Вход только по коду, при желании — ещё и по паролю', 'teal'],
    ], 3));

    html += '<div class="rules-note">😂 <b>Реакции зала</b> работают всегда, настраивать не нужно: жмите эмодзи или клавиши 1–8 прямо во время питча. По умолчанию партия — классика без усложнений.</div>';
    html += '</div>';
    return html;
}

function buildBunkerRulesContent() {
    var html = '<div class="rules-card rules-card-bunker">';

    html += '<div class="rules-kicker">☢️ ПРАВИЛА · БУНКЕР</div>';
    html += '<h3 class="rules-title">Конец света — не повод закрывать раунд</h3>';
    html += '<p class="rules-lead">На табло — глобальная катастрофа. Бункер один, и мест в нём меньше, чем желающих выжить. У каждого — стартап, который якобы спасёт человечество. Проблема в том, что у продукта есть скрытый дефект, а у вас — причина не показывать его раньше времени.</p>';
    html += '<div class="rules-example">«У меня приложение для медитации… и да, работает без интернета. Что значит, ПОЧЕМУ это важно?!»</div>';

    html += rulesSection('📋 Как проходит партия', rulesFlow([
        ['🧪', 'Сборка продукта', 'Перед игрой выбираете каждую из 9 карт — одну из трёх. Сначала предмет, остальное согласуется с ним'],
        ['🎴', 'Досье', '9 закрытых карт: от прилагательного до скрытого дефекта и исторического факта'],
        ['🔓', 'Раскрытие', 'В свой ход открываете ровно одну карту — и решаете, с чего начать'],
        ['🗳', 'Голосование', 'Дебаты и тайный голос за вылет. Можно воздержаться, при ничьей — переголосование'],
        ['🏁', 'Бункер закрыт', 'Раунды идут, пока не останется столько выживших, сколько мест'],
    ]));

    html += rulesSection('🔥 Почему тут жарко', rulesTiles([
        ['🧪', 'Продукт под катастрофу', 'Катастрофа известна ещё на сборке — выбирайте карты, которые её победят', 'gold'],
        ['🗳', 'Никто никому не верит', 'Каждый раунд — голосование за вылет. Союзы рушатся за секунды', 'gold'],
        ['💣', 'Карты действий', 'Заставить раскрыться, спасти от кика, ударить по конкретному игроку', 'blue'],
        ['💀', 'Вылет — навсегда', 'Выкинули — все ваши карты раскрываются, дальше вы только смотрите', 'red'],
        ['🤖', 'Финал решает ИИ', 'Все карты уходят в промпт для ИИ: спас ли ваш стартап человечество на самом деле', 'purple'],
        ['🎙', 'Режим ведущего', 'Без таймеров: ведущий сам переключает ходы и запускает голосование', 'gold'],
    ], 3));

    html += '<div class="rules-note">💡 Раскрытый дефект — ещё не вылет. Иногда лучше признаться в слабости самому, чем ждать, пока это сделают за вас.</div>';
    html += '</div>';
    return html;
}

// ═══════ ACTIONS ═══════

// ═══════════════════════════════════════════
// FAKE DOOR — замер спроса на платную версию
// ═══════════════════════════════════════════

export function trackClick(name) {
    try {
        fetch('/api/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name }),
        }).catch(function () { });
    } catch (e) { /* аналитика никогда не должна ломать игру */ }
}

function setupTeacherFakeDoor(container) {
    var btn = container.querySelector('#btn-teacher');
    var panel = container.querySelector('#teacher-panel');
    var send = container.querySelector('#btn-teacher-send');
    var result = container.querySelector('#teacher-result');
    if (!btn || !panel || !send) return;

    var counted = false;
    btn.addEventListener('click', function () {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden') && !counted) {
            counted = true;
            trackClick('fakedoor_click');
        }
    });

    send.addEventListener('click', function () {
        var email = (container.querySelector('#teacher-email') || {}).value || '';
        var role = (container.querySelector('#teacher-role') || {}).value || '';
        email = email.trim();
        if (email.indexOf('@') === -1) {
            showNotification('Введите почту', 'error');
            return;
        }
        send.disabled = true;
        send.textContent = 'Отправляем...';
        fetch('/api/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, role: role.trim(), source: 'welcome' }),
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.ok) {
                    panel.querySelectorAll('input, #btn-teacher-send').forEach(function (el) { el.classList.add('hidden'); });
                    result.classList.remove('hidden');
                    result.textContent = '✓ Записали. Напишем, когда будет готово.';
                } else {
                    throw new Error('bad response');
                }
            })
            .catch(function () {
                send.disabled = false;
                send.textContent = 'Записаться';
                showNotification('Не получилось отправить. Попробуйте позже.', 'error');
            });
    });
}

function setButtonPending(btn, pendingText) {
    if (!btn || btn.disabled) return;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-70', 'cursor-wait');
    btn.textContent = pendingText;
}

// Возвращает кнопки Create/Join в исходное состояние — вызывается при ошибке от сервера
// (например, неверный код комнаты), чтобы кнопка не осталась залипшей в состоянии загрузки.
export function resetWelcomeButtons() {
    var btns = document.querySelectorAll('#btn-create, #btn-join, #btn-watch');
    for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
        btn.disabled = false;
        btn.classList.remove('opacity-70', 'cursor-wait');
    }
}

function doCreateRoom(container) {
    var input = container.querySelector('#w-nickname');
    if (!input) return;
    var nickname = input.value.trim();
    if (!nickname) {
        showNotification('Введите позывной!', 'error');
        input.focus();
        return;
    }
    setButtonPending(container.querySelector('#btn-create'), '📣 Создаём...');
    sendMsg({ type: 'createRoom', nickname: nickname, settings: {} });
}

function doJoinRoom(container, watch) {
    var nicknameInput = container.querySelector('#w-nickname');
    var codeInput = container.querySelector('#w-room-code');
    var passwordInput = container.querySelector('#w-password');
    if (!nicknameInput || !codeInput) return;

    var nickname = nicknameInput.value.trim();
    var code = codeInput.value.trim().toUpperCase();
    var password = passwordInput ? passwordInput.value.trim() : '';

    if (!nickname) {
        showNotification('Введите позывной!', 'error');
        nicknameInput.focus();
        return;
    }
    if (!code || code.length < 3) {
        showNotification('Введите код комнаты!', 'error');
        codeInput.focus();
        return;
    }
    setButtonPending(container.querySelector(watch ? '#btn-watch' : '#btn-join'), watch ? '👀 Входим в зал...' : 'Входим...');
    // Приглашение использовано — после выхода из комнаты главная снова чистая
    try { if (location.search) history.replaceState(null, '', location.pathname); } catch (e) { }
    sendMsg({ type: 'joinRoom', nickname: nickname, roomCode: code, password: password, watch: !!watch });
}

// Ссылка-приглашение вида /?room=КОД: код уже вписан, остаётся назвать себя и войти
function applyInviteLink(container) {
    var code = '';
    try { code = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); } catch (e) { }
    if (code.length < 3) return;
    var codeInput = container.querySelector('#w-room-code');
    var nickInput = container.querySelector('#w-nickname');
    var card = container.querySelector('.welcome-card');
    if (!codeInput || !card) return;
    codeInput.value = code;
    var wrap = container.querySelector('#w-password-wrap');
    if (wrap) wrap.classList.remove('hidden');
    // QR «Смотреть»: /?room=КОД&watch=1 — главная кнопка сразу ведёт в зрительный зал
    var watch = false;
    try { watch = new URLSearchParams(location.search).get('watch') === '1'; } catch (e) { }
    var banner = document.createElement('div');
    banner.className = 'invite-banner';
    if (watch) {
        container.dataset.watch = '1';
        var bj = container.querySelector('#btn-join');
        if (bj) bj.innerHTML = '👀 Смотреть';
        var bw = container.querySelector('#btn-watch');
        if (bw) bw.classList.add('hidden');
        banner.innerHTML = '<span class="text-xl">👀</span><span>Вас зовут смотреть игру в комнате <b>' + code + '</b> — назовите себя и нажмите «Смотреть»</span>';
    } else {
        banner.innerHTML = '<span class="text-xl">📨</span><span>Вас пригласили в комнату <b>' + code + '</b> — введите позывной и нажмите «Войти»</span>';
    }
    card.insertBefore(banner, card.firstChild);
    if (nickInput) setTimeout(function () { nickInput.focus(); }, 300);
}

export function showPasswordField(container) {
    var wrap = (container || document).querySelector('#w-password-wrap');
    if (wrap) {
        wrap.classList.remove('hidden');
        var pw = wrap.querySelector('#w-password');
        if (pw) { pw.focus(); }
    }
}