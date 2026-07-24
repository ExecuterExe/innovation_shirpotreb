import { sendMsg } from '../socket.js';
import { showNotification } from '../components/notification.js';
import { navigate } from '../app.js';

var startupInterval = null;

export function renderWelcome(container) {
    var html = '';
    html += '<div class="flex flex-col items-center justify-center min-h-screen px-6 py-12">';

    // Logo
    html += '<div class="mb-5 animate-float">';
    html += '<div class="text-7xl md:text-8xl select-none" style="filter: drop-shadow(0 0 40px rgba(0,180,255,0.35)) drop-shadow(0 0 80px rgba(0,180,255,0.12));">🚀</div>';
    html += '</div>';

    // Title — градиент синий→голубой
    html += '<h1 class="font-display font-black text-3xl md:text-5xl text-center tracking-tight leading-none mb-1" style="text-wrap:balance">';
    html += '<span class="text-gradient-blue">ИННОВАЦИОННЫЙ</span>';
    html += '<br>';
    html += '<span class="text-corp-white" style="letter-spacing:-0.01em">ШИРПОТРЕБ</span>';
    html += '</h1>';

    // Подзаголовок
    html += '<p class="text-xs font-bold text-corp-muted uppercase tracking-[0.18em] mb-6">Питчинг · Инвестиции · Хаос</p>';

    // Rotating startup — в рамке как цитата
    html += '<div class="h-10 flex items-center justify-center mb-8 overflow-hidden w-full max-w-sm">';
    html += '<p id="rotating-startup" class="text-corp-dim text-xs md:text-sm font-mono text-center italic px-4 py-2 rounded-xl bg-white/[0.025] border border-white/[0.06]">';
    html += 'Загрузка гениальных идей...';
    html += '</p>';
    html += '</div>';

    // ═══════ RULES BUTTON ═══════
    html += '<div class="w-full max-w-md mb-6">';
    html += '<button id="btn-rules" class="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider cursor-pointer ';
    html += 'bg-accent-gold-dim border border-accent-gold/25 text-accent-gold hover:bg-accent-gold/15 hover:border-accent-gold/45 transition-all">';
    html += '  <span>📖</span>';
    html += '  <span>Обязательно прочитайте правила!</span>';
    html += '  <span id="rules-arrow" class="text-xs text-accent-gold/60 transition-transform">▼</span>';
    html += '</button>';
    html += '</div>';

    // ═══════ RULES PANEL ═══════
    html += '<div id="rules-panel" class="hidden w-full max-w-2xl mb-8">';
    html += buildRulesContent();
    html += '</div>';

    // Main card
    html += '<div class="corp-card-elevated w-full max-w-md p-7 space-y-5">';

    // Nickname
    html += '<div>';
    html += '<label class="block text-[0.6rem] font-black text-corp-muted uppercase tracking-[0.16em] mb-2">Ваш позывной</label>';
    html += '<input type="text" id="w-nickname" class="input-corp" placeholder="Как вас называть?" maxlength="20" autocomplete="off">';
    html += '</div>';

    // Create
    html += '<button id="btn-create" class="btn-neon-solid w-full py-4 rounded-2xl text-sm font-black tracking-wider uppercase cursor-pointer">';
    html += '🚀 Создать комнату';
    html += '</button>';

    // Solo
    html += '<button id="btn-solo" class="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold cursor-pointer btn-ghost rounded-2xl">';
    html += '  <span>🎲</span>';
    html += '  <span class="text-corp-dim">Одиночный режим</span>';
    html += '  <span class="text-xs text-corp-muted font-normal">— без регистрации</span>';
    html += '</button>';

    // Divider
    html += '<div class="flex items-center gap-3">';
    html += '<div class="flex-1 h-px" style="background:linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)"></div>';
    html += '<span class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-[0.15em]">или войти</span>';
    html += '<div class="flex-1 h-px" style="background:linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)"></div>';
    html += '</div>';

    // Join
    html += '<div class="flex gap-3">';
    html += '<input type="text" id="w-room-code" class="input-corp input-corp-code flex-1" placeholder="КОД" maxlength="5" autocomplete="off">';
    html += '<button id="btn-join" class="btn-neon px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer">';
    html += 'Войти →';
    html += '</button>';
    html += '</div>';

    html += '</div>'; // end card

    // Footer
    html += '<div class="flex flex-wrap items-center justify-center gap-5 mt-8">';
    html += '<a href="https://t.me/innovative_shirpotreb" target="_blank" class="flex items-center gap-1.5 text-[0.65rem] font-semibold text-corp-muted hover:text-accent-blue transition-colors uppercase tracking-wider">⚡ Telegram</a>';
    html += '<div class="w-px h-3 bg-corp-border"></div>';
    html += '<a href="https://www.donationalerts.com/r/tortyaka" target="_blank" class="flex items-center gap-1.5 text-[0.65rem] font-semibold text-corp-muted hover:text-accent-gold transition-colors uppercase tracking-wider">🍕 Поддержать</a>';
    html += '<div class="w-px h-3 bg-corp-border"></div>';
    html += '<a href="mailto:lokomas@inbox.ru" class="flex items-center gap-1.5 text-[0.65rem] font-semibold text-corp-muted hover:text-corp-light transition-colors uppercase tracking-wider">✉ Фидбек</a>';
    html += '</div>';

    // Connection
    html += '<div id="conn-status" class="flex items-center gap-2 mt-4">';
    html += '<div class="conn-dot bg-accent-gold"></div>';
    html += '<span class="conn-text text-xs font-semibold text-accent-gold">Подключение...</span>';
    html += '</div>';

    html += '</div>'; // end main wrapper

    container.innerHTML = html;

    // ═══════ LISTENERS ═══════
    var btnCreate = container.querySelector('#btn-create');
    var btnJoin = container.querySelector('#btn-join');
    var btnSolo = container.querySelector('#btn-solo');
    if (btnSolo) {
        btnSolo.addEventListener('click', function () {
            navigate('soloSettings');
        });
    }
    var nicknameInput = container.querySelector('#w-nickname');
    var codeInput = container.querySelector('#w-room-code');
    var btnRules = container.querySelector('#btn-rules');

    if (btnCreate) {
        btnCreate.addEventListener('click', function () {
            doCreateRoom(container);
        });
    }

    if (btnJoin) {
        btnJoin.addEventListener('click', function () {
            doJoinRoom(container);
        });
    }

    if (nicknameInput) {
        nicknameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                if (codeInput && codeInput.value.trim()) doJoinRoom(container);
                else doCreateRoom(container);
            }
        });
    }

    if (codeInput) {
        codeInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') doJoinRoom(container);
        });
    }

    // Rules toggle
    if (btnRules) {
        btnRules.addEventListener('click', function () {
            var panel = container.querySelector('#rules-panel');
            var arrow = container.querySelector('#rules-arrow');
            if (panel) {
                panel.classList.toggle('hidden');
                if (arrow) {
                    arrow.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(180deg)';
                }
            }
        });
    }

    startRotating(container);
}

