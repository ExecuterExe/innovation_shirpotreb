import { state, escapeHtml } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';
import { showNotification } from '../components/notification.js';
import { renderBunkerChat } from '../components/bunker-chat.js';
import { logoSvg } from '../components/logo.js';
import { buildReactionBarHtml, bindReactionButtons } from '../components/reactions.js';

var MAX_PLAYERS_MIN = 3;
var MAX_PLAYERS_MAX = 18;
var SETTINGS_TAB = 'params';
var IS_CODE_HIDDEN = false;
var seenPlayers = { room: null, ids: {} };
var codeAnimatedFor = null;

// Вкладки: 'params' | 'modes' | 'bunker'

// Сколько человек реально играет: ведущий без карт место не занимает
function countPlayingSeats() {
    var players = state.players || [];
    var n = players.length;
    if (state.settings && state.settings.hostObserves) {
        for (var i = 0; i < players.length; i++) {
            if (players[i].isHost) { n--; break; }
        }
    }
    return n;
}

// ═══════════════════════════════════════════
// Экспортируемые функции для частичного обновления
// (вызываются из socket.js при lobbyUpdate)
// ═══════════════════════════════════════════

function buildRoomNameHtml() {
    var roomName = (state.settings && state.settings.roomName) || '';
    if (!roomName) return '';
    return '<div class="text-lg font-black text-corp-white mb-1 truncate">' + escapeHtml(roomName) + '</div>';
}

export function updateRoomHeader(container) {
    var el = container.querySelector('#room-name-display');
    if (el) el.innerHTML = buildRoomNameHtml();
}

export function updatePlayersList(container) {
    var list = container.querySelector('#players-list');
    if (!list) return;
    var players = state.players || [];
    var hostObserves = !!(state.settings && state.settings.hostObserves);

    var countEl = container.querySelector('#players-count');
    if (countEl) countEl.textContent = countPlayingSeats() + (hostObserves ? ' + ведущий' : '');

    // Кого уже показывали — новенькие въезжают с подсветкой
    if (seenPlayers.room !== state.roomCode) seenPlayers = { room: state.roomCode, ids: {} };
    var seen = seenPlayers.ids;
    var nextSeen = {};

    var html = '';
    var seat = 0;
    for (var i = 0; i < players.length; i++) {
        var p = players[i];
        var isMe = p.id === state.playerId;
        var canKick = state.isHost && !isMe && !p.isHost;
        // Ведущий без карт — не занимает игровое место и не получает номер
        var observing = hostObserves && p.isHost;
        if (!observing) seat++;
        var hue1 = i * 45 + 120;
        var hue2 = i * 45 + 160;
        var hue3 = i * 45 + 140;
        var isNew = !seen[p.id];
        nextSeen[p.id] = true;

        html += '<div class="corp-card px-5 py-4 flex items-center gap-4 emotion-anchor' + (isNew ? ' player-row-enter' : '');
        if (observing) html += ' border-accent-gold/25';
        else if (isMe) html += ' border-accent-blue/20';
        html += '" data-player-id="' + p.id + '"' + (isMe ? ' data-emotion-self="1"' : '') + '>';
        if (observing) {
            html += '<div class="w-9 h-9 rounded-full flex items-center justify-center text-base" style="background:rgba(255,199,44,0.12);border:1px solid rgba(255,199,44,0.3)">🎙</div>';
        } else {
            html += '<div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black" style="background: linear-gradient(135deg, hsl(' + hue1 + ',40%,20%), hsl(' + hue2 + ',40%,15%)); color: hsl(' + hue3 + ',60%,65%);">';
            html += seat;
            html += '</div>';
        }
        html += '<div class="flex-1 min-w-0">';
        html += '<div class="font-bold text-corp-light truncate">' + escapeHtml(p.nickname) + '</div>';
        if (observing) html += '<div class="text-[0.65rem] text-corp-dim">ведёт игру, без карт</div>';
        html += '</div>';
        var cups = parseInt(p.investorCups) || 0;
        var bags = parseInt(p.entrepreneurMoneybags) || 0;
        if (cups > 0 || bags > 0) {
            html += '<div class="text-[0.65rem] text-corp-muted font-black tracking-wide">';
            if (cups > 0) {
                html += '<span title="Лучший инвестор игр">💼'.repeat(Math.min(cups, 5)) + (cups > 5 ? '×' + cups : '') + '</span>';
            }
            if (bags > 0) {
                html += ' <span title="Лучший предприниматель игр">💰'.repeat(Math.min(bags, 5)) + (bags > 5 ? '×' + bags : '') + '</span>';
            }
            html += '</div>';
        }
        html += '<div class="flex gap-2">';
        if (p.isHost) {
            html += '<span class="text-[0.65rem] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-accent-gold-dim text-accent-gold border border-accent-gold/20">' + (observing ? 'ВЕДУЩИЙ' : 'ХОСТ') + '</span>';
        }
        if (isMe) {
            html += '<span class="text-[0.65rem] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-accent-blue-dim text-accent-blue border border-accent-blue/20">ВЫ</span>';
        }
        if (canKick) {
            html += '<button class="kick-player-btn w-7 h-7 rounded-lg border border-accent-red/25 text-accent-red hover:bg-accent-red/10 transition-colors text-xs font-black cursor-pointer" title="Исключить игрока" data-player-id="' + p.id + '" data-player-name="' + escapeHtml(p.nickname) + '">✕</button>';
        }
        html += '</div>';
        html += '</div>';
    }
    // Зрители
    var spectators = state.spectators || [];
    if (spectators.length > 0) {
        html += '<div class="mt-3 pt-3 border-t border-corp-border/30">';
        html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-2">👀 Зрители</div>';
        html += '<div class="flex flex-wrap gap-2">';
        for (var si = 0; si < spectators.length; si++) {
            html += '<span class="text-xs px-2 py-1 rounded-lg bg-corp-graphite border border-corp-border text-corp-dim">' + escapeHtml(spectators[si].nickname) + '</span>';
        }
        html += '</div>';
        html += '</div>';
    }

    list.innerHTML = html;
    seenPlayers.ids = nextSeen;

    var kickBtns = container.querySelectorAll('.kick-player-btn');
    for (var kb = 0; kb < kickBtns.length; kb++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var targetId = btn.getAttribute('data-player-id');
                var targetName = btn.getAttribute('data-player-name') || 'игрока';
                if (!targetId) return;
                if (!window.confirm('Исключить игрока «' + targetName + '» из комнаты?')) return;
                sendMsg({ type: 'kickPlayer', targetPlayerId: targetId });
            });
        })(kickBtns[kb]);
    }
}

