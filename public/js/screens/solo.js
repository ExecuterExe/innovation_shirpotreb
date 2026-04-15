import { state, setState, navigate, escapeHtml } from '../app.js';

var soloSettings = {
    pseudoMode: false,
    modifier: 'none',
    useReviews: false,
    useTargetAudience: false,
    useHiddenDefects: false,
    usePackaging: false,
    useEvents: false,
};

var SOLO_CARD_TYPES = [
    { key: 'adjective', label: 'Прилагательное', emoji: '🎨', gradient: 'card-adjective-gradient' },
    { key: 'item', label: 'Предмет', emoji: '📱', gradient: 'card-item-gradient' },
    { key: 'modifier', label: 'Модификатор', emoji: '📜', gradient: 'card-modifier-gradient' },
    { key: 'feature', label: 'Особенность', emoji: '✨', gradient: 'card-feature-gradient' },
    { key: 'targetAudience', label: 'Аудитория', emoji: '🎯', gradient: 'card-audience-gradient' },
    { key: 'hiddenDefect', label: 'Скрытый дефект', emoji: '⚠️', gradient: 'card-defect-gradient' },
    { key: 'packaging', label: 'Упаковка', emoji: '📦', gradient: 'card-packaging-gradient' },
    { key: 'review', label: 'Первый отзыв', emoji: '💬', gradient: 'card-review-gradient' },
];

// ═══════════════════════════════════════════
// НАСТРОЙКИ
// ═══════════════════════════════════════════