// ═══════════════════════════════════════════
// НОВАЯ РОТАЦИЯ — берёт комбинации с сервера
// ═══════════════════════════════════════════

function fetchRandomCombo(callback) {
    fetch('/api/random-combo')
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data && data.text) callback(data.text);
        })
        .catch(function () {
            // Если сервер недоступен — показываем заглушку
            callback('Загрузка...');
        });
}

function startRotating(container) {
    if (startupInterval) {
        clearInterval(startupInterval);
        startupInterval = null;
    }

    // Первая загрузка через 1.5 сек
    setTimeout(function () {
        fetchRandomCombo(function (text) {
            var el = container.querySelector('#rotating-startup');
            if (el) el.textContent = '«' + text + '»';
        });
    }, 1500);

    // Далее каждые 5 секунд
    startupInterval = setInterval(function () {
        var el = container.querySelector('#rotating-startup');
        if (!el) {
            clearInterval(startupInterval);
            startupInterval = null;
            return;
        }

        // Анимация выхода
        el.classList.add('startup-text-exit');

        setTimeout(function () {
            fetchRandomCombo(function (text) {
                var el2 = container.querySelector('#rotating-startup');
                if (!el2) return;

                el2.textContent = '«' + text + '»';
                el2.classList.remove('startup-text-exit');
                el2.classList.add('startup-text-enter');

                setTimeout(function () {
                    var el3 = container.querySelector('#rotating-startup');
                    if (el3) el3.classList.remove('startup-text-enter');
                }, 400);
            });
        }, 300);
    }, 5000);
}