export function updateStartButton(container) {
    var area = container.querySelector('#start-button-area');
    if (!area) return;

    var isHost = state.isHost;
    var seats = countPlayingSeats();
    var canStart = seats >= 3;
    var needText = seats + ' / 3 минимум' + (state.settings && state.settings.hostObserves ? ' (без ведущего)' : '');

    var html = '';
    if (isHost && canStart) {
        var isBunker = state.settings && state.settings.bunkerMode;
        var btnText = isBunker ? 'Начать выживание' : 'Начать питчинг';
        var btnEmoji = isBunker ? '🏠' : '📣';
        html = '<button id="btn-start" class="btn-neon-solid w-full py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">' + btnEmoji + ' ' + btnText + '</button>';
    } else if (isHost) {
        html = '<div class="text-center py-4"><div class="text-xs font-black text-corp-muted uppercase tracking-[0.14em] mb-1">Ожидание игроков</div><div class="text-sm font-bold text-corp-dim">' + needText + '</div></div>';
    } else if (canStart) {
        html = '<div class="text-center py-4"><div class="text-xs font-black text-corp-muted uppercase tracking-[0.14em] mb-1">Ожидание хоста</div><div class="inline-flex items-center gap-1.5"><div class="conn-dot bg-accent-blue w-1.5 h-1.5"></div><span class="text-sm font-bold text-accent-blue">Готово к старту</span></div></div>';
    } else {
        html = '<div class="text-center py-4"><div class="text-xs font-black text-corp-muted uppercase tracking-[0.14em] mb-1">Ожидание игроков</div><div class="text-sm font-bold text-corp-dim">' + needText + '</div></div>';
    }
    area.innerHTML = html;

    // Re-attach start button listener
    var btnStart = container.querySelector('#btn-start');
    if (btnStart) {
        btnStart.addEventListener('click', function () {
            console.log('[lobby] Start clicked');
            sendMsg({ type: 'startGame' });
        });
    }
}