export function renderSoloSettings(container) {
    var s = soloSettings;

    var html = '';
    html += '<div class="min-h-screen flex flex-col px-4 py-8" style="background: radial-gradient(ellipse at top, rgba(0,180,255,0.04) 0%, transparent 60%)">';
    html += '<div class="max-w-xl mx-auto w-full flex flex-col flex-1">';

    // Back
    html += '<button id="btn-solo-back" class="flex items-center gap-2 text-corp-muted hover:text-corp-light text-sm font-bold mb-8 transition-colors group cursor-pointer w-fit">';
    html += '  <span class="group-hover:-translate-x-1 transition-transform inline-block">←</span>';
    html += '  <span>На главную</span>';
    html += '</button>';

    // Hero
    html += '<div class="text-center mb-8">';
    html += '  <div class="text-6xl mb-4" style="filter: drop-shadow(0 0 20px rgba(0,180,255,0.3));">🎲</div>';
    html += '  <h1 class="font-display text-3xl font-black text-corp-white mb-2">Одиночный режим</h1>';
    html += '  <p class="text-sm text-corp-muted max-w-sm mx-auto leading-relaxed">Настройте колоды — и получите случайный стартап для тренировки питча</p>';
    html += '</div>';

    // Псевдоинновации
    html += '<div class="corp-card p-4 flex items-center justify-between gap-4 mb-3">';
    html += '  <div class="flex items-center gap-3">';
    html += '    <div class="w-10 h-10 rounded-xl bg-accent-blue-dim border border-accent-blue/20 flex items-center justify-center text-lg flex-shrink-0">🃏</div>';
    html += '    <div>';
    html += '      <div class="text-sm font-bold text-corp-white">Псевдоинновации</div>';
    html += '      <div class="text-xs text-corp-muted">Только 2 карты: прилагательное + предмет</div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <input type="checkbox" id="solo-pseudo" class="toggle-corp flex-shrink-0"' + (s.pseudoMode ? ' checked' : '') + '>';
    html += '</div>';

    // Модификатор
    html += '<div class="corp-card p-5 mb-3">';
    html += '  <div class="flex items-center gap-3 mb-4">';
    html += '    <div class="w-10 h-10 rounded-xl bg-accent-green-dim border border-accent-green/20 flex items-center justify-center text-lg flex-shrink-0">📜</div>';
    html += '    <div>';
    html += '      <div class="text-sm font-bold text-corp-white">Модификатор предмета</div>';
    html += '      <div class="text-xs text-corp-muted">Добавляет слова после названия предмета</div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="grid grid-cols-3 gap-2">';

    var mods = [
        { value: 'none', label: '🚫 Без него', desc: 'Классика' },
        { value: 'addition', label: '📜 Дополнение', desc: '+1 слово' },
        { value: 'metaphor', label: '🌀 Метафора', desc: '+2 слова' },
    ];
    for (var mi = 0; mi < mods.length; mi++) {
        var m = mods[mi];
        var isActive = s.modifier === m.value;
        html += '<label class="relative flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer border-2 transition-all ';
        html += isActive ? 'border-accent-blue/50 bg-accent-blue-dim' : 'border-corp-border bg-corp-black/30 hover:border-corp-border/60';
        html += '">';
        html += '  <input type="radio" name="solo-modifier" value="' + m.value + '" class="solo-modifier-radio sr-only"' + (isActive ? ' checked' : '') + '>';
        html += '  <span class="text-sm font-black ' + (isActive ? 'text-accent-blue' : 'text-corp-light') + '">' + m.label + '</span>';
        html += '  <span class="text-[0.6rem] font-semibold ' + (isActive ? 'text-accent-blue/70' : 'text-corp-dim') + '">' + m.desc + '</span>';
        if (isActive) html += '  <div class="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent-blue"></div>';
        html += '</label>';
    }
    html += '  </div>';
    html += '</div>';

    // Дополнительные колоды
    html += '<div class="corp-card p-5 mb-6">';
    html += '  <div class="flex items-center gap-3 mb-4">';
    html += '    <div class="w-10 h-10 rounded-xl bg-accent-gold-dim border border-accent-gold/20 flex items-center justify-center text-lg flex-shrink-0">✨</div>';
    html += '    <div>';
    html += '      <div class="text-sm font-bold text-corp-white">Дополнительные колоды</div>';
    html += '      <div class="text-xs text-corp-muted">Добавьте больше карточек в продукт</div>';
    html += '    </div>';
    html += '  </div>';

    var extras = [
        { id: 'solo-reviews', key: 'useReviews', emoji: '💬', label: 'Первый отзыв', hint: 'Абсурдный отзыв клиента' },
        { id: 'solo-audience', key: 'useTargetAudience', emoji: '🎯', label: 'Целевая аудитория', hint: 'Для кого этот продукт' },
        { id: 'solo-defects', key: 'useHiddenDefects', emoji: '⚠️', label: 'Скрытый дефект', hint: 'Тайный недостаток' },
        { id: 'solo-packaging', key: 'usePackaging', emoji: '📦', label: 'Упаковка', hint: 'В чём придёт товар' },
        { id: 'solo-events', key: 'useEvents', emoji: '⚡', label: 'Событие', hint: 'Случайное ограничение' },
    ];

    html += '  <div class="space-y-1">';
    for (var ei = 0; ei < extras.length; ei++) {
        var ex = extras[ei];
        var isChecked = !!s[ex.key];
        html += '  <div class="flex items-center justify-between py-2.5 px-3 rounded-xl transition-all ' + (isChecked ? 'bg-accent-blue-dim border border-accent-blue/15' : 'hover:bg-corp-black/30 border border-transparent') + '">';
        html += '    <div class="flex items-center gap-2.5">';
        html += '      <span class="text-base">' + ex.emoji + '</span>';
        html += '      <div>';
        html += '        <div class="text-sm font-bold ' + (isChecked ? 'text-corp-white' : 'text-corp-light') + '">' + ex.label + '</div>';
        html += '        <div class="text-xs text-corp-muted">' + ex.hint + '</div>';
        html += '      </div>';
        html += '    </div>';
        html += '    <input type="checkbox" id="' + ex.id + '" class="toggle-corp flex-shrink-0"' + (isChecked ? ' checked' : '') + '>';
        html += '  </div>';
    }
    html += '  </div>';
    html += '</div>';

    // Launch
    html += '<button id="btn-solo-launch" class="btn-neon-solid w-full py-5 rounded-2xl text-lg font-black uppercase tracking-wide cursor-pointer" style="box-shadow: 0 0 30px rgba(0,180,255,0.2);">';
    html += '  🎲 Сгенерировать продукт!';
    html += '</button>';

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    // LISTENERS
    var btnBack = container.querySelector('#btn-solo-back');
    if (btnBack) btnBack.addEventListener('click', function () { navigate('welcome'); });

    var toggleMap = [
        { id: 'solo-pseudo', key: 'pseudoMode' },
        { id: 'solo-reviews', key: 'useReviews' },
        { id: 'solo-audience', key: 'useTargetAudience' },
        { id: 'solo-defects', key: 'useHiddenDefects' },
        { id: 'solo-packaging', key: 'usePackaging' },
        { id: 'solo-events', key: 'useEvents' },
    ];

    for (var ti = 0; ti < toggleMap.length; ti++) {
        (function (item) {
            var el = container.querySelector('#' + item.id);
            if (el) {
                el.addEventListener('change', function () {
                    soloSettings[item.key] = el.checked;
                    renderSoloSettings(container);
                });
            }
        })(toggleMap[ti]);
    }

    var modRadios = container.querySelectorAll('.solo-modifier-radio');
    for (var ri = 0; ri < modRadios.length; ri++) {
        (function (radio) {
            radio.addEventListener('change', function () {
                soloSettings.modifier = radio.value;
                renderSoloSettings(container);
            });
        })(modRadios[ri]);
    }

    var btnLaunch = container.querySelector('#btn-solo-launch');
    if (btnLaunch) {
        btnLaunch.addEventListener('click', function () {
            btnLaunch.textContent = '⏳ Загрузка...';
            btnLaunch.disabled = true;
            fetchSoloCards(function (result) {
                if (result) {
                    setState({ soloCards: result.cards, soloEvent: result.event });
                    navigate('soloCards');
                } else {
                    btnLaunch.textContent = '🎲 Сгенерировать продукт!';
                    btnLaunch.disabled = false;
                }
            });
        });
    }
}