// ═══════════════════════════════════════════
// RULES CONTENT (без изменений)
// ═══════════════════════════════════════════

function buildRulesContent() {
    var html = '';
    html += '<div class="corp-card-elevated p-6 md:p-8 space-y-6 text-left">';

    // Intro
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🚀 Что это за игра?</h3>';
    html += '<p class="text-sm text-corp-light leading-relaxed">';
    html += 'Добро пожаловать в мир <span class="text-accent-gold font-bold">агрессивного маркетинга</span>! ';
    html += 'Каждый игрок получает набор случайных карт и должен собрать из них «инновационный продукт», ';
    html += 'а затем убедительно презентовать его остальным. Например:';
    html += '</p>';
    html += '<div class="mt-3 px-4 py-3 rounded-xl bg-corp-black/50 border-l-3 border-accent-gold/40">';
    html += '<span class="text-accent-gold font-bold italic">«Жидкий утюг, который следит за вашим здоровьем»</span>';
    html += '<span class="text-corp-muted"> — и это звучит как прорыв тысячелетия!</span>';
    html += '</div>';
    html += '</div>';

    // Two roles
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🎭 Две роли одновременно</h3>';
    html += '<div class="grid md:grid-cols-2 gap-3">';

    html += '<div class="corp-card p-4 border-accent-gold/20">';
    html += '<div class="text-2xl mb-2">🎤</div>';
    html += '<div class="text-sm font-black text-accent-gold mb-1">Предприниматель</div>';
    html += '<div class="text-xs text-corp-dim leading-relaxed">Презентуйте свой абсурдный продукт с серьёзным лицом. Чем убедительнее — тем больше инвестиций получите.</div>';
    html += '</div>';

    html += '<div class="corp-card p-4 border-accent-blue/20">';
    html += '<div class="text-2xl mb-2">💼</div>';
    html += '<div class="text-sm font-black text-accent-blue mb-1">Инвестор</div>';
    html += '<div class="text-xs text-corp-dim leading-relaxed">Распознайте потенциальный хит среди чужих проектов и вложите жетоны. Угадаете победителя — удвоите капитал!</div>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // How to play
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">📋 Как проходит раунд</h3>';
    html += '<div class="space-y-3">';

    html += buildStep('1', 'Подготовка', 'Каждый игрок получает 3 случайные карты: Прилагательное, Предмет и Особенность. У вас есть время придумать, как их объединить в продукт.', '🎴');
    html += buildStep('2', 'Питчи', 'По очереди выступаете перед остальными. Расскажите что это за продукт, кому он нужен и почему в него стоит вложиться.', '🎤');
    html += buildStep('3', 'Инвестирование', 'Все игроки тайно распределяют свои жетоны между понравившимися проектами. В себя вкладывать нельзя!', '💰');
    html += buildStep('4', 'Результаты', 'Кто собрал больше всего инвестиций — лучший предприниматель раунда. Те, кто в него вложился — получают ×2 от ставки!', '🏆');

    html += '</div>';
    html += '</div>';

    // Winning
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🏅 Два пути к победе</h3>';
    html += '<div class="space-y-2">';

    html += '<div class="flex items-start gap-3 p-3 rounded-xl bg-accent-green-dim border border-accent-green/15">';
    html += '<span class="text-xl flex-shrink-0">💼</span>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-accent-green">Лучший инвестор</div>';
    html += '<div class="text-xs text-corp-dim">У кого к финалу больше всего личного капитала</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="flex items-start gap-3 p-3 rounded-xl bg-accent-gold-dim border border-accent-gold/15">';
    html += '<span class="text-xl flex-shrink-0">🎤</span>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-accent-gold">Лучший предприниматель</div>';
    html += '<div class="text-xs text-corp-dim">Кто привлёк больше всего инвестиций за все раунды</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // Golden rules
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">⚡ Золотые правила</h3>';
    html += '<div class="space-y-2">';

    html += buildRule('🔴', 'Нельзя игнорировать карты', 'Если выпало «Бетонный» — объясните, почему продукт из бетона. Ответ «ну просто так» оставит вас без инвестиций.');
    html += buildRule('🔴', 'Нельзя инвестировать в себя', 'Только в чужие проекты. Рискуйте чужими идеями!');
    html += buildRule('🟢', 'Банкрот получает шанс', 'Потеряли весь капитал? Банк даёт 1 жетон — вы всё ещё в игре.');
    html += buildRule('🟢', 'Ничья = дополнительные выступления', 'При одинаковых инвестициях — дополнительный раунд питчей и переголосование.');

    html += '</div>';
    html += '</div>';

    // Events
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🎲 Колода событий</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Опциональная колода, которая добавляет безумия. Каждый раунд вытягивается карта события — ';
    html += 'дополнительное ограничение для ВСЕХ игроков. Например:';
    html += '</p>';
    html += '<div class="mt-3 space-y-2">';

    html += '<div class="flex items-center gap-2 text-xs">';
    html += '<span class="text-accent-gold">⚡</span>';
    html += '<span class="text-corp-light italic">«Ваша аудитория — роботы и ИИ»</span>';
    html += '</div>';

    html += '<div class="flex items-center gap-2 text-xs">';
    html += '<span class="text-accent-gold">⚡</span>';
    html += '<span class="text-corp-light italic">«Продукт запрещён в 20 странах мира»</span>';
    html += '</div>';

    html += '<div class="flex items-center gap-2 text-xs">';
    html += '<span class="text-accent-gold">⚡</span>';
    html += '<span class="text-corp-light italic">«Целевая аудитория — пожилые люди 80+»</span>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // Pseudo mode
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🎯 Псевдоинновации</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Лайт-режим для новичков! Вместо трёх карт (прилагательное + предмет + особенность) ';
    html += 'игроки получают только <span class="text-accent-blue font-bold">две карты</span>: ';
    html += 'прилагательное и предмет. Например: «Жидкий утюг» — и всё! ';
    html += 'Проще придумать питч, но сложнее выделиться среди конкурентов.';
    html += '</p>';
    html += '</div>';

    // Custom cards
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🧟 Генератор абсурда</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Альтернативный источник карт! Вместо нашей базы на 240 млн+ комбинаций — ';
    html += 'игроки сами придумывают прилагательные, предметы и особенности. ';
    html += 'Все карты перемешиваются между участниками — и каждый получает монстра Франкенштейна, ';
    html += 'которого нужно продать инвесторам!';
    html += '</p>';
    html += '<div class="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-corp-black/50 border-l-3 border-accent-gold/40">';
    html += '<span class="text-sm">⚠️</span>';
    html += '<span class="text-xs text-corp-dim">В этом режиме автоматические склонения не работают</span>';
    html += '</div>';
    html += '</div>';

    // Reviews
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">💬 Карточка отзыва</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Опциональная механика! Каждый игрок получает дополнительную карточку — ';
    html += '<span class="text-accent-gold font-bold">первый отзыв клиента</span> о продукте. ';
    html += 'Это может быть что-то вроде «После использования от меня ушла жена. Спасибо!» ';
    html += 'Используйте отзыв в своей презентации — объясните, почему это на самом деле хорошо!';
    html += '</p>';
    html += '</div>';

    // Target Audience
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🎯 Целевая аудитория</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Опциональная карточка! Каждый игрок получает дополнительную карту — ';
    html += '<span class="text-accent-gold font-bold">для кого предназначен продукт</span>. ';
    html += 'Это может быть что-то вроде «Для геймеров», «Для инопланетян» или «Для людей с ипотекой». ';
    html += 'Используйте аудиторию в презентации — объясните, почему именно эти люди нуждаются в вашем продукте!';
    html += '</p>';
    html += '</div>';

    // Hidden Defects
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">⚠️ Скрытый дефект</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Опциональная карточка! У каждого продукта есть ';
    html += '<span class="text-accent-gold font-bold">тайный недостаток</span>, ';
    html += 'о котором знают все. Это может быть «Разряжается за 1 час», ';
    html += '«Может взорваться в любой момент» или даже «Слишком хорош для дефектов». ';
    html += 'Задача предпринимателя — убедить инвесторов, что этот дефект на самом деле не так страшен ';
    html += '(или даже является преимуществом)!';
    html += '</p>';
    html += '</div>';

    // Packaging
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">📦 Упаковка</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Опциональная карточка! Каждый продукт приходит в ';
    html += '<span class="text-accent-gold font-bold">абсурдной упаковке</span>. ';
    html += 'Это может быть «Мусорный мешок», «Бронированный кейс», ';
    html += '«Замотано в старый ковёр» или «Папка с грифом СОВЕРШЕННО СЕКРЕТНО». ';
    html += 'Обыграйте упаковку в презентации — возможно, она добавляет ценности продукту!';
    html += '</p>';
    html += '</div>';

    // Modifiers
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">📜 Модификаторы предмета</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Добавьте эпичности! Модификатор — это дополнительные слова после предмета. ';
    html += 'Можно выбрать один из двух вариантов:';
    html += '</p>';
    html += '<div class="mt-3 space-y-2">';

    html += '<div class="flex items-start gap-3 p-3 rounded-xl bg-corp-black/30">';
    html += '<span class="text-lg flex-shrink-0">📜</span>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">Дополнение</div>';
    html += '<div class="text-xs text-corp-dim">+1 слово: «Утюг <span class="text-accent-green font-bold">СПРАВЕДЛИВОСТИ</span>»</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="flex items-start gap-3 p-3 rounded-xl bg-corp-black/30">';
    html += '<span class="text-lg flex-shrink-0">🌀</span>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">Метафора</div>';
    html += '<div class="text-xs text-corp-dim">+2 слова: «Утюг <span class="text-accent-green font-bold">ТОКСИЧНОЙ ЭНЕРГЕТИКИ</span>»</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    html += '<div class="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-corp-black/50 border-l-3 border-accent-gold/40">';
    html += '<span class="text-sm">⚠️</span>';
    html += '<span class="text-xs text-corp-dim">Не совместим с «Генератором абсурда». Можно выбрать только одну колоду модификаторов</span>';
    html += '</div>';
    html += '</div>';

    // Black Swan
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🦢 Чёрный лебедь</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Опциональная механика хаоса! При переходе к выступлению у каждого игрока есть ';
    html += '<span class="text-accent-red font-bold">20% шанс</span>, что одна из его карт ';
    html += 'внезапно заменится на другую — прямо перед питчем! Заменяется только ';
    html += '<span class="text-corp-light font-bold">одна</span> случайная карта (первая сработавшая). ';
    html += 'Придётся импровизировать на ходу!';
    html += '</p>';
    html += '<div class="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-corp-black/50 border-l-3 border-accent-red/40">';
    html += '<span class="text-sm">⚠️</span>';
    html += '<span class="text-xs text-corp-dim">Не совместим с «Генератором абсурда» — работает только с нашей базой</span>';
    html += '</div>';
    html += '</div>';

    // Bunker mode
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🏠 Выживание стартапов (Бункер)</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Альтернативный режим игры! Каждый игрок получает <span class="text-accent-gold font-bold">8 карточек</span>: ';
    html += 'прилагательное, предмет, модификатор, особенность, аудиторию, скрытый дефект, упаковку и отзыв. ';
    html += 'На экране появляется <span class="text-accent-red font-bold">глобальная проблема</span> — ';
    html += 'ваш продукт должен помочь человечеству справиться с ней!';
    html += '</p>';
    html += '<div class="mt-3 space-y-2">';

    html += '<div class="flex items-start gap-3 p-3 rounded-xl bg-corp-black/30">';
    html += '<span class="text-lg flex-shrink-0">🃏</span>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">Раскрытие карт</div>';
    html += '<div class="text-xs text-corp-dim">Игроки ходят по очереди и открывают по одной карте за раунд. Остальные видят только уже раскрытые карты.</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="flex items-start gap-3 p-3 rounded-xl bg-corp-black/30">';
    html += '<span class="text-lg flex-shrink-0">🗳</span>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">Голосование</div>';
    html += '<div class="text-xs text-corp-dim">После каждого раунда раскрытий — голосование за кик. Можно пропустить голосование. При ничье — переголосование.</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="flex items-start gap-3 p-3 rounded-xl bg-corp-black/30">';
    html += '<span class="text-lg flex-shrink-0">💀</span>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">Выбывание</div>';
    html += '<div class="text-xs text-corp-dim">Кикнутый игрок выбывает, и все его карты раскрываются. Игра продолжается, пока не останется нужное количество выживших.</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // Streamer mode
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🎬 Стримерский режим</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Для тех, кто играет через чат стрима или без микрофона. ';
    html += 'В этом режиме игроки пишут текст питча, который показывается всем на экране. ';
    html += 'Фаза подготовки завершается когда все нажмут «Готов» или по таймеру.';
    html += '</p>';
    html += '</div>';

    // Speech
    html += '<div>';
    html += '<h3 class="text-lg font-black text-accent-blue mb-3">🔊 Озвучка текста</h3>';
    html += '<p class="text-sm text-corp-dim leading-relaxed">';
    html += 'Голосовое сопровождение презентаций! Хост нажимает кнопку — и все игроки слышат ';
    html += 'озвучку названия продукта, карточек и даже текста питча в стримерском режиме. ';
    html += 'Использует встроенный синтезатор речи браузера — работает без интернета!';
    html += '</p>';
    html += '</div>';

    html += '</div>'; // end rules card
    return html;
}