export function updateSettingsPanel(container) {
    var panel = container.querySelector('#settings-panel');
    if (!panel) return;

    var s = state.settings || {};
    var isParams = SETTINGS_TAB === 'params';
    var isModes  = SETTINGS_TAB === 'modes';
    var isBunker = SETTINGS_TAB === 'bunker';

    var html = '';

    // ─── БЕЙДЖ АКТИВНОГО РЕЖИМА ───
    if (s.bunkerMode) {
        html += '<div class="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3)">';
        html += '  <span style="width:8px;height:8px;border-radius:50%;background:#ff3b3b;display:inline-block;box-shadow:0 0 8px #ff3b3b;flex-shrink:0" class="bunker-mode-pulse-dot"></span>';
        html += '  <span class="text-[0.65rem] font-black uppercase tracking-wider text-accent-red">🏠 Активен режим: Бункер</span>';
        html += '</div>';
    }

    // ─── ВКЛАДКИ ───
    html += '<div class="flex gap-1 p-1 rounded-2xl mb-5" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.07)">';

    html += '<button id="settings-tab-params" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[0.65rem] font-black uppercase tracking-wider transition-all cursor-pointer ';
    html += isParams
        ? 'text-accent-blue' + '" style="background:rgba(0,180,255,0.12);border:1px solid rgba(0,180,255,0.2)"'
        : 'text-corp-muted hover:text-corp-light"';
    html += '>⚙️ Партия</button>';

    html += '<button id="settings-tab-modes" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[0.65rem] font-black uppercase tracking-wider transition-all cursor-pointer ';
    html += isModes
        ? 'text-accent-green' + '" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2)"'
        : 'text-corp-muted hover:text-corp-light"';
    html += '>🎴 Механики</button>';

    html += '<button id="settings-tab-bunker" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[0.65rem] font-black uppercase tracking-wider transition-all cursor-pointer ';
    html += isBunker
        ? 'text-accent-red' + '" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.2)"'
        : (s.bunkerMode ? 'text-accent-red/70 hover:text-accent-red"' : 'text-corp-muted hover:text-corp-light"');
    html += '>🏠 Бункер' + (s.bunkerMode ? ' <span style="width:6px;height:6px;border-radius:50%;background:#ff3b3b;display:inline-block;vertical-align:middle"></span>' : '') + '</button>';

    html += '</div>';

    // ─── ВКЛАДКА: ПАРТИЯ ───
    html += '<div id="settings-pane-params"' + (isParams ? '' : ' class="hidden"') + '>';

    // Ведущий без карт — для преподавателя, тренера, ведущего мероприятия
    var observesOn = !!s.hostObserves;
    html += '<label for="set-host-observes" class="flex items-center justify-between gap-4 py-3.5 px-4 rounded-xl cursor-pointer transition-all mb-4" style="background:' + (observesOn ? 'rgba(255,199,44,0.09)' : 'rgba(0,0,0,0.2)') + ';border:1px solid ' + (observesOn ? 'rgba(255,199,44,0.3)' : 'rgba(255,255,255,0.07)') + '">';
    html += '  <div class="text-2xl flex-shrink-0">🎙</div>';
    html += '  <div class="flex-1">';
    html += '    <div class="text-sm font-black ' + (observesOn ? 'text-accent-gold' : 'text-corp-light') + '">Я только веду игру</div>';
    html += '    <div class="text-[0.7rem] text-corp-dim mt-0.5 leading-snug">Вы не получаете карт и не инвестируете — видите все выступления и управляете переходами. Для преподавателя или ведущего.</div>';
    html += '  </div>';
    html += '  <input type="checkbox" id="set-host-observes" class="toggle-corp flex-shrink-0"' + (observesOn ? ' checked' : '') + '>';
    html += '</label>';

    html += '<div class="space-y-1">';
    html += buildSetting('👥 Макс. игроков',       'maxPlayers', 'set-max-players', MAX_PLAYERS_MIN, MAX_PLAYERS_MAX, s.maxPlayers || 8, 1);
    html += buildSetting('🔁 Количество раундов',  'rounds',     'set-rounds',      1, 7,   s.rounds || 3, 1);
    html += buildSetting('💰 Стартовый капитал',   'capital',    'set-capital',     3, 30,  s.startCapital || 10, 1);
    html += '</div>';
    html += buildSectionDivider('Тайминги');
    html += '<div class="space-y-1">';
    html += buildSetting('⏱ Подготовка',      'prep',    'set-prep',     30, 300, s.prepTime || 60,    15);
    html += buildSetting('🎤 Питч',            'present', 'set-present',  60, 300, s.presentTime || 120, 15);
    html += buildSetting('📈 Инвестирование',  'invest',  'set-invest',   30, 120, s.investTime || 60,   10);
    html += '</div>';

    // Вопросы после питча — необязательная фаза, по умолчанию выключена
    var qt = parseInt(s.questionsTime, 10);
    if ([0, -1, 30, 60, 90].indexOf(qt) === -1) qt = 0;
    html += '<div class="mt-3">';
    html += '<div class="text-sm font-bold text-corp-light mb-2 px-1">🙋 Вопросы после питча</div>';
    html += '<div class="grid grid-cols-3 sm:grid-cols-5 gap-1.5">';
    html += buildRadioCard('0',  'questions-radio', qt === 0,  '🚫', 'Выкл',        '', 'muted');
    html += buildRadioCard('-1', 'questions-radio', qt === -1, '♾️', 'Без таймера', '', 'gold');
    html += buildRadioCard('30', 'questions-radio', qt === 30, '⏱', '30 сек',      '', 'gold');
    html += buildRadioCard('60', 'questions-radio', qt === 60, '⏱', '60 сек',      '', 'gold');
    html += buildRadioCard('90', 'questions-radio', qt === 90, '⏱', '90 сек',      '', 'gold');
    html += '</div>';
    html += '<div class="text-[0.6rem] text-corp-dim mt-1.5 px-1">Слушатели поднимают руку, ведущий переходит дальше кнопкой. «Без таймера» — пока ведущий не нажмёт «Дальше».</div>';
    html += '</div>';
    html += buildSectionDivider('Видимость комнаты');
    var isPrivate = !!s.roomPrivate;
    html += '<div class="space-y-2">';
    html += '<div>';
    html += '<div class="flex gap-2 items-stretch">';
    html += '<input type="text" id="set-room-name" class="input-corp text-sm flex-1 min-w-0" placeholder="✏️ Название комнаты (необязательно)..." maxlength="40" autocomplete="off" value="' + escapeHtml(s.roomName || '') + '">';
    html += '<button id="btn-apply-room-name" class="btn-apply-inline">Применить</button>';
    html += '</div>';
    html += '<div class="text-[0.55rem] text-corp-dim mt-1">Показывается вместо/рядом с кодом — своим и в списке открытых комнат.</div>';
    html += '</div>';
    html += buildToggle('🔓 Открытая комната', 'Отображается в списке комнат с кодом. По умолчанию комната закрыта — виден только код для входа.', 'set-room-open', !isPrivate, false);
    if (isPrivate) {
        html += '<div class="px-3 py-2 rounded-xl" style="background:rgba(255,180,0,0.06);border:1px solid rgba(255,180,0,0.15)">';
        html += '<div class="text-[0.6rem] font-black text-accent-gold uppercase tracking-wider mb-1.5">🔑 Пароль для входа (необязательно)</div>';
        html += '<div class="flex gap-2 items-stretch">';
        html += '<input type="text" id="set-room-password" class="input-corp text-sm flex-1 min-w-0" placeholder="Пусто — вход только по коду, без пароля" maxlength="30" autocomplete="off" value="' + escapeHtml(s.roomPassword || '') + '">';
        html += '<button id="btn-apply-room-password" class="btn-apply-inline">Применить</button>';
        html += '</div>';
        html += '<div class="text-[0.55rem] text-corp-dim mt-1">Комната не отображается в публичном списке. Если пароль задан — игрок должен знать и код, и пароль.</div>';
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    // ─── ВКЛАДКА: МЕХАНИКИ ───
    html += '<div id="settings-pane-modes"' + (isModes ? '' : ' class="hidden"') + '>';

    html += buildSectionDivider('Источник карт');
    var isDb      = !s.cardSource || s.cardSource === 'database';
    var isPlayers = s.cardSource === 'players';
    html += '<div class="grid grid-cols-2 gap-2 mb-4">';
    html += buildRadioCard('database', 'card-source-radio', isDb,      '🗃', 'Наша база',         '240 млн+ комбинаций', 'blue');
    html += buildRadioCard('players',  'card-source-radio', isPlayers, '🧟', 'Генератор абсурда', 'Карты придумывают игроки', 'gold');
    html += '</div>';

    // Колода: живой пример продукта → быстрые наборы → из чего собрать руку
    html += buildDeckPreview(s);

    html += buildSectionDivider('Быстрый выбор');
    html += buildDeckPresets(s);

    html += buildSectionDivider('Основа продукта');
    html += buildDeckBase(s);

    html += buildSectionDivider('Слово к предмету');
    var modNone = !s.modifier || s.modifier === 'none';
    var modAdd  = s.modifier === 'addition';
    var modMeta = s.modifier === 'metaphor';
    html += '<div class="grid grid-cols-3 gap-2 mb-1">';
    html += buildRadioCard('none',      'modifier-radio', modNone, '➖', 'Без слова',  'УТЮГ',                   'muted');
    html += buildRadioCard('addition',  'modifier-radio', modAdd,  '📜', '+1 слово',   'УТЮГ ЛЮБВИ',             'green');
    html += buildRadioCard('metaphor',  'modifier-radio', modMeta, '🌀', '+2 слова',   'УТЮГ ВНЕЗАПНОГО УСПЕХА', 'green');
    html += '</div>';

    html += buildSectionDivider('Дополнительные карты');
    html += '<div class="grid grid-cols-2 gap-2">';
    html += buildDeckTile('set-reviews',         '💬', 'Первый отзыв',  '«Пока ждал — успел состариться!»', s.useReviews,        '#f5b731');
    html += buildDeckTile('set-target-audience', '🎯', 'Аудитория',     'для трудоголиков',                 s.useTargetAudience, '#ec4899');
    html += buildDeckTile('set-hidden-defects',  '⚠️', 'Скрытый дефект', 'разряжается за 1 час',            s.useHiddenDefects,  '#f97316');
    html += buildDeckTile('set-packaging',       '📦', 'Упаковка',      'замотано в 5 слоёв изоленты',      s.usePackaging,      '#14b8a6');
    html += '</div>';

    html += buildSectionDivider('Сюрпризы раунда');
    html += '<div class="grid grid-cols-2 gap-2">';
    html += buildDeckTile('set-events',    '🎲', 'События',       'новое условие каждый раунд: «продаём только государству»', s.useEvents, '#00b4ff');
    html += buildDeckTile('set-blackswan', '🦢', 'Чёрный лебедь', '20% шанс, что карту заменят прямо во время питча',        s.blackSwan, '#a78bfa');
    html += '</div>';

    html += buildSectionDivider('Стриминг');
    html += '<div class="space-y-0.5">';
    html += buildToggle('Текстовые питчи',       'Для стримера / без микрофона',              'set-streamer', s.streamerMode,          false);
    html += buildToggle('Зашифровать участников','Имена → псевдонимы (только в текст. режиме)', 'set-anon',    s.anonymizeParticipants, !s.streamerMode);
    html += buildToggle('Озвучка текста',        'Хост управляет голосовым сопровождением',   'set-speech',   s.useSpeech,             false);
    html += '</div>';

    html += '</div>';

    // ─── ВКЛАДКА: БУНКЕР ───
    html += '<div id="settings-pane-bunker"' + (isBunker ? '' : ' class="hidden"') + '>';

    // Главный переключатель
    var bunkerOn = !!s.bunkerMode;
    html += '<div class="rounded-2xl p-5 mb-4" style="background:' + (bunkerOn ? 'rgba(255,59,59,0.08)' : 'rgba(0,0,0,0.2)') + ';border:1px solid ' + (bunkerOn ? 'rgba(255,59,59,0.25)' : 'rgba(255,255,255,0.07)') + '">';
    html += '  <div class="flex items-start justify-between gap-4">';
    html += '    <div class="flex-1">';
    html += '      <div class="text-base font-black ' + (bunkerOn ? 'text-accent-red' : 'text-corp-light') + ' mb-1">🏠 Режим «Бункер»</div>';
    html += '      <div class="text-xs text-corp-muted leading-relaxed">Выживание стартапов: каждый получает 9 карт, раскрывает по одной за ход. Остальные голосуют кого кикнуть. Последние выжившие — спасители человечества.</div>';
    html += '    </div>';
    html += '    <input type="checkbox" id="set-bunker" class="toggle-corp mt-0.5 flex-shrink-0"' + (bunkerOn ? ' checked' : '') + '>';
    html += '  </div>';
    if (bunkerOn) {
        html += '  <div class="mt-3 pt-3 border-t border-accent-red/15">';
        html += '    <div class="flex items-center gap-2 text-xs font-bold text-accent-red/70"><span>⚠️</span> Несовместимо: Псевдоинновации, Генератор абсурда</div>';
        html += '  </div>';
    }
    html += '</div>';

    html += buildSectionDivider('Управление темпом');
    var hostModeOn = !!s.bunkerHostMode;
    html += '<label for="set-bunker-hostmode" class="flex items-center justify-between py-3 px-4 rounded-xl cursor-pointer transition-all mb-4" style="background:' + (hostModeOn ? 'rgba(245,183,49,0.08)' : 'rgba(0,0,0,0.15)') + ';border:1px solid ' + (hostModeOn ? 'rgba(245,183,49,0.2)' : 'rgba(255,255,255,0.07)') + '">';
    html += '  <div class="flex-1 mr-4">';
    html += '    <div class="text-sm font-black ' + (hostModeOn ? 'text-accent-gold' : 'text-corp-light') + '">🎙 Режим ведущего</div>';
    html += '    <div class="text-[0.6rem] text-corp-dim mt-0.5">Без таймеров — ведущий вручную переходит между ходами и запускает голосование</div>';
    html += '  </div>';
    html += '  <input type="checkbox" id="set-bunker-hostmode" class="toggle-corp flex-shrink-0"' + (hostModeOn ? ' checked' : '') + '>';
    html += '</label>';

    // Статистика режима
    html += buildSectionDivider('Как это работает');
    html += '<div class="grid grid-cols-2 gap-2 mb-4">';
    html += buildInfoTile('🃏', '9 карт', 'у каждого игрока');
    html += buildInfoTile('👁', 'По одной', 'раскрытие за ход');
    html += buildInfoTile('🗳', 'Голосование', 'после каждого раунда');
    html += buildInfoTile('🏆', '~50%', 'игроков выживает');
    html += '</div>';

    // Настройки бункера
    html += buildSectionDivider('Настройки бункера');
    html += '<div class="space-y-2">';

    var chatOn = s.bunkerChat !== false; // default on
    html += '<label for="set-bunker-chat" class="flex items-center justify-between py-3 px-4 rounded-xl cursor-pointer transition-all" style="background:' + (chatOn ? 'rgba(0,180,255,0.06)' : 'rgba(0,0,0,0.15)') + ';border:1px solid ' + (chatOn ? 'rgba(0,180,255,0.18)' : 'rgba(255,255,255,0.07)') + '">';
    html += '  <div class="flex-1 mr-4">';
    html += '    <div class="text-sm font-black ' + (chatOn ? 'text-accent-blue' : 'text-corp-light') + '">💬 Чат продолжится в игре</div>';
    html += '    <div class="text-[0.7rem] text-corp-dim mt-0.5">В лобби чат есть всегда. Эта настройка решает, останется ли он виден во время самой партии.</div>';
    html += '  </div>';
    html += '  <input type="checkbox" id="set-bunker-chat" class="toggle-corp flex-shrink-0"' + (chatOn ? ' checked' : '') + '>';
    html += '</label>';

    var ttsOn = !!s.chatTTS;
    html += '<label for="set-chat-tts" class="flex items-center justify-between py-3 px-4 rounded-xl cursor-pointer transition-all" style="background:' + (ttsOn ? 'rgba(0,180,255,0.06)' : 'rgba(0,0,0,0.15)') + ';border:1px solid ' + (ttsOn ? 'rgba(0,180,255,0.18)' : 'rgba(255,255,255,0.07)') + '">';
    html += '  <div class="flex-1 mr-4">';
    html += '    <div class="text-sm font-black ' + (ttsOn ? 'text-accent-blue' : 'text-corp-light') + '">🔉 Озвучка питчей</div>';
    html += '    <div class="text-[0.7rem] text-corp-dim mt-0.5">Питчи с командой <span class="font-mono text-corp-light">!питч текст</span> произносятся синтезатором речи для всей комнаты.</div>';
    html += '  </div>';
    html += '  <input type="checkbox" id="set-chat-tts" class="toggle-corp flex-shrink-0"' + (ttsOn ? ' checked' : '') + '>';
    html += '</label>';

    var actionCardsOn = s.bunkerActionCards !== false; // default on
    html += '<label for="set-bunker-actioncards" class="flex items-center justify-between py-3 px-4 rounded-xl cursor-pointer transition-all" style="background:' + (actionCardsOn ? 'rgba(245,183,49,0.08)' : 'rgba(0,0,0,0.15)') + ';border:1px solid ' + (actionCardsOn ? 'rgba(245,183,49,0.2)' : 'rgba(255,255,255,0.07)') + '">';
    html += '  <div class="flex-1 mr-4">';
    html += '    <div class="text-sm font-black ' + (actionCardsOn ? 'text-accent-gold' : 'text-corp-light') + '">⚡ Карты действия</div>';
    html += '    <div class="text-[0.7rem] text-corp-dim mt-0.5">Каждый получает 2 особые карты (заставить раскрыться, спасти от кика, ударить по игроку и т.д.). Выключите для более спокойной партии.</div>';
    html += '  </div>';
    html += '  <input type="checkbox" id="set-bunker-actioncards" class="toggle-corp flex-shrink-0"' + (actionCardsOn ? ' checked' : '') + '>';
    html += '</label>';

    html += buildFutureSetting('⏱ Время на ход', '180 сек — раскрытие карт');
    html += buildFutureSetting('🗳 Время голосования', '90 сек — основное голосование');
    html += buildFutureSetting('🎯 Кол-во выживших', 'Авто (~50% игроков)');
    html += '</div>';

    html += '</div>';

    panel.innerHTML = html;
    panel.classList.toggle('settings-panel-bunker-active', !!s.bunkerMode);
    attachSettingsListeners(container);
}


// ═══════════════════════════════════════════
// Полный рендер лобби (первый вход)
// ═══════════════════════════════════════════

export function renderLobby(container) {
    console.log('[lobby] Full render');

    var isHost = state.isHost;

    var html = '';
    html += '<div class="bunker-layout">';
    html += '<div id="bunker-main-content" class="bunker-main-col">';
    html += '<div class="max-w-6xl mx-auto px-4 py-8 min-h-screen">';

    // Back
    html += '<div class="flex items-center justify-between mb-6">';
    html += '<button id="btn-back" class="flex items-center gap-2 text-corp-muted hover:text-accent-red text-sm font-bold transition-colors group cursor-pointer">';
    html += '<span class="group-hover:-translate-x-1 transition-transform">←</span>';
    html += '<span>Выйти</span>';
    html += '</button>';
    html += '<div class="flex items-center gap-2 select-none opacity-90">' + logoSvg({ size: 44 }) + '<span class="font-display font-black text-sm tracking-wide text-corp-white">ВПАРИТЬ</span></div>';
    html += '</div>';

    html += '<div class="flex flex-col lg:flex-row gap-8">';

    // LEFT
    html += '<div class="flex-1 space-y-6">';

    // Room code
    html += '<div class="corp-card p-6">';
    html += '<div id="room-name-display">' + buildRoomNameHtml() + '</div>';
    html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-2">Код комнаты</div>';
    html += '<div class="flex items-center gap-4">';
    html += '<span class="font-mono text-4xl md:text-5xl font-black text-accent-blue tracking-[0.2em]" style="text-shadow: 0 0 20px rgba(0,180,255,0.3);">';
    if (IS_CODE_HIDDEN && state.isHost) {
        html += '•••••';
    } else if (codeAnimatedFor !== state.roomCode) {
        // Первый показ кода — буквы выпадают по одной, как на табло
        var codeStr = state.roomCode || '';
        for (var ci = 0; ci < codeStr.length; ci++) {
            html += '<span class="code-char" style="animation-delay:' + (0.15 + ci * 0.08).toFixed(2) + 's">' + escapeHtml(codeStr[ci]) + '</span>';
        }
        codeAnimatedFor = state.roomCode;
    } else {
        html += escapeHtml(state.roomCode || '');
    }
    html += '</span>';
    if (state.isHost) {
        html += '<button id="btn-toggle-code" class="min-w-10 min-h-10 flex items-center justify-center rounded-lg hover:bg-corp-card transition-colors text-corp-muted hover:text-corp-light cursor-pointer" title="Скрыть/показать код">' + (IS_CODE_HIDDEN ? '🙈' : '👁') + '</button>';
    }
    html += '<button id="btn-copy" class="min-w-10 min-h-10 flex items-center justify-center rounded-lg hover:bg-corp-card transition-colors text-corp-muted hover:text-corp-light cursor-pointer" title="Скопировать">📋</button>';
    html += '</div>';
    html += '<p class="text-xs text-corp-muted mt-3">' + (IS_CODE_HIDDEN && state.isHost ? 'Код скрыт. Нажмите 👁 чтобы снова показать.' : 'Отправьте этот код инвесторам') + '</p>';
    html += '</div>';

    // Players
    html += '<div>';
    html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-3">Участники · <span id="players-count">' + (state.players || []).length + '</span></div>';
    html += '<div class="space-y-2" id="players-list"></div>';
    html += '</div>';

    // Реакции — пока ждём старта, можно пошуметь
    html += '<div class="rail-panel rail-react lobby-react">';
    html += '  <div class="rail-head"><span>Реакции</span><span class="rail-hint">клавиши 1–8</span></div>';
    html += buildReactionBarHtml();
    html += '</div>';

    // Start area
    html += '<div class="pt-4" id="start-button-area"></div>';

    html += '</div>'; // end left

    // RIGHT — settings (host only)
    if (isHost) {
        html += '<div class="lg:w-[520px] space-y-4">';
        html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-1">Приборная панель</div>';
        html += '<div class="corp-card p-4 sm:p-7 space-y-5" id="settings-panel"></div>';
        html += '</div>';
    }

    html += '</div>'; // end flex
    html += '</div>'; // end max-w-6xl
    html += '</div>'; // end bunker-main-col
    html += '</div>'; // end bunker-layout

    container.innerHTML = html;

    // Fill dynamic parts
    bindReactionButtons(container);
    updatePlayersList(container);
    updateStartButton(container);
    if (isHost) updateSettingsPanel(container);

    // Чат доступен в лобби всегда, вне зависимости от настройки «Чат в бункере»
    // (та настройка решает только, продолжит ли чат работать после старта игры)
    renderBunkerChat(container, true);

    // Static listeners
    var btnBack = container.querySelector('#btn-back');
    if (btnBack) {
        btnBack.addEventListener('click', function () {
            leaveRoom();
        });
    }

    var btnToggleCode = container.querySelector('#btn-toggle-code');
    if (btnToggleCode) {
        btnToggleCode.addEventListener('click', function () {
            IS_CODE_HIDDEN = !IS_CODE_HIDDEN;
            renderLobby(container);
        });
    }

    var btnCopy = container.querySelector('#btn-copy');
    if (btnCopy) {
        btnCopy.addEventListener('click', function () {
            if (!state.roomCode) return;
            if (IS_CODE_HIDDEN && state.isHost) {
                showNotification('Сначала покажите код комнаты', 'info');
                return;
            }
            if (navigator.clipboard) {
                navigator.clipboard.writeText(state.roomCode)
                    .then(function () { showNotification('Код скопирован: ' + state.roomCode, 'success'); })
                    .catch(function () { showNotification('Код: ' + state.roomCode, 'info'); });
            } else {
                showNotification('Код: ' + state.roomCode, 'info');
            }
        });
    }
}


// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function buildSectionDivider(title) {
    return '<div class="flex items-center gap-2 my-4">'
        + '<div class="text-[0.6rem] font-black uppercase tracking-[0.14em] text-corp-muted whitespace-nowrap">' + title + '</div>'
        + '<div class="flex-1 h-px" style="background:rgba(255,255,255,0.06)"></div>'
        + '</div>';
}