// ═══════════════════════════════════════════
// КАРТОЧКИ
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// КАРТОЧКИ
// ═══════════════════════════════════════════

export function renderSoloCards(container) {
    var cards = state.soloCards || {};
    var event = state.soloEvent || null;

    var cardList = [];
    for (var ci = 0; ci < SOLO_CARD_TYPES.length; ci++) {
        var ct = SOLO_CARD_TYPES[ci];
        if (cards[ct.key]) cardList.push({ type: ct, value: cards[ct.key] });
    }

    var count = cardList.length;

    var html = '';
    // ❗️ ИЗМЕНЕНИЕ: Весь экран — одна колонка без прокрутки. h-screen + flex-col
    html += '<div class="h-screen flex flex-col px-4 py-8" style="background: radial-gradient(ellipse at center, rgba(0,180,255,0.03) 0%, transparent 70%)">';
    // ❗️ ИЗМЕНЕНИЕ: Внутренний контейнер тоже занимает всю высоту, чтобы разделить пространство
    html += '<div class="max-w-7xl mx-auto w-full flex flex-col h-full">';

    // ❗️ ИЗМЕНЕНИЕ: Основная зона для контента, которая растягивается (flex-1)
    // Она центрирует всё свое содержимое (карточки и событие)
    html += '<div class="flex-1 flex flex-col items-center justify-center w-full">';

    // Событие (если есть, показывается над карточками)
    if (event) {
        html += '<div class="corp-card border-accent-gold/25 bg-accent-gold-dim px-6 py-4 mb-8 max-w-4xl mx-auto w-full">';
        html += '  <div class="flex gap-4">';
        html += '    <span class="text-2xl flex-shrink-0">⚡</span>';
        html += '    <div>';
        html += '      <div class="text-[0.6rem] font-black text-accent-gold uppercase tracking-widest mb-1">Событие раунда</div>';
        html += '      <div class="text-sm text-corp-light leading-relaxed">' + escapeHtml(event) + '</div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }

    // ═══ КАРТОЧКИ ═══
    if (count > 0) {
        var cardHeight;
        if (count <= 3) cardHeight = '300px';
        else if (count <= 5) cardHeight = '260px';
        else if (count <= 6) cardHeight = '240px';
        else cardHeight = '210px';

        var cardMaxW;
        if (count <= 2) { cardMaxW = '400px'; }
        else if (count <= 3) { cardMaxW = '340px'; }
        else { cardMaxW = '280px'; }

        // ❗️ ИЗМЕНЕНИЕ: Убрали mb-10, отступы теперь управляются flex-контейнером
        html += '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 justify-items-center gap-6 w-full">';

        for (var i = 0; i < count; i++) {
            var card = cardList[i];
            var val = card.value || '';
            var delay = (i * 80) + 'ms';

            var base, vmin, vmax;
            var textLen = val.length;

            if (count <= 3) {
                if (textLen <= 10) { base = 1.5; vmin = 3; vmax = 2.5; }
                else if (textLen <= 20) { base = 1.2; vmin = 2.5; vmax = 2.0; }
                else if (textLen <= 40) { base = 1.0; vmin = 2; vmax = 1.5; }
                else { base = 0.85; vmin = 1.5; vmax = 1.1; }
            } else if (count <= 5) {
                if (textLen <= 10) { base = 1.2; vmin = 2.5; vmax = 2.0; }
                else if (textLen <= 20) { base = 1.0; vmin = 2; vmax = 1.6; }
                else if (textLen <= 40) { base = 0.85; vmin = 1.5; vmax = 1.2; }
                else { base = 0.75; vmin = 1.2; vmax = 0.95; }
            } else {
                if (textLen <= 10) { base = 1.0; vmin = 2; vmax = 1.6; }
                else if (textLen <= 20) { base = 0.9; vmin = 1.8; vmax = 1.3; }
                else if (textLen <= 40) { base = 0.8; vmin = 1.4; vmax = 1.0; }
                else { base = 0.7; vmin = 1.1; vmax = 0.85; }
            }

            if (card.type.key === 'adjective' || card.type.key === 'modifier') {
                var multiplier = 0.85;
                base *= multiplier;
                vmax *= multiplier;
            }

            var fontSize = 'clamp(' + base.toFixed(2) + 'rem, ' + vmin + 'vw, ' + vmax.toFixed(2) + 'rem)';

            html += '<div class="animate-card-deal w-full" style="';
            html += 'animation-delay:' + delay + ';';
            html += 'animation-fill-mode:backwards;';
            html += 'max-width:' + cardMaxW + ';';
            html += '">';

            html += '  <div class="relative rounded-3xl overflow-hidden ' + card.type.gradient + ' shadow-2xl hover:scale-[1.02] hover:-translate-y-2 transition-all duration-300 select-none w-full" style="height:' + cardHeight + ';">';
            html += '    <div class="absolute top-0 left-0 right-0 flex items-center gap-2 px-5 bg-black/30" style="height: 48px;">';
            html += '      <span style="font-size: 1.1rem;">' + card.type.emoji + '</span>';
            html += '      <span class="font-black uppercase tracking-[0.12em] text-white/70" style="font-size: 0.6rem;">' + card.type.label + '</span>';
            html += '    </div>';
            html += '    <div class="absolute inset-0 flex items-center justify-center text-center" style="padding: 56px 20px 20px 20px;">';
            html += '      <span class="font-black text-white drop-shadow-lg w-full" style="';
            html += 'font-size:' + fontSize + ';';
            html += 'line-height: 1.2;';
            html += 'word-break: break-word;';
            html += 'overflow-wrap: break-word;';
            html += '">';
            html += escapeHtml(val);
            html += '      </span>';
            html += '    </div>';
            html += '    <div class="card-shimmer"></div>';
            html += '  </div>';
            html += '</div>';
        }

        html += '</div>';
    }

    html += '</div>'; // Конец основной зоны (flex-1)

    // ❗️ ИЗМЕНЕНИЕ: Кнопки в отдельном блоке, который не растягивается (flex-shrink-0)
    html += '<div class="flex-shrink-0 pt-4">';
    html += '<div class="flex flex-wrap items-center justify-center gap-3">';
    html += '  <button id="btn-solo-refresh" class="btn-neon-solid px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-wider cursor-pointer">🎲 Новый продукт</button>';
    html += '  <button id="btn-solo-settings" class="btn-neon px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-wider cursor-pointer">⚙️ Настройки</button>';
    html += '  <button id="btn-solo-home" class="btn-neon px-6 py-4 rounded-2xl text-sm font-bold cursor-pointer">🏠 На главную</button>';
    html += '</div>';
    html += '</div>'; // Конец блока кнопок

    html += '</div>'; // Конец .max-w-7xl
    html += '</div>'; // Конец .h-screen

    container.innerHTML = html;

    // LISTENERS (без изменений)
    var btnRefresh = container.querySelector('#btn-solo-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', function () {
            btnRefresh.textContent = '⏳ Загрузка...';
            btnRefresh.disabled = true;
            fetchSoloCards(function (result) {
                if (result) {
                    setState({ soloCards: result.cards, soloEvent: result.event });
                    navigate('soloCards');
                } else {
                    btnRefresh.textContent = '🎲 Новый продукт';
                    btnRefresh.disabled = false;
                }
            });
        });
    }

    var btnSettings = container.querySelector('#btn-solo-settings');
    if (btnSettings) btnSettings.addEventListener('click', function () { navigate('soloSettings'); });

    var btnHome = container.querySelector('#btn-solo-home');
    if (btnHome) btnHome.addEventListener('click', function () { navigate('welcome'); });
}

// ═══════════════════════════════════════════
// API
// ═══════════════════════════════════════════

function fetchSoloCards(callback) {
    var s = soloSettings;
    var params = new URLSearchParams({
        pseudoMode: s.pseudoMode ? 'true' : 'false',
        modifier: s.modifier || 'none',
        useReviews: s.useReviews ? 'true' : 'false',
        useTargetAudience: s.useTargetAudience ? 'true' : 'false',
        useHiddenDefects: s.useHiddenDefects ? 'true' : 'false',
        usePackaging: s.usePackaging ? 'true' : 'false',
        useEvents: s.useEvents ? 'true' : 'false',
    });

    fetch('/api/solo-cards?' + params.toString())
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data && data.cards) callback(data);
            else callback(null);
        })
        .catch(function (err) {
            console.error('[solo] error:', err);
            callback(null);
        });
}