function buildStep(num, title, desc, emoji) {
    var html = '';
    html += '<div class="flex items-start gap-4 p-4 rounded-xl bg-corp-black/30">';
    html += '<div class="w-10 h-10 rounded-full bg-accent-blue/15 border border-accent-blue/25 flex items-center justify-center flex-shrink-0">';
    html += '<span class="text-sm font-black text-accent-blue">' + num + '</span>';
    html += '</div>';
    html += '<div>';
    html += '<div class="flex items-center gap-2 mb-1">';
    html += '<span class="text-base">' + emoji + '</span>';
    html += '<span class="text-sm font-black text-corp-white">' + title + '</span>';
    html += '</div>';
    html += '<div class="text-xs text-corp-dim leading-relaxed">' + desc + '</div>';
    html += '</div>';
    html += '</div>';
    return html;
}

function buildRule(dot, title, desc) {
    var html = '';
    html += '<div class="flex items-start gap-3 py-2">';
    html += '<span class="text-sm flex-shrink-0 mt-0.5">' + dot + '</span>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">' + title + '</div>';
    html += '<div class="text-xs text-corp-dim leading-relaxed">' + desc + '</div>';
    html += '</div>';
    html += '</div>';
    return html;
}

// ═══════ ACTIONS ═══════

function doCreateRoom(container) {
    var input = container.querySelector('#w-nickname');
    if (!input) return;
    var nickname = input.value.trim();
    if (!nickname) {
        showNotification('Введите позывной!', 'error');
        input.focus();
        return;
    }
    sendMsg({ type: 'createRoom', nickname: nickname, settings: {} });
}

function doJoinRoom(container) {
    var nicknameInput = container.querySelector('#w-nickname');
    var codeInput = container.querySelector('#w-room-code');
    if (!nicknameInput || !codeInput) return;

    var nickname = nicknameInput.value.trim();
    var code = codeInput.value.trim().toUpperCase();

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
    sendMsg({ type: 'joinRoom', nickname: nickname, roomCode: code });
}