function buildRadioCard(value, cls, checked, emoji, title, sub, accent) {
    var colors = {
        blue:  { bg: 'rgba(0,180,255,0.1)',     border: 'rgba(0,180,255,0.25)',    text: '#00b4ff' },
        gold:  { bg: 'rgba(245,183,49,0.1)',    border: 'rgba(245,183,49,0.25)',   text: '#f5b731' },
        green: { bg: 'rgba(34,197,94,0.1)',     border: 'rgba(34,197,94,0.25)',    text: '#22c55e' },
        red:   { bg: 'rgba(255,59,59,0.1)',     border: 'rgba(255,59,59,0.25)',    text: '#ff3b3b' },
        muted: { bg: 'rgba(255,255,255,0.04)',  border: 'rgba(255,255,255,0.1)',   text: '#8a9ab5' }
    };
    var c = colors[accent] || colors.muted;
    var bg     = checked ? c.bg     : 'rgba(0,0,0,0.2)';
    var border = checked ? c.border : 'rgba(255,255,255,0.07)';
    var textColor = checked ? c.text : '#8a9ab5';
    return '<label class="flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer text-center transition-all" style="background:' + bg + ';border:1px solid ' + border + '">'
        + '<input type="radio" name="' + cls.replace('-radio','') + '" value="' + value + '" class="' + cls + ' sr-only"' + (checked ? ' checked' : '') + '>'
        + '<div class="text-xl">' + emoji + '</div>'
        + '<div class="text-[0.65rem] font-black uppercase tracking-wider" style="color:' + textColor + '">' + title + '</div>'
        + '<div class="text-[0.7rem] text-corp-dim leading-tight">' + sub + '</div>'
        + '</label>';
}

function buildInfoTile(emoji, title, sub) {
    return '<div class="flex flex-col items-center gap-1 p-3 rounded-xl text-center" style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.06)">'
        + '<div class="text-lg">' + emoji + '</div>'
        + '<div class="text-xs font-black text-corp-light">' + title + '</div>'
        + '<div class="text-[0.7rem] text-corp-dim">' + sub + '</div>'
        + '</div>';
}

// ═══════════════════════════════════════════
// КОЛОДА
// ═══════════════════════════════════════════

// Наборы для быстрого выбора. pseudo — без карты особенности.
var DECK_PRESETS = [
    { key: 'warmup',  emoji: '🌱', title: 'Разминка', hint: 'для новичков',
      pseudo: true,  reviews: false, audience: false, defects: false, packaging: false, modifier: 'none',     events: false, blackSwan: false },
    { key: 'classic', emoji: '⚖️', title: 'Классика', hint: '3 карты',
      pseudo: false, reviews: false, audience: false, defects: false, packaging: false, modifier: 'none',     events: false, blackSwan: false },
    { key: 'rich',    emoji: '🎭', title: 'Насыщенно', hint: '+отзыв, ЦА',
      pseudo: false, reviews: true,  audience: true,  defects: false, packaging: false, modifier: 'addition', events: true,  blackSwan: false },
    { key: 'chaos',   emoji: '🌀', title: 'Хаос',     hint: 'всё сразу',
      pseudo: false, reviews: true,  audience: true,  defects: true,  packaging: true,  modifier: 'metaphor', events: true,  blackSwan: true },
];

function presetMatches(preset, s) {
    return !!s.pseudoMode === preset.pseudo
        && !!s.useReviews === preset.reviews
        && !!s.useTargetAudience === preset.audience
        && !!s.useHiddenDefects === preset.defects
        && !!s.usePackaging === preset.packaging
        && (s.modifier || 'none') === preset.modifier
        && !!s.useEvents === preset.events
        && !!s.blackSwan === preset.blackSwan;
}

function countHandCards(s) {
    var n = 2; // прилагательное + предмет
    if (!s.pseudoMode) n++;
    if (s.modifier && s.modifier !== 'none') n++;
    if (s.useReviews) n++;
    if (s.useTargetAudience) n++;
    if (s.useHiddenDefects) n++;
    if (s.usePackaging) n++;
    return n;
}

// Живой пример: как будет выглядеть продукт с текущими настройками
function buildDeckPreview(s) {
    var product = 'ЛЕТАЮЩИЙ УТЮГ';
    if (s.modifier === 'addition') product += ' ЛЮБВИ';
    else if (s.modifier === 'metaphor') product += ' ВНЕЗАПНОГО УСПЕХА';
    if (!s.pseudoMode) product += ', КОТОРЫЙ ОТПУГИВАЕТ КОМАРОВ';

    var extras = [];
    if (s.useTargetAudience) extras.push('🎯 для трудоголиков');
    if (s.useHiddenDefects)  extras.push('⚠️ разряжается за 1 час');
    if (s.usePackaging)      extras.push('📦 в 5 слоях изоленты');
    if (s.useReviews)        extras.push('💬 «Пока ждал — успел состариться!»');

    var n = countHandCards(s);
    var html = '';
    html += '<div class="rounded-2xl p-4 mt-1" style="background:linear-gradient(135deg,rgba(255,199,44,0.09),rgba(0,180,255,0.04));border:1px solid rgba(255,199,44,0.22)">';
    html += '  <div class="flex items-center justify-between gap-3 mb-2">';
    html += '    <div class="text-[0.6rem] font-black uppercase tracking-[0.14em] text-accent-gold">Так выглядит продукт игрока</div>';
    html += '    <div class="text-[0.65rem] font-black text-corp-light whitespace-nowrap">🃏 ' + n + ' ' + pluralCards(n) + '</div>';
    html += '  </div>';
    html += '  <div class="text-base font-black text-corp-white leading-snug">' + product + '</div>';
    if (extras.length) {
        html += '  <div class="flex flex-wrap gap-1.5 mt-2.5">';
        for (var i = 0; i < extras.length; i++) {
            html += '<span class="text-[0.65rem] font-bold px-2 py-1 rounded-lg text-corp-light" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08)">' + extras[i] + '</span>';
        }
        html += '  </div>';
    }
    var surprises = [];
    if (s.useEvents) surprises.push('🎲 событие раунда');
    if (s.blackSwan) surprises.push('🦢 чёрный лебедь');
    if (surprises.length) {
        html += '  <div class="text-[0.65rem] text-corp-dim mt-2">+ ' + surprises.join(' · ') + '</div>';
    }
    if (s.cardSource === 'players') {
        html += '  <div class="text-[0.65rem] text-accent-gold/80 mt-2">🧟 Слова придумают сами игроки — это просто пример структуры.</div>';
    }
    html += '</div>';
    return html;
}

function pluralCards(n) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'карта';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'карты';
    return 'карт';
}

function buildDeckPresets(s) {
    var html = '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">';
    for (var i = 0; i < DECK_PRESETS.length; i++) {
        var p = DECK_PRESETS[i];
        var active = presetMatches(p, s);
        html += '<button type="button" class="deck-preset flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl cursor-pointer transition-all" data-preset="' + p.key + '" style="background:' + (active ? 'rgba(255,199,44,0.12)' : 'rgba(0,0,0,0.2)') + ';border:1px solid ' + (active ? 'rgba(255,199,44,0.4)' : 'rgba(255,255,255,0.07)') + '">';
        html += '  <span class="text-lg leading-none">' + p.emoji + '</span>';
        html += '  <span class="text-[0.7rem] font-black ' + (active ? 'text-accent-gold' : 'text-corp-light') + '">' + p.title + '</span>';
        html += '  <span class="text-[0.6rem] text-corp-dim">' + p.hint + '</span>';
        html += '</button>';
    }
    html += '</div>';
    return html;
}

// Прилагательное и предмет есть всегда; особенность можно убрать (режим «Псевдоинновации»)
function buildDeckBase(s) {
    var featureOn = !s.pseudoMode;
    var html = '';
    html += '<div class="rounded-xl p-3.5" style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.07)">';
    html += '  <div class="flex flex-wrap items-center gap-1.5">';
    html += '    <span class="text-xs font-black px-2.5 py-1.5 rounded-lg" style="color:#f87171;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25)">🎨 Прилагательное</span>';
    html += '    <span class="text-corp-muted text-xs font-black">+</span>';
    html += '    <span class="text-xs font-black px-2.5 py-1.5 rounded-lg" style="color:#22d3ee;background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.25)">📦 Предмет</span>';
    html += '    <span class="text-corp-muted text-xs font-black">+</span>';
    html += '    <label for="set-feature" class="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1.5 rounded-lg cursor-pointer transition-all select-none" style="' + (featureOn
        ? 'color:#c084fc;background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.35)'
        : 'color:#6b7a94;background:transparent;border:1px dashed rgba(255,255,255,0.15);text-decoration:line-through') + '">';
    html += '      <input type="checkbox" id="set-feature" class="deck-toggle" style="position:absolute;opacity:0;width:0;height:0"' + (featureOn ? ' checked' : '') + '>';
    html += '      ✨ Особенность <span class="text-[0.6rem] font-bold no-underline" style="text-decoration:none">' + (featureOn ? '✓' : 'выкл') + '</span>';
    html += '    </label>';
    html += '  </div>';
    html += '  <div class="text-[0.65rem] text-corp-dim mt-2 leading-snug">' + (featureOn
        ? 'Нажмите на «Особенность», чтобы убрать её — получится лайт-режим «Псевдоинновации», проще для первой игры.'
        : '🌱 Режим «Псевдоинновации»: только прилагательное и предмет. Нажмите, чтобы вернуть особенность.') + '</div>';
    html += '</div>';
    return html;
}

// Плитка колоды: вся карточка — переключатель, с примером карты внутри
function buildDeckTile(inputId, emoji, title, example, checked, color) {
    var on = !!checked;
    var html = '';
    html += '<label for="' + inputId + '" class="relative flex flex-col gap-1 p-3.5 rounded-xl cursor-pointer transition-all select-none" style="background:' + (on ? hexToRgba(color, 0.1) : 'rgba(0,0,0,0.2)') + ';border:1px solid ' + (on ? hexToRgba(color, 0.4) : 'rgba(255,255,255,0.07)') + '">';
    html += '  <input type="checkbox" id="' + inputId + '" class="deck-toggle" style="position:absolute;opacity:0;width:0;height:0"' + (on ? ' checked' : '') + '>';
    html += '  <div class="flex items-center justify-between">';
    html += '    <span class="text-xl leading-none' + (on ? '' : ' opacity-50') + '">' + emoji + '</span>';
    html += '    <span class="w-5 h-5 rounded-full flex items-center justify-center text-[0.65rem] font-black" style="' + (on
        ? 'background:' + color + ';color:#15151e'
        : 'border:1.5px solid rgba(255,255,255,0.18)') + '">' + (on ? '✓' : '') + '</span>';
    html += '  </div>';
    html += '  <div class="text-sm font-black mt-1" style="color:' + (on ? color : '#c5cede') + '">' + title + '</div>';
    html += '  <div class="text-[0.68rem] leading-snug ' + (on ? 'text-corp-light' : 'text-corp-dim') + '">' + example + '</div>';
    html += '</label>';
    return html;
}

function hexToRgba(hex, alpha) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function applyDeckPreset(container, key) {
    var preset = null;
    for (var i = 0; i < DECK_PRESETS.length; i++) if (DECK_PRESETS[i].key === key) preset = DECK_PRESETS[i];
    if (!preset) return;
    var set = function (id, value) { var el = container.querySelector('#' + id); if (el) el.checked = value; };
    // В «Бункере» нужны все карты — лайт-режим там не включаем
    var bunkerOn = !!(state.settings && state.settings.bunkerMode);
    set('set-feature', bunkerOn ? true : !preset.pseudo);
    set('set-reviews', preset.reviews);
    set('set-target-audience', preset.audience);
    set('set-hidden-defects', preset.defects);
    set('set-packaging', preset.packaging);
    set('set-events', preset.events);
    set('set-blackswan', preset.blackSwan);
    var mod = container.querySelector('input[name="modifier"][value="' + preset.modifier + '"]');
    if (mod) mod.checked = true;
    // Модификатор и чёрный лебедь не работают с генератором абсурда
    if (preset.modifier !== 'none' || preset.blackSwan) {
        var db = container.querySelector('input[name="card-source"][value="database"]');
        if (db) db.checked = true;
    }
    pushSettings(container);
}

function buildFutureSetting(label, sub) {
    return '<div class="flex items-center justify-between py-2.5 px-3.5 rounded-xl opacity-40 select-none" style="background:rgba(0,0,0,0.15);border:1px dashed rgba(255,255,255,0.08)">'
        + '<div>'
        + '<div class="text-xs font-bold text-corp-light">' + label + '</div>'
        + '<div class="text-[0.6rem] text-corp-dim">' + sub + '</div>'
        + '</div>'
        + '<div class="text-[0.65rem] font-bold uppercase tracking-wider text-corp-muted">скоро</div>'
        + '</div>';
}

function buildSetting(label, stepName, inputId, min, max, value, step) {
    var html = '';
    html += '<div class="flex items-center justify-between py-2.5 px-3.5 rounded-xl" style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.06)">';
    html += '<div class="text-sm font-bold text-corp-light">' + label + '</div>';
    html += '<div class="flex items-center gap-1.5">';
    html += '<button class="stepper-btn cursor-pointer" data-step="' + stepName + '" data-dir="-' + step + '">−</button>';
    html += '<input type="number" id="' + inputId + '" class="stepper-input" min="' + min + '" max="' + max + '" value="' + value + '" step="' + step + '">';
    html += '<button class="stepper-btn cursor-pointer" data-step="' + stepName + '" data-dir="' + step + '">+</button>';
    html += '</div>';
    html += '</div>';
    return html;
}

function buildToggle(label, hint, inputId, checked, locked) {
    var html = '';
    var bg = checked ? 'rgba(0,180,255,0.06)' : 'rgba(0,0,0,0.15)';
    var border = checked ? 'rgba(0,180,255,0.15)' : 'rgba(255,255,255,0.06)';
    if (locked) {
        html += '<div class="feature-locked flex items-center justify-between py-2.5 px-3.5 rounded-xl opacity-40" style="background:' + bg + ';border:1px solid ' + border + '">';
        html += '<div class="flex-1 mr-3">';
        html += '<div class="text-sm font-bold text-corp-light">' + label + '</div>';
        if (hint) html += '<div class="text-[0.6rem] text-corp-dim mt-0.5">' + hint + '</div>';
        html += '</div>';
        html += '<input type="checkbox" id="' + inputId + '" class="toggle-corp flex-shrink-0"';
        if (checked) html += ' checked';
        html += ' disabled>';
        html += '</div>';
        return html;
    }
    html += '<label for="' + inputId + '" class="flex items-center justify-between py-2.5 px-3.5 rounded-xl cursor-pointer transition-all" style="background:' + bg + ';border:1px solid ' + border + '">';
    html += '<div class="flex-1 mr-3">';
    html += '<div class="text-sm font-bold text-corp-light">' + label + '</div>';
    if (hint) html += '<div class="text-[0.6rem] text-corp-dim mt-0.5">' + hint + '</div>';
    html += '</div>';
    html += '<input type="checkbox" id="' + inputId + '" class="toggle-corp flex-shrink-0"';
    if (checked) html += ' checked';
    html += '>';
    html += '</label>';
    return html;
}

function attachSettingsListeners(container) {
    var tabParams = container.querySelector('#settings-tab-params');
    if (tabParams) {
        tabParams.addEventListener('click', function () {
            SETTINGS_TAB = 'params';
            updateSettingsPanel(container);
        });
    }
    var tabModes = container.querySelector('#settings-tab-modes');
    if (tabModes) {
        tabModes.addEventListener('click', function () {
            SETTINGS_TAB = 'modes';
            updateSettingsPanel(container);
        });
    }
    var tabBunker = container.querySelector('#settings-tab-bunker');
    if (tabBunker) {
        tabBunker.addEventListener('click', function () {
            SETTINGS_TAB = 'bunker';
            updateSettingsPanel(container);
        });
    }

    // Steppers
    var stepBtns = container.querySelectorAll('.stepper-btn');
    for (var j = 0; j < stepBtns.length; j++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var field = btn.getAttribute('data-step');
                var dir = parseInt(btn.getAttribute('data-dir'));
                handleStep(field, dir, container);
            });
        })(stepBtns[j]);
    }

    // Inputs
    var inputs = container.querySelectorAll('.stepper-input, .toggle-corp, .deck-toggle');
    for (var k = 0; k < inputs.length; k++) {
        (function (inp) {
            inp.addEventListener('change', function () {
                pushSettings(container);
            });
        })(inputs[k]);
    }

    // Card source radios
    var radios = container.querySelectorAll('.card-source-radio');
    for (var r = 0; r < radios.length; r++) {
        (function (radio) {
            radio.addEventListener('change', function () {
                pushSettings(container);
            });
        })(radios[r]);
    }

    // Взаимоисключение: blackSwan <-> players source
    var blackSwanToggle = container.querySelector('#set-blackswan');
    var sourceRadios = container.querySelectorAll('.card-source-radio');

    if (blackSwanToggle) {
        blackSwanToggle.addEventListener('change', function () {
            if (blackSwanToggle.checked) {
                // Выключаем "Генератор абсурда"
                var dbRadio = container.querySelector('input[name="card-source"][value="database"]');
                if (dbRadio) {
                    dbRadio.checked = true;
                }
            }
            pushSettings(container);
        });
    }

    var streamerToggle = container.querySelector('#set-streamer');
    var anonToggle = container.querySelector('#set-anon');
    if (streamerToggle && anonToggle) {
        streamerToggle.addEventListener('change', function () {
            if (!streamerToggle.checked) {
                anonToggle.checked = false;
            }
            pushSettings(container);
        });
    }

    for (var r = 0; r < sourceRadios.length; r++) {
        (function (radio) {
            radio.addEventListener('change', function () {
                if (radio.value === 'players' && radio.checked) {
                    // Выключаем Чёрный лебедь
                    var bsToggle = container.querySelector('#set-blackswan');
                    if (bsToggle) bsToggle.checked = false;
                    // Выключаем модификатор
                    var noneRadio = container.querySelector('input[name="modifier"][value="none"]');
                    if (noneRadio) noneRadio.checked = true;
                }
                pushSettings(container);
            });
        })(sourceRadios[r]);
    }

    // Быстрые наборы колоды
    var presetBtns = container.querySelectorAll('.deck-preset');
    for (var pb = 0; pb < presetBtns.length; pb++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                applyDeckPreset(container, btn.getAttribute('data-preset'));
            });
        })(presetBtns[pb]);
    }

    // Вопросы после питча
    var questionRadios = container.querySelectorAll('.questions-radio');
    for (var qr = 0; qr < questionRadios.length; qr++) {
        questionRadios[qr].addEventListener('change', function () {
            pushSettings(container);
        });
    }

    // Modifier radios
    var modRadios = container.querySelectorAll('.modifier-radio');
    for (var m = 0; m < modRadios.length; m++) {
        (function (radio) {
            radio.addEventListener('change', function () {
                if (radio.value !== 'none' && radio.checked) {
                    // Модификаторы несовместимы с генератором абсурда
                    var dbRadio = container.querySelector('input[name="card-source"][value="database"]');
                    if (dbRadio) dbRadio.checked = true;
                }
                pushSettings(container);
            });
        })(modRadios[m]);
    }

    // Бункер — при включении отключаем несовместимые опции
    var bunkerToggle = container.querySelector('#set-bunker');
    if (bunkerToggle) {
        bunkerToggle.addEventListener('change', function () {
            if (bunkerToggle.checked) {
                // Бункер включает ВСЕ карты принудительно, отключаем генератор абсурда
                var dbRadio = container.querySelector('input[name="card-source"][value="database"]');
                if (dbRadio) dbRadio.checked = true;

                // Отключаем псевдоинновации (нужны все 9 карт)
                var featureToggle = container.querySelector('#set-feature');
                if (featureToggle) featureToggle.checked = true;
            }
            pushSettings(container);
        });
    }

    // Название и пароль комнаты — только по кнопке «Применить» или Enter.
    // Раньше отправлялось автоматически при вводе (с задержкой), но обновление настроек
    // от сервера перерисовывает всю панель и сбрасывает фокус с поля — печатать было невозможно.
    bindApplyField(container, 'set-room-name', 'btn-apply-room-name', 'Название комнаты сохранено');
    bindApplyField(container, 'set-room-password', 'btn-apply-room-password', 'Пароль сохранён');
}

function bindApplyField(container, inputId, btnId, savedMessage) {
    var input = container.querySelector('#' + inputId);
    var btn = container.querySelector('#' + btnId);
    if (!input || !btn) return;

    function apply() {
        pushSettings(container);
        showNotification(savedMessage, 'success');
    }

    btn.addEventListener('click', apply);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); apply(); }
    });
}

function handleStep(field, dir, container) {
    var map = { rounds: 'set-rounds', capital: 'set-capital', prep: 'set-prep', present: 'set-present', invest: 'set-invest', maxPlayers: 'set-max-players' };
    var input = container.querySelector('#' + map[field]);
    if (!input) return;

    var val = parseInt(input.value) || 0;
    val += dir;
    val = Math.max(parseInt(input.min) || 1, Math.min(parseInt(input.max) || 999, val));
    input.value = val;
    pushSettings(container);
}

function pushSettings(container) {
    var cardSourceEl = container.querySelector('input[name="card-source"]:checked');
    var modifierEl = container.querySelector('input[name="modifier"]:checked');
    var questionsEl = container.querySelector('input[name="questions"]:checked');

    var rawMaxPlayers = parseInt(container.querySelector('#set-max-players')?.value);
    var fallbackMaxPlayers = parseInt(state.settings && state.settings.maxPlayers) || 8;
    var safeMaxPlayers = rawMaxPlayers;
    if (isNaN(safeMaxPlayers)) safeMaxPlayers = fallbackMaxPlayers;
    safeMaxPlayers = Math.max(MAX_PLAYERS_MIN, Math.min(MAX_PLAYERS_MAX, safeMaxPlayers));

    var settings = {
        maxPlayers: safeMaxPlayers,
        rounds: parseInt(container.querySelector('#set-rounds')?.value) || 3,
        startCapital: parseInt(container.querySelector('#set-capital')?.value) || 10,
        useReviews: container.querySelector('#set-reviews')?.checked || false,
        useTargetAudience: container.querySelector('#set-target-audience')?.checked || false,
        useHiddenDefects: container.querySelector('#set-hidden-defects')?.checked || false,
        usePackaging: container.querySelector('#set-packaging')?.checked || false,
        useEvents: container.querySelector('#set-events')?.checked || false,
        useSpeech: container.querySelector('#set-speech')?.checked || false,
        streamerMode: container.querySelector('#set-streamer')?.checked || false,
        anonymizeParticipants: container.querySelector('#set-anon')?.checked || false,
        prepTime: parseInt(container.querySelector('#set-prep')?.value) || 60,
        presentTime: parseInt(container.querySelector('#set-present')?.value) || 120,
        investTime: parseInt(container.querySelector('#set-invest')?.value) || 60,
        questionsTime: questionsEl ? parseInt(questionsEl.value, 10) : 0,
        hostObserves: container.querySelector('#set-host-observes')?.checked || false,
        cardSource: cardSourceEl ? cardSourceEl.value : 'database',
        blackSwan: container.querySelector('#set-blackswan')?.checked || false,
        modifier: modifierEl ? modifierEl.value : 'none',
        // Псевдоинновации = карта особенности выключена
        pseudoMode: container.querySelector('#set-feature') ? !container.querySelector('#set-feature').checked : !!(state.settings && state.settings.pseudoMode),
        bunkerMode: container.querySelector('#set-bunker')?.checked || false,
        bunkerHostMode: container.querySelector('#set-bunker-hostmode')?.checked || false,
        bunkerChat: container.querySelector('#set-bunker-chat') ? container.querySelector('#set-bunker-chat').checked : true,
        bunkerActionCards: container.querySelector('#set-bunker-actioncards') ? container.querySelector('#set-bunker-actioncards').checked : true,
        chatTTS: container.querySelector('#set-chat-tts')?.checked || false,
        roomPrivate: container.querySelector('#set-room-open') ? !container.querySelector('#set-room-open').checked : false,
        roomPassword: container.querySelector('#set-room-password')?.value || '',
        roomName: container.querySelector('#set-room-name')?.value || '',
    };
    console.log('[lobby] Pushing settings:', settings);
    sendMsg({ type: 'updateSettings', settings: settings });
}