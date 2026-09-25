import { state, escapeHtml } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';
import { renderBunkerChat } from '../components/bunker-chat.js';
import { renderBunkerLegend } from '../components/bunker-legend.js';
import { showNotification } from '../components/notification.js';
import { playSound } from '../components/sound.js';
import { audienceResultHtml } from '../components/audience.js';

// ═══════════════════════════════════════════
// Конфиг карт для бункера (все 9)
// ═══════════════════════════════════════════
var BUNKER_CARD_TYPES = [
    { key: 'adjective', label: 'Прилагательное', emoji: '🎨', gradient: 'card-adjective-gradient', color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-800/30' },
    { key: 'item', label: 'Предмет', emoji: '📦', gradient: 'card-item-gradient', color: 'text-cyan-400', bg: 'bg-cyan-900/30', border: 'border-cyan-800/30' },
    { key: 'modifier', label: 'Модификатор', emoji: '📜', gradient: 'card-modifier-gradient', color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-800/30' },
    { key: 'feature', label: 'Особенность', emoji: '✨', gradient: 'card-feature-gradient', color: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-800/30' },
    { key: 'gift', label: 'Бонус к продукту', emoji: '🎁', gradient: 'card-gift-gradient', color: 'text-pink-400', bg: 'bg-pink-900/30', border: 'border-pink-800/30' },
    { key: 'hiddenDefect', label: 'Скрытый дефект', emoji: '⚠️', gradient: 'card-defect-gradient', color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-800/30' },
    { key: 'packaging', label: 'Упаковка', emoji: '📦', gradient: 'card-packaging-gradient', color: 'text-teal-400', bg: 'bg-teal-900/30', border: 'border-teal-800/30' },
    { key: 'review', label: 'Первый отзыв', emoji: '💬', gradient: 'card-review-gradient', color: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-800/30' },
    { key: 'historicalFact', label: 'Исторический факт', emoji: '📜', gradient: 'card-history-gradient', color: 'text-yellow-300', bg: 'bg-yellow-900/20', border: 'border-yellow-700/30' },
];

export { BUNKER_CARD_TYPES };

// Хранение последней раскрытой карты для анимации
var pendingReveal = null;
// Катастрофа развёрнута, пока игрок сам её не свернёт
var problemOpen = true;
var problemFull = false; // на телефоне текст катастрофы обрезан до 5 строк, пока его не развернут

// Цвет каждого типа карты — для досье и сцены
var BK_COLORS = {
    adjective: '#f87171', item: '#22d3ee', modifier: '#34d399', feature: '#c084fc', gift: '#f472b6',
    hiddenDefect: '#fb923c', packaging: '#2dd4bf', review: '#fbbf24', historicalFact: '#facc15',
};
export function bkColor(key) { return BK_COLORS[key] || '#ffc72c'; }
function cardType(key) {
    for (var i = 0; i < BUNKER_CARD_TYPES.length; i++) if (BUNKER_CARD_TYPES[i].key === key) return BUNKER_CARD_TYPES[i];
    return null;
}
function avatarHue(id) {
    var h = 0, str = String(id || '');
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
}

// Карта досье. Состояния: open — видят все, hidden — видите только вы,
// can — можно открыть сейчас, locked — сначала нужно открыть предмет
function bkCardHtml(ct, value, cardState) {
    var badge = { open: '👁 все видят', hidden: '🔒 только вы', can: '✨ открыть', locked: '⏳' }[cardState];
    var cls = 'bk-card bk-card-' + cardState + (cardState === 'can' ? ' bunker-reveal-btn' : '');
    var html = '<div class="' + cls + '" style="--bk:' + bkColor(ct.key) + '" data-my-slot="' + ct.key + '"' + (cardState === 'can' ? ' data-card-key="' + ct.key + '"' : '') + '>';
    html += '<div class="bk-card-top"><span>' + ct.emoji + ' ' + ct.label + '</span><span class="bk-card-badge">' + badge + '</span></div>';
    html += '<div class="bk-card-value">' + escapeHtml(value) + '</div>';
    if (cardState === 'can') html += '<div class="bk-card-cta">Открыть всем →</div>';
    if (cardState === 'locked') html += '<div class="bk-card-cta bk-card-cta-muted">сначала предмет</div>';
    html += '</div>';
    return html;
}

export function setPendingReveal(data) {
    pendingReveal = data;
}

// ═══════════════════════════════════════════
// ЭКРАН: Раскрытие карт (bunkerReveal)
// ═══════════════════════════════════════════

export function renderBunkerReveal(container) {
    var bunker = state.bunker || {};
    var isHost = state.isHost;
    var myId = state.playerId;
    var isSpectator = state.isSpectator || false;
    var currentPlayerId = bunker.currentPlayerId;
    var isMyTurn = !isSpectator && currentPlayerId === myId;
    var myCards = state.myCards || {};
    var revealedCards = bunker.revealedCards || {};
    var eliminatedPlayers = bunker.eliminatedPlayers || [];
    var players = state.players || [];
    var revealOrder = bunker.revealOrder || [];
    var myRevealed = revealedCards[myId] || {};

    var html = '';
    html += '<div class="bunker-layout">';
    html += '<div id="bunker-main-content" class="bunker-main-col">';

    // Баннер зрителя
    if (isSpectator) {
        html += '<div class="mb-2 px-3 py-2 rounded-xl bg-corp-graphite border border-accent-gold/25 text-center text-xs text-accent-gold font-bold">👀 Режим зрителя — вы наблюдаете за игрой</div>';
    }

    // ═══════ ШАПКА: раунд · очередь ходов · места в бункере ═══════
    var activeIds = revealOrder.map(function (r) { return typeof r === 'object' ? r.id : r; })
        .filter(function (id) { return eliminatedPlayers.indexOf(id) === -1; });
    var turnIdx = bunker.currentTurnIndex || 0;
    var seats = bunker.survivorsCount || 0;
    var toKick = Math.max(0, activeIds.length - seats);
    html += '<div class="bk-hud">';
    html += '  <div class="bk-hud-round"><span>Раунд</span><b>' + (bunker.currentRound || 1) + '</b></div>';
    html += '  <div class="bk-hud-mid">';
    html += '    <div class="bk-hud-turns">';
    for (var ti = 0; ti < activeIds.length; ti++) {
        html += '<span class="bk-turn-dot' + (ti < turnIdx ? ' bk-turn-done' : ti === turnIdx ? ' bk-turn-now' : '') + '"></span>';
    }
    html += '    </div>';
    html += '    <div class="bk-hud-line"><span>Ход ' + (turnIdx + 1) + ' из ' + (bunker.totalTurns || activeIds.length || '?') + '</span>';
    html += bunker.hostMode ? '<span class="text-accent-gold">🎙 ведущий управляет</span>' : '<span data-timer-text class="font-mono text-corp-light"></span>';
    html += '    </div>';
    if (!bunker.hostMode) html += '    <div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
    html += '  </div>';
    html += '  <div class="bk-hud-seats">';
    html += '    <span>Мест в бункере</span><b>🛏 ' + (seats || '?') + '</b>';
    html += '    <small>' + (toKick > 0 ? 'выгнать ещё ' + toKick : 'места хватает всем') + '</small>';
    html += '  </div>';
    html += '  <button id="btn-exit-bunker" class="bk-hud-exit" title="Выйти в меню">✕</button>';
    html += '</div>';

    // ═══════ КАТАСТРОФА — развёрнута, пока игрок сам её не свернёт ═══════
    html += '<div class="bk-disaster">';
    html += '  <button id="btn-toggle-problem" class="bk-disaster-head">';
    html += '    <span class="bk-disaster-icon">☢️</span>';
    html += '    <span class="bk-disaster-label">Катастрофа</span>';
    html += '    <span class="bk-disaster-hint">как ваш стартап спасёт от неё мир?</span>';
    html += '    <span id="problem-arrow" class="bk-disaster-arrow"' + (problemOpen ? ' style="transform:rotate(180deg)"' : '') + '>▼</span>';
    html += '  </button>';
    html += '  <div id="problem-body" class="bk-disaster-body' + (problemOpen ? '' : ' hidden') + (problemFull ? ' bk-disaster-full' : '') + '">';
    html += '    <div class="bk-disaster-text">' + escapeHtml(bunker.globalProblem || '') + '</div>';
    html += '    <button id="btn-problem-more" class="bk-disaster-more">читать полностью ▾</button>';
    html += '  </div>';
    html += '</div>';

    // ═══════ СЦЕНА: кто ходит и какую карту он только что открыл ═══════
    var currentPlayer = null;
    for (var pi = 0; pi < players.length; pi++) {
        if (players[pi].id === currentPlayerId) { currentPlayer = players[pi]; break; }
    }

    if (currentPlayer) {
        var hue = avatarHue(currentPlayer.id);
        var lastReveal = bunker.lastReveal && bunker.lastReveal.playerId === currentPlayerId ? bunker.lastReveal : null;
        html += '<div class="bk-stage' + (isMyTurn ? ' bk-stage-me' : '') + '">';
        html += '  <div class="bk-stage-who">';
        html += '    <span class="bk-stage-avatar" style="background:linear-gradient(135deg,hsl(' + hue + ',55%,32%),hsl(' + ((hue + 40) % 360) + ',55%,22%));color:hsl(' + hue + ',85%,82%)">' + escapeHtml((currentPlayer.nickname || '?').trim().charAt(0).toUpperCase()) + '</span>';
        html += '    <div class="text-left"><div class="bk-stage-label">' + (isMyTurn ? 'Сейчас ходите вы' : 'Сейчас ходит') + '</div><div class="bk-stage-name">' + escapeHtml(currentPlayer.nickname) + '</div></div>';
        if (isMyTurn) html += '    <span class="bk-your-turn"><span class="w-2 h-2 rounded-full bg-white/80 animate-ping"></span>ВЫ В ЭФИРЕ</span>';
        html += '  </div>';

        if (lastReveal) {
            var lrt = cardType(lastReveal.cardKey);
            html += '<div class="bk-stage-reveal" style="--bk:' + bkColor(lastReveal.cardKey) + '">';
            html += '  <div class="bk-stage-reveal-label">' + (isMyTurn ? 'Вы открыли' : 'Только что открыл') + ' · ' + (lrt ? lrt.emoji + ' ' + lrt.label : '') + '</div>';
            html += '  <div class="bk-stage-reveal-value">' + escapeHtml(lastReveal.cardValue || '') + '</div>';
            html += '  <div class="bk-stage-reveal-hint">' + (isMyTurn ? 'Объясните всем, почему это спасёт мир' : 'Слушаем, как это спасёт мир') + '</div>';
            html += '</div>';
        } else {
            html += '<div class="bk-stage-wait">' + (isMyTurn ? '⬇ Откройте одну карту из своего досье' : '⏳ Выбирает, какую карту открыть…') + '</div>';
        }

        // Кнопки — «Закончил» только после раскрытия карты
        html += '<div class="flex items-center justify-center gap-3 mt-4 flex-wrap">';
        if (isMyTurn && bunker.hasRevealedThisTurn) {
            html += '<button id="btn-bunker-finish" class="btn-neon-solid px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer">✓ Закончил объяснение</button>';
        }
        if (isHost && bunker.hostMode) {
            var allDone = bunker.currentTurnIndex >= (bunker.totalTurns || 0) - 1;
            html += '<button id="btn-bunker-host-advance" class="btn-neon-solid px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer">' + (allDone ? '🗳 Начать голосование' : '⏭ Следующий игрок') + '</button>';
        } else if (isHost && !isMyTurn) {
            html += '<button id="btn-bunker-skip-turn" class="btn-neon px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">⏭ Следующий</button>';
        }
        html += '</div>';
        html += '</div>';
    }

    // ═══════ МОИ КАРТЫ — скрыты для зрителей ═══════
    if (isSpectator) { html += '<div class="mb-3 text-center text-xs text-corp-muted py-3 rounded-xl bg-corp-surface/30 border border-corp-border">👀 У зрителя нет карт</div>'; }
    var itemAlreadyRevealed = !!myRevealed['item'];
    if (!isSpectator) {

    var openedCount = 0;
    for (var oc = 0; oc < BUNKER_CARD_TYPES.length; oc++) if (myRevealed[BUNKER_CARD_TYPES[oc].key]) openedCount++;
    var canPickNow = isMyTurn && !bunker.hasRevealedThisTurn;

    html += '<div class="bk-dossier">';
    html += '  <div class="bk-dossier-head">';
    html += '    <div class="bk-dossier-title">🃏 Ваше досье <span>открыто ' + openedCount + ' из ' + BUNKER_CARD_TYPES.length + '</span></div>';
    html += '    <div class="bk-dossier-legend"><span>🔒 видите только вы</span><span>👁 видят все</span></div>';
    html += '  </div>';
    if (!itemAlreadyRevealed && canPickNow) {
        html += '  <div class="bk-dossier-tip">📦 Первым откройте предмет — это основа вашего продукта</div>';
    }
    html += '  <div class="bk-cards">';
    for (var ci = 0; ci < BUNKER_CARD_TYPES.length; ci++) {
        var ct = BUNKER_CARD_TYPES[ci];
        var cardValue = myCards[ct.key] || '???';
        var cardState = myRevealed[ct.key] ? 'open'
            : (canPickNow ? ((ct.key === 'item' || itemAlreadyRevealed) ? 'can' : 'locked') : 'hidden');
        html += bkCardHtml(ct, cardValue, cardState);
    }
    html += '  </div>';

    // ═══════ ДОПОЛНИТЕЛЬНЫЕ КАРТЫ (от «Двойной порции» и др.) ═══════
    var myExtraCards = state.myExtraCards || {};
    var extraKeys = Object.keys(myExtraCards).filter(function(k) { return myExtraCards[k]; });
    if (extraKeys.length > 0) {
        html += '  <div class="mt-2 pt-2 border-t border-accent-gold/10">';
        html += '    <div class="text-xs font-bold text-accent-gold uppercase tracking-widest mb-1.5">🍕 Дополнительные карты</div>';
        html += '    <div class="flex gap-2 flex-wrap">';
        for (var eki = 0; eki < extraKeys.length; eki++) {
            var ek = extraKeys[eki];
            var ect = null;
            for (var ecti = 0; ecti < BUNKER_CARD_TYPES.length; ecti++) {
                if (BUNKER_CARD_TYPES[ecti].key === ek) { ect = BUNKER_CARD_TYPES[ecti]; break; }
            }
            if (!ect) continue;
            html += '<div class="rounded-xl p-2.5 ' + ect.bg + ' ' + ect.border + ' border text-center min-w-[110px] ring-1 ring-accent-gold/30" data-my-extra="' + ek + '">';
            html += '  <div class="text-[0.55rem] font-bold text-accent-gold uppercase tracking-widest mb-1">+1 ' + ect.emoji + ' ' + ect.label + '</div>';
            html += '  <div class="text-[0.65rem] font-bold ' + ect.color + ' leading-snug">' + escapeHtml(myExtraCards[ek]) + '</div>';
            html += '</div>';
        }
        html += '    </div>';
        html += '  </div>';
    }

    html += '</div>';
    } // end if (!isSpectator) for player cards section

    // Участники — в колонке слева (components/players-rail.js). Сетка внизу
    // остаётся только на узких экранах, где колонка превращается в ленту.
    html += '<div class="rail-fallback-grid">';
    html += renderPlayersGrid(players, revealedCards, eliminatedPlayers, myId, myCards, revealOrder, currentPlayerId);
    html += '</div>';

    // ═══════ КАРТЫ ДЕЙСТВИЯ ═══════
    var actionCards = isSpectator ? [] : (state.myActionCards || []);
    if (actionCards.length > 0) {
        html += renderActionHand(actionCards, 'reveal');
    }

    html += '</div>'; // end bunker-main-col
    html += '</div>'; // end bunker-layout

    // ═══════ МОДАЛЬНОЕ ОКНО для раскрытия (скрыто) ═══════
    html += renderRevealModal();

    // ═══════ МОДАЛЬНОЕ ОКНО для карты действия (скрыто) ═══════
    html += renderActionCardModal();

    container.innerHTML = html;

    // Рендерим чат и памятку по картам после установки innerHTML
    renderBunkerChat(container);
    renderBunkerLegend(container);

    // ═══════ LISTENERS ═══════

    // Кнопка выхода
    var btnExitBunker = container.querySelector('#btn-exit-bunker');
    if (btnExitBunker) {
        btnExitBunker.addEventListener('click', function () {
            if (window.confirm('Выйти из игры в главное меню?')) leaveRoom();
        });
    }

    // Сворачивание проблемы
    var btnProblem = container.querySelector('#btn-toggle-problem');
    if (btnProblem) {
        btnProblem.addEventListener('click', function () {
            var body = container.querySelector('#problem-body');
            var arrow = container.querySelector('#problem-arrow');
            if (body) {
                body.classList.toggle('hidden');
                problemOpen = !body.classList.contains('hidden');
                if (arrow) arrow.style.transform = problemOpen ? 'rotate(180deg)' : '';
            }
        });
    }
    var btnMore = container.querySelector('#btn-problem-more');
    if (btnMore) {
        btnMore.addEventListener('click', function () {
            problemFull = true;
            var body = container.querySelector('#problem-body');
            if (body) body.classList.add('bk-disaster-full');
        });
    }

    // Раскрытие карты (только в свой ход)
    var revealBtns = container.querySelectorAll('.bunker-reveal-btn');
    for (var ri = 0; ri < revealBtns.length; ri++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var cardKey = btn.getAttribute('data-card-key');
                sendMsg({ type: 'bunkerReveal', cardKey: cardKey });
                // Небольшой «нажим» именно на ту карточку, которую выбрали
                btn.classList.add('bunker-reveal-btn-pressed');
                // Визуально блокируем все кнопки
                var allBtns = container.querySelectorAll('.bunker-reveal-btn');
                for (var ab = 0; ab < allBtns.length; ab++) {
                    allBtns[ab].classList.add('opacity-30', 'pointer-events-none');
                }
                playSound('start');
            });
        })(revealBtns[ri]);
    }

    // Закончил объяснение
    var btnFinish = container.querySelector('#btn-bunker-finish');
    if (btnFinish) {
        btnFinish.addEventListener('click', function () {
            sendMsg({ type: 'bunkerFinishTurn' });
            btnFinish.disabled = true;
            btnFinish.classList.add('opacity-50');
        });
    }

    // Хост (режим ведущего): продвинуть фазу
    var btnHostAdvance = container.querySelector('#btn-bunker-host-advance');
    if (btnHostAdvance) {
        btnHostAdvance.addEventListener('click', function () {
            btnHostAdvance.disabled = true;
            sendMsg({ type: 'bunkerHostAdvance' });
        });
    }

    // Хост: пропустить ход (обычный режим)
    var btnSkip = container.querySelector('#btn-bunker-skip-turn');
    if (btnSkip) {
        btnSkip.addEventListener('click', function () {
            sendMsg({ type: 'bunkerFinishTurn' });
        });
    }

    // Клик по мини-карте игрока — открыть все раскрытые в попапе
    var playerMiniCards = container.querySelectorAll('[data-player-detail]');
    for (var pmi = 0; pmi < playerMiniCards.length; pmi++) {
        (function (el) {
            el.addEventListener('click', function () {
                var pid = el.getAttribute('data-player-detail');
                showPlayerDetailModal(container, pid, players, revealedCards, myId, myCards);
            });
        })(playerMiniCards[pmi]);
    }

    // Ведущий: исключить игрока из бункера прямо во время игры
    var bunkerKickBtns = container.querySelectorAll('.bunker-kick-btn');
    for (var bki = 0; bki < bunkerKickBtns.length; bki++) {
        (function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var targetId = btn.getAttribute('data-bunker-kick');
                var targetName = btn.getAttribute('data-bunker-kick-name') || 'игрока';
                if (!targetId) return;
                if (!window.confirm('Исключить «' + targetName + '» из бункера? Это действие необратимо для текущей игры.')) return;
                sendMsg({ type: 'bunkerHostKick', targetPlayerId: targetId });
            });
        })(bunkerKickBtns[bki]);
    }

    // Если есть pending reveal — показываем модалку. Ждём макротаск + два кадра,
    // чтобы тяжёлая перерисовка экрана (которая только что произошла) успела
    // отрисоваться, и анимация карточки не «спотыкалась» на первых кадрах.
    if (pendingReveal) {
        var revealToShow = pendingReveal;
        pendingReveal = null;
        setTimeout(function () {
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    showRevealModal(container, revealToShow);
                });
            });
        }, 100);
    }

    // ═══════ LISTENERS — карты действия ═══════
    var actionBtns = container.querySelectorAll('.bunker-action-card-btn');
    for (var acbi = 0; acbi < actionBtns.length; acbi++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var cardId = btn.getAttribute('data-action-id');
                var cardType = btn.getAttribute('data-action-type');
                var needsTarget = btn.getAttribute('data-needs-target') === 'true';
                var needsCardKey = btn.getAttribute('data-needs-card-key') === 'true';
                var cardName = btn.getAttribute('data-action-name');
                var cardEmoji = btn.getAttribute('data-action-emoji');
                var cardDesc = btn.getAttribute('data-action-desc');

                openActionCardFlow(container, {
                    cardId: cardId, cardType: cardType,
                    needsTarget: needsTarget, needsCardKey: needsCardKey,
                    name: cardName, emoji: cardEmoji, desc: cardDesc
                });
            });
        })(actionBtns[acbi]);
    }

    // ═══════ HIGHLIGHT — изменённые карты после разыгранной карты действия ═══════
    if (window._bunkerHighlightSlots && window._bunkerHighlightSlots.length) {
        var slots = window._bunkerHighlightSlots;
        window._bunkerHighlightSlots = null;
        setTimeout(function () {
            for (var si = 0; si < slots.length; si++) {
                var el = container.querySelector('[data-my-slot="' + slots[si] + '"]');
                if (el) {
                    el.classList.add('card-flash');
                    (function (e) {
                        setTimeout(function () { e.classList.remove('card-flash'); }, 2400);
                    })(el);
                }
            }
        }, 60);
    }
    if (window._bunkerHighlightExtra) {
        var extraKey = window._bunkerHighlightExtra;
        window._bunkerHighlightExtra = null;
        setTimeout(function () {
            var el = container.querySelector('[data-my-extra="' + extraKey + '"]');
            if (el) {
                el.classList.add('card-flash');
                setTimeout(function () { el.classList.remove('card-flash'); }, 2400);
            }
        }, 60);
    }
}

// ═══════════════════════════════════════════
// РУКА — карты действия (reveal фаза)
// ═══════════════════════════════════════════

// currentPhase: 'reveal' | 'vote' — determines which cards are greyed out
function renderActionHand(cards, currentPhase) {
    var html = '';
    html += '<div id="bunker-action-hand" class="mt-4 mb-2">';
    html += '  <h3 class="text-xs font-bold text-accent-gold uppercase tracking-widest mb-3">⚡ Карты действия</h3>';
    html += '  <div class="flex gap-3 flex-wrap">';

    for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var isActive = !currentPhase || c.phase === currentPhase || c.phase === 'any';
        if (isActive) {
            html += '<div class="bunker-action-card bunker-action-card-btn flex-1 min-w-[160px] max-w-[240px] p-4"';
            html += '  data-action-id="' + escapeHtml(c.id) + '"';
            html += '  data-action-type="' + escapeHtml(c.type) + '"';
            html += '  data-needs-target="' + (c.needsTarget ? 'true' : 'false') + '"';
            html += '  data-needs-card-key="' + (c.needsCardKey ? 'true' : 'false') + '"';
            html += '  data-action-name="' + escapeHtml(c.name) + '"';
            html += '  data-action-emoji="' + escapeHtml(c.emoji) + '"';
            html += '  data-action-desc="' + escapeHtml(c.desc) + '"';
            html += '>';
            html += '  <div class="bunker-action-card-corner">⚡</div>';
            html += '  <div class="text-3xl mb-2.5 relative z-10">' + escapeHtml(c.emoji) + '</div>';
            html += '  <div class="text-xs font-black uppercase tracking-wider mb-2 relative z-10" style="color:#f5d060">' + escapeHtml(c.name) + '</div>';
            html += '  <div class="text-[0.7rem] leading-relaxed relative z-10" style="color:rgba(230,210,150,0.9)">' + escapeHtml(c.desc) + '</div>';
            html += '</div>';
        } else {
            var phaseLabel = c.phase === 'vote' ? '🗳 при голосовании' : '📤 при раскрытии';
            html += '<div class="bunker-action-card flex-1 min-w-[160px] max-w-[240px] p-4" style="opacity:0.4;pointer-events:none;filter:grayscale(0.7)">';
            html += '  <div class="bunker-action-card-corner">⚡</div>';
            html += '  <div class="text-3xl mb-2.5 relative z-10">' + escapeHtml(c.emoji) + '</div>';
            html += '  <div class="text-xs font-black uppercase tracking-wider mb-2 relative z-10" style="color:#f5d060">' + escapeHtml(c.name) + '</div>';
            html += '  <div class="text-[0.7rem] leading-relaxed relative z-10" style="color:rgba(230,210,150,0.9)">' + escapeHtml(c.desc) + '</div>';
            html += '  <div class="text-[0.65rem] font-bold mt-2 relative z-10" style="color:rgba(245,183,49,0.7)">' + phaseLabel + '</div>';
            html += '</div>';
        }
    }

    html += '  </div>';
    html += '</div>';
    return html;
}

// ═══════════════════════════════════════════
// МОДАЛЬНОЕ ОКНО — карта действия
// ═══════════════════════════════════════════

function renderActionCardModal() {
    return '<div id="action-card-modal" class="fixed inset-0 z-50 hidden"><div class="absolute inset-0 bg-black/75 backdrop-blur-sm"></div><div class="relative flex items-center justify-center min-h-screen p-4"><div id="action-card-modal-content" class="max-w-sm w-full corp-card-elevated p-5"></div></div></div>';
}

function openActionCardModal(container, contentHtml, onClose) {
    var modal = container.querySelector('#action-card-modal');
    var content = container.querySelector('#action-card-modal-content');
    if (!modal || !content) return;
    content.innerHTML = contentHtml;
    modal.classList.remove('hidden');

    var btnCancel = content.querySelector('#btn-action-cancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', function () {
            modal.classList.add('hidden');
            if (onClose) onClose();
        });
    }
    modal.addEventListener('click', function handler(e) {
        if (e.target === modal) {
            modal.classList.add('hidden');
            modal.removeEventListener('click', handler);
            if (onClose) onClose();
        }
    });
}

function closeActionCardModal(container) {
    var modal = container.querySelector('#action-card-modal');
    if (modal) modal.classList.add('hidden');
}

// Основной флоу: в зависимости от типа карты — разные шаги
function openActionCardFlow(container, card) {
    // extraCard: выбрать targetCardKey (какую колоду)
    if (card.cardType === 'extraCard') {
        showCardKeyPicker(container, card, '🃏 Выберите категорию для вытяжки', false, function (pickedKey) {
            closeActionCardModal(container);
            sendMsg({ type: 'bunkerPlayActionCard', cardId: card.cardId, targetCardKey: pickedKey });
            playSound('start');
        });
        return;
    }
    // wildcard: выбрать myCardKey (какую из своих заменить)
    if (card.cardType === 'wildcard') {
        showMyCardKeyPicker(container, card, function (myKey) {
            closeActionCardModal(container);
            sendMsg({ type: 'bunkerPlayActionCard', cardId: card.cardId, myCardKey: myKey });
            playSound('start');
        });
        return;
    }
    // absorb: выбрать eliminated игрока, потом targetCardKey
    if (card.cardType === 'absorb') {
        showTargetPicker(container, card, true /* onlyEliminated */, function (targetId) {
            showCardKeyPicker(container, card, '📦 Какую карту взять?', false, function (pickedKey) {
                closeActionCardModal(container);
                sendMsg({ type: 'bunkerPlayActionCard', cardId: card.cardId, targetPlayerId: targetId, targetCardKey: pickedKey });
                playSound('start');
            });
        });
        return;
    }
    // needsTarget (без cardKey): выбрать активного игрока
    if (card.needsTarget && !card.needsCardKey) {
        showTargetPicker(container, card, false, function (targetId) {
            closeActionCardModal(container);
            sendMsg({ type: 'bunkerPlayActionCard', cardId: card.cardId, targetPlayerId: targetId });
            playSound('start');
        });
        return;
    }
    // ни target ни cardKey — подтверждение
    showConfirmPlay(container, card, function () {
        closeActionCardModal(container);
        sendMsg({ type: 'bunkerPlayActionCard', cardId: card.cardId });
        playSound('start');
    });
}

function showConfirmPlay(container, card, onConfirm) {
    var html = '';
    html += '<div class="text-center">';
    html += '  <div class="text-4xl mb-2">' + escapeHtml(card.emoji) + '</div>';
    html += '  <div class="text-sm font-black text-accent-gold mb-1">' + escapeHtml(card.name) + '</div>';
    html += '  <div class="text-xs text-corp-muted mb-4">' + escapeHtml(card.desc) + '</div>';
    html += '  <div class="flex gap-2 justify-center">';
    html += '    <button id="btn-action-cancel" class="btn-ghost px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Отмена</button>';
    html += '    <button id="btn-action-confirm" class="btn-neon px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Сыграть</button>';
    html += '  </div>';
    html += '</div>';
    openActionCardModal(container, html);
    var btnConfirm = container.querySelector('#btn-action-confirm');
    if (btnConfirm) btnConfirm.addEventListener('click', onConfirm);
}

function showTargetPicker(container, card, onlyEliminated, onPick) {
    var players = state.players || [];
    var myId = state.playerId;
    var eliminated = (state.bunker && state.bunker.eliminatedPlayers) || [];

    var targets = [];
    if (onlyEliminated) {
        for (var i = 0; i < players.length; i++) {
            if (eliminated.includes(players[i].id)) targets.push(players[i]);
        }
    } else {
        for (var j = 0; j < players.length; j++) {
            if (players[j].id !== myId && !eliminated.includes(players[j].id)) targets.push(players[j]);
        }
    }

    var html = '';
    html += '<div class="text-2xl mb-1 text-center">' + escapeHtml(card.emoji) + '</div>';
    html += '<div class="text-xs font-black text-accent-gold text-center mb-1">' + escapeHtml(card.name) + '</div>';
    html += '<div class="text-[0.6rem] text-corp-muted text-center mb-3">' + (onlyEliminated ? 'Выберите выбывшего игрока:' : 'Выберите цель:') + '</div>';

    if (targets.length === 0) {
        html += '<div class="text-xs text-accent-red text-center mb-3">' + (onlyEliminated ? 'Нет выбывших игроков' : 'Нет доступных целей') + '</div>';
        html += '<div class="flex justify-center"><button id="btn-action-cancel" class="btn-ghost px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Закрыть</button></div>';
        openActionCardModal(container, html);
        return;
    }

    html += '<div class="space-y-1.5 mb-3 max-h-48 overflow-y-auto">';
    for (var k = 0; k < targets.length; k++) {
        html += '<button class="btn-target-player w-full text-left px-3 py-2 rounded-xl corp-card hover:border-accent-gold/40 text-sm font-bold text-corp-light cursor-pointer transition-colors"';
        html += ' data-target-id="' + escapeHtml(targets[k].id) + '">' + escapeHtml(targets[k].nickname) + '</button>';
    }
    html += '</div>';
    html += '<div class="flex justify-center"><button id="btn-action-cancel" class="btn-ghost px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer">Отмена</button></div>';

    openActionCardModal(container, html);

    var targetBtns = container.querySelectorAll('#action-card-modal-content .btn-target-player');
    for (var tb = 0; tb < targetBtns.length; tb++) {
        (function (tbtn) {
            tbtn.addEventListener('click', function () {
                onPick(tbtn.getAttribute('data-target-id'));
            });
        })(targetBtns[tb]);
    }
}

function showCardKeyPicker(container, card, title, skipRevealed, onPick) {
    var myRevealed = (state.bunker && state.bunker.revealedCards && state.bunker.revealedCards[state.playerId]) || {};

    var html = '';
    html += '<div class="text-2xl mb-1 text-center">' + escapeHtml(card.emoji) + '</div>';
    html += '<div class="text-xs font-black text-accent-gold text-center mb-1">' + escapeHtml(card.name) + '</div>';
    html += '<div class="text-[0.6rem] text-corp-muted text-center mb-3">' + escapeHtml(title) + '</div>';
    html += '<div class="grid grid-cols-2 gap-1.5 mb-3">';

    for (var ci = 0; ci < BUNKER_CARD_TYPES.length; ci++) {
        var ct = BUNKER_CARD_TYPES[ci];
        var disabled = skipRevealed && myRevealed[ct.key];
        html += '<button class="btn-card-key-pick w-full px-2 py-2 rounded-xl text-[0.6rem] font-bold text-center cursor-pointer transition-all ' + ct.bg + ' ' + ct.border + ' border ' + ct.color;
        html += disabled ? ' opacity-30 pointer-events-none' : ' hover:scale-[1.02] hover:border-white/20';
        html += '" data-card-key="' + ct.key + '">';
        html += ct.emoji + ' ' + ct.label;
        html += '</button>';
    }

    html += '</div>';
    html += '<div class="flex justify-center"><button id="btn-action-cancel" class="btn-ghost px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer">Отмена</button></div>';

    openActionCardModal(container, html);

    var keyBtns = container.querySelectorAll('#action-card-modal-content .btn-card-key-pick');
    for (var kb = 0; kb < keyBtns.length; kb++) {
        (function (kbtn) {
            kbtn.addEventListener('click', function () {
                onPick(kbtn.getAttribute('data-card-key'));
            });
        })(keyBtns[kb]);
    }
}

function showMyCardKeyPicker(container, card, onPick) {
    // Wildcard: выбираем СВОЮ карту (нераскрытую) для замены
    showCardKeyPicker(container, card, '🔄 Какую из своих карт заменить?', true /* skipRevealed */, onPick);
}

// Экспортируем функцию перерисовки руки для вызова из socket.js
window.renderBunkerActionHand = function () {
    var container = document.getElementById('app');
    if (!container) return;
    var handEl = container.querySelector('#bunker-action-hand');
    if (!handEl) return;
    var actionCards = state.myActionCards || [];
    if (actionCards.length === 0) {
        handEl.remove();
        return;
    }
    var currentPhase = state.phase === 'bunkerVote' ? 'vote' : 'reveal';
    handEl.outerHTML = renderActionHand(actionCards, currentPhase);
    // Re-attach listeners for the new element
    var newHand = container.querySelector('#bunker-action-hand');
    if (!newHand) return;
    var actionBtns = newHand.querySelectorAll('.bunker-action-card-btn');
    for (var acbi = 0; acbi < actionBtns.length; acbi++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                openActionCardFlow(container, {
                    cardId: btn.getAttribute('data-action-id'),
                    cardType: btn.getAttribute('data-action-type'),
                    needsTarget: btn.getAttribute('data-needs-target') === 'true',
                    needsCardKey: btn.getAttribute('data-needs-card-key') === 'true',
                    name: btn.getAttribute('data-action-name'),
                    emoji: btn.getAttribute('data-action-emoji'),
                    desc: btn.getAttribute('data-action-desc')
                });
            });
        })(actionBtns[acbi]);
    }
};

// ═══════════════════════════════════════════
// МОДАЛЬНОЕ ОКНО — большое раскрытие карты
// ═══════════════════════════════════════════

function renderRevealModal() {
    var html = '';
    html += '<div id="reveal-modal" class="fixed inset-0 z-50 hidden">';
    html += '  <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>';
    html += '  <div class="relative flex items-center justify-center min-h-screen p-4">';
    html += '    <div id="reveal-modal-content" class="max-w-md w-full">';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
    return html;
}

function buildFxParticlesHtml(className, count, spread) {
    var html = '';
    for (var i = 0; i < count; i++) {
        var angle = (Math.PI * 2 * i) / count + (Math.random() * 0.35 - 0.175);
        var dist = spread * (0.6 + Math.random() * 0.5);
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist;
        var delay = Math.random() * 0.14;
        var size = 4 + Math.random() * 6;
        html += '<span class="' + className + '" style="--dx:' + dx.toFixed(1) + 'px;--dy:' + dy.toFixed(1) + 'px;--delay:' + delay.toFixed(2) + 's;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;"></span>';
    }
    return html;
}

function showRevealModal(container, data) {
    var modal = container.querySelector('#reveal-modal');
    var content = container.querySelector('#reveal-modal-content');
    if (!modal || !content) return;

    // Находим тип карты
    var cardType = null;
    for (var i = 0; i < BUNKER_CARD_TYPES.length; i++) {
        if (BUNKER_CARD_TYPES[i].key === data.cardKey) {
            cardType = BUNKER_CARD_TYPES[i];
            break;
        }
    }
    if (!cardType) return;

    var isMe = data.playerId === state.playerId;

    var html = '';
    html += '<div class="bunker-reveal-fx">';
    html += '  <div class="bunker-reveal-burst"></div>';
    html += '  <div class="bunker-reveal-particles">' + buildFxParticlesHtml('bunker-reveal-spark', 12, 110) + '</div>';
    html += '  <div class="bunker-card-flip">';

    // Имя игрока
    html += '  <div class="text-center mb-4">';
    html += '    <div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-1">';
    html += (data.isAuto ? '⏰ Авто-раскрытие' : (isMe ? '🃏 Вы раскрываете' : '🃏 Раскрывает карту'));
    html += '    </div>';
    html += '    <div class="text-xl font-black ' + (isMe ? 'text-accent-blue' : 'text-accent-gold') + '">' + escapeHtml(data.nickname) + '</div>';
    html += '  </div>';

    // Большая карточка
    html += '  <div class="relative rounded-3xl overflow-hidden ' + cardType.gradient + ' shadow-2xl p-8 text-center" style="min-height: 200px;">';

    // Badge
    html += '    <div class="absolute top-0 left-0 right-0 h-10 bg-black/25 flex items-center justify-center">';
    html += '      <span class="text-xs font-black uppercase tracking-[0.12em] text-white/70">' + cardType.emoji + ' ' + cardType.label + '</span>';
    html += '    </div>';

    // Значение
    html += '    <div class="flex items-center justify-center" style="min-height: 140px; padding-top: 20px;">';
    var textSize = data.cardValue && data.cardValue.length > 40 ? 'text-lg' : 'text-2xl';
    html += '      <span class="' + textSize + ' font-black text-white leading-tight drop-shadow-lg">';
    html += escapeHtml(data.cardValue);
    html += '      </span>';
    html += '    </div>';

    // Луч света, пробегающий по карте (не совмещаем с фоновым shimmer — вместе рябит)
    html += '    <div class="bunker-reveal-shine"></div>';

    html += '  </div>';

    html += '  </div>'; // end flip
    html += '</div>'; // end reveal-fx

    content.innerHTML = html;
    modal.classList.remove('hidden');

    playSound(isMe ? 'success' : 'join');

    // Закрыть через 4 секунды или по клику
    var closeTimeout = setTimeout(function () {
        closeRevealModal(container);
    }, 4000);

    modal.addEventListener('click', function handler() {
        clearTimeout(closeTimeout);
        closeRevealModal(container);
        modal.removeEventListener('click', handler);
    });
}

function closeRevealModal(container) {
    var modal = container.querySelector('#reveal-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ═══════════════════════════════════════════
// МОДАЛЬНОЕ ОКНО — детали игрока (по клику)
// ═══════════════════════════════════════════

function showPlayerDetailModal(container, playerId, players, revealedCards, myId, myCards) {
    // Находим или создаём модалку
    var existing = container.querySelector('#player-detail-modal');
    if (existing) existing.remove();

    var player = null;
    for (var i = 0; i < players.length; i++) {
        if (players[i].id === playerId) { player = players[i]; break; }
    }
    if (!player) return;

    var revealed = revealedCards[playerId] || {};
    var isMe = playerId === myId;

    var html = '';
    html += '<div id="player-detail-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);">';
    html += '  <div class="max-w-lg w-full corp-card-elevated p-6">';

    // Header
    html += '    <div class="flex items-center justify-between mb-4">';
    html += '      <h3 class="text-lg font-black text-accent-gold">' + escapeHtml(player.nickname);
    if (isMe) html += ' <span class="text-accent-blue text-sm">(Вы)</span>';
    html += '      </h3>';
    html += '      <button id="btn-close-detail" class="w-8 h-8 rounded-full bg-corp-graphite flex items-center justify-center text-corp-muted hover:text-corp-light cursor-pointer">✕</button>';
    html += '    </div>';

    // Карты
    html += '    <div class="grid grid-cols-2 gap-2">';
    var histFactType = null;
    for (var ci = 0; ci < BUNKER_CARD_TYPES.length; ci++) {
        var ct = BUNKER_CARD_TYPES[ci];
        if (ct.key === 'historicalFact') { histFactType = ct; continue; }
        var isCardRevealed = revealed[ct.key];

        if (isCardRevealed) {
            var val = '';
            if (isMe) {
                val = myCards[ct.key] || '???';
            } else {
                val = getBunkerRevealedValue(playerId, ct.key);
            }
            html += '<div class="rounded-xl p-3 ' + ct.bg + ' ' + ct.border + ' border">';
            html += '  <div class="text-[0.65rem] font-bold text-corp-dim uppercase tracking-widest mb-1">' + ct.emoji + ' ' + ct.label + '</div>';
            html += '  <div class="text-sm font-bold ' + ct.color + ' leading-snug">' + escapeHtml(val) + '</div>';
            html += '</div>';
        } else {
            html += '<div class="rounded-xl p-3 bunker-card-back">';
            html += '  <div class="text-[0.65rem] font-bold text-corp-dim uppercase tracking-widest mb-1">' + ct.emoji + ' ' + ct.label + '</div>';
            html += '  <div class="text-sm font-bold text-corp-dim">Скрыто</div>';
            html += '</div>';
        }
    }
    html += '    </div>';
    // Исторический факт — полноширинная
    if (histFactType) {
        var hIsRevealed = revealed['historicalFact'];
        if (hIsRevealed) {
            var hVal = isMe ? (myCards['historicalFact'] || '???') : getBunkerRevealedValue(playerId, 'historicalFact');
            html += '<div class="mt-2 rounded-xl p-3 ' + histFactType.bg + ' ' + histFactType.border + ' border">';
            html += '  <div class="text-[0.65rem] font-bold text-corp-dim uppercase tracking-widest mb-1">' + histFactType.emoji + ' ' + histFactType.label + '</div>';
            html += '  <div class="text-sm font-bold ' + histFactType.color + ' leading-snug">' + escapeHtml(hVal) + '</div>';
            html += '</div>';
        } else {
            html += '<div class="mt-2 rounded-xl p-3 bunker-card-back">';
            html += '  <div class="text-[0.65rem] font-bold text-corp-dim uppercase tracking-widest mb-1">' + histFactType.emoji + ' ' + histFactType.label + '</div>';
            html += '  <div class="text-sm font-bold text-corp-dim">Скрыто</div>';
            html += '</div>';
        }
    }

    // Сыгранные карты действия
    var playedCards = (state.bunker && state.bunker.playedActionCards && state.bunker.playedActionCards[playerId]) || [];
    if (playedCards.length > 0) {
        html += '    <div class="mt-4 pt-3 border-t border-corp-border/30">';
        html += '      <div class="text-xs font-bold text-accent-gold uppercase tracking-widest mb-2">⚡ Сыгранные карты действия</div>';
        html += '      <div class="space-y-2">';
        for (var pci = 0; pci < playedCards.length; pci++) {
            var pc = playedCards[pci];
            html += '<div class="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/30">';
            html += '  <span class="text-xl flex-shrink-0 mt-0.5">' + escapeHtml(pc.emoji) + '</span>';
            html += '  <div>';
            html += '    <div class="text-xs font-bold text-accent-gold mb-0.5">' + escapeHtml(pc.name) + '</div>';
            html += '    <div class="text-[0.7rem] text-corp-dim leading-relaxed">' + escapeHtml(pc.effect) + '</div>';
            html += '  </div>';
            html += '</div>';
        }
        html += '      </div>';
        html += '    </div>';
    }

    html += '  </div>';
    html += '</div>';

    container.insertAdjacentHTML('beforeend', html);

    // Закрытие
    var btnClose = container.querySelector('#btn-close-detail');
    var modalEl = container.querySelector('#player-detail-modal');
    if (btnClose) {
        btnClose.addEventListener('click', function () {
            if (modalEl) modalEl.remove();
        });
    }
    if (modalEl) {
        modalEl.addEventListener('click', function (e) {
            if (e.target === modalEl) modalEl.remove();
        });
    }
}

// ═══════════════════════════════════════════
// СЕТКА ИГРОКОВ
// ═══════════════════════════════════════════

function renderPlayersGrid(players, revealedCards, eliminatedPlayers, myId, myCards, revealOrder, currentPlayerId) {
    var html = '';
    var count = players.length;

    // Для 3-6 игроков — 2 колонки, для 7+ — 3 колонки, для 13+ — 4
    var gridClass;
    if (count <= 6) gridClass = 'grid-cols-1 sm:grid-cols-2';
    else if (count <= 12) gridClass = 'grid-cols-2 sm:grid-cols-3';
    else gridClass = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

    html += '<div class="mt-3">';
    html += '  <h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-2">👥 Участники <span class="text-corp-dim">(нажмите для деталей)</span></h3>';
    html += '  <div class="grid ' + gridClass + ' gap-2">';

    // Сортируем по порядку ходов
    var orderedIds = [];
    for (var oi = 0; oi < revealOrder.length; oi++) {
        var rid = typeof revealOrder[oi] === 'object' ? revealOrder[oi].id : revealOrder[oi];
        orderedIds.push(rid);
    }

    var sortedPlayers = [];
    for (var oi2 = 0; oi2 < orderedIds.length; oi2++) {
        for (var pi = 0; pi < players.length; pi++) {
            if (players[pi].id === orderedIds[oi2]) { sortedPlayers.push(players[pi]); break; }
        }
    }
    for (var pi2 = 0; pi2 < players.length; pi2++) {
        var found = false;
        for (var si = 0; si < sortedPlayers.length; si++) {
            if (sortedPlayers[si].id === players[pi2].id) { found = true; break; }
        }
        if (!found) sortedPlayers.push(players[pi2]);
    }

    for (var i = 0; i < sortedPlayers.length; i++) {
        var p = sortedPlayers[i];
        var isMe = p.id === myId;
        var isEliminated = eliminatedPlayers.includes(p.id);
        var isCurrent = p.id === currentPlayerId;
        var playerRevealed = revealedCards[p.id] || {};

        var revealedCount = 0;
        for (var rci = 0; rci < BUNKER_CARD_TYPES.length; rci++) {
            if (playerRevealed[BUNKER_CARD_TYPES[rci].key]) revealedCount++;
        }

        // p.connected приходит с сервера; undefined у старых сообщений — считаем «на связи»
        var isOffline = !isMe && p.connected === false;

        var borderClass = '';
        if (isCurrent) borderClass = ' border-accent-gold/40 bunker-current-pulse';
        else if (isEliminated) borderClass = ' border-accent-red/20 opacity-30';
        else if (isOffline) borderClass = ' border-corp-border opacity-50';
        else if (isMe) borderClass = ' border-accent-blue/20';

        var clickable = !isMe ? ' cursor-pointer hover:border-corp-light/20 transition-colors' : '';

        html += '<div class="corp-card p-3 emotion-anchor' + borderClass + clickable + '" data-player-id="' + p.id + '"';
        if (!isMe) html += ' data-player-detail="' + p.id + '"';
        else html += ' data-emotion-self="1"';
        html += '>';

        // Имя + статус + счётчик
        html += '<div class="flex items-center justify-between mb-2">';
        html += '  <div class="flex items-center gap-1.5 flex-1 min-w-0">';
        if (isCurrent) html += '<span class="text-sm flex-shrink-0">🎤</span>';
        if (isEliminated) html += '<span class="text-sm flex-shrink-0">💀</span>';
        else if (isOffline) html += '<span class="text-sm flex-shrink-0" title="Игрок отключился">📴</span>';
        html += '    <span class="text-sm font-bold ' + (isEliminated ? 'text-accent-red line-through' : (isOffline ? 'text-corp-muted' : 'text-corp-light')) + ' truncate">';
        html += escapeHtml(p.nickname);
        html += '    </span>';
        if (isMe) html += '<span class="text-accent-blue text-[0.55rem] flex-shrink-0">(Вы)</span>';
        html += '  </div>';
        html += '  <div class="text-[0.6rem] font-mono font-bold ' + (revealedCount > 0 ? 'text-accent-blue' : 'text-corp-dim') + ' flex-shrink-0 ml-2">';
        html += revealedCount + '/9';
        html += '  </div>';
        if (state.isHost && !isMe && !isEliminated) {
            html += '<button class="bunker-kick-btn flex-shrink-0 ml-2" data-bunker-kick="' + p.id + '" data-bunker-kick-name="' + escapeHtml(p.nickname) + '" title="Исключить из бункера">🚫</button>';
        }
        html += '</div>';

        // Раскрытые карты — ЧИТАЕМЫЕ строки
        var hasRevealed = false;
        html += '<div class="space-y-1">';
        for (var ci = 0; ci < BUNKER_CARD_TYPES.length; ci++) {
            var ct = BUNKER_CARD_TYPES[ci];
            var isCardRevealed = playerRevealed[ct.key];

            if (isCardRevealed) {
                hasRevealed = true;
                var val = '';
                if (isMe) {
                    val = myCards[ct.key] || '???';
                } else {
                    val = getBunkerRevealedValue(p.id, ct.key);
                }

                html += '<div class="flex items-start gap-1.5 px-2 py-1 rounded-lg ' + ct.bg + ' ' + ct.border + ' border">';
                html += '  <span class="text-[0.6rem] flex-shrink-0 mt-0.5">' + ct.emoji + '</span>';
                html += '  <span class="text-[0.65rem] font-bold ' + ct.color + ' leading-snug">' + escapeHtml(val) + '</span>';
                html += '</div>';
            }
        }

        if (!hasRevealed) {
            html += '<div class="text-[0.6rem] text-corp-dim italic px-2 py-1">Нет раскрытых карт</div>';
        }

        // Скрытые — маленькие точки
        var hiddenKeys = [];
        for (var ci2 = 0; ci2 < BUNKER_CARD_TYPES.length; ci2++) {
            if (!playerRevealed[BUNKER_CARD_TYPES[ci2].key]) {
                hiddenKeys.push(BUNKER_CARD_TYPES[ci2]);
            }
        }
        if (hiddenKeys.length > 0 && hiddenKeys.length < 8) {
            html += '<div class="flex gap-1 mt-1 px-2">';
            for (var hi = 0; hi < hiddenKeys.length; hi++) {
                html += '<div class="w-4 h-4 rounded bg-corp-graphite border border-corp-border flex items-center justify-center opacity-40" title="' + escapeHtml(hiddenKeys[hi].label) + ' — скрыто">';
                html += '<span class="text-[0.4rem]">' + hiddenKeys[hi].emoji + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        // Сыгранные карты действия (иконки)
        var pPlayed = (state.bunker && state.bunker.playedActionCards && state.bunker.playedActionCards[p.id]) || [];
        if (pPlayed.length > 0) {
            html += '<div class="flex gap-1 mt-1.5 px-2 flex-wrap">';
            for (var ppi = 0; ppi < pPlayed.length; ppi++) {
                html += '<div class="px-1.5 py-0.5 rounded bg-amber-900/20 border border-amber-700/40 flex items-center gap-1" title="' + escapeHtml(pPlayed[ppi].name) + ': ' + escapeHtml(pPlayed[ppi].effect) + '">';
                html += '<span class="text-sm">' + escapeHtml(pPlayed[ppi].emoji) + '</span>';
                html += '<span class="text-[0.65rem] text-amber-400/80 font-bold">⚡</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div>';

        html += '</div>'; // end player card
    }

    html += '  </div>';
    html += '</div>';
    return html;
}

function truncateText(text, maxLen) {
    if (!text) return '???';
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 2) + '..';
}

// Для колонки участников: окно со всеми раскрытыми картами игрока
export function openBunkerPlayerDetail(playerId) {
    var host = document.querySelector('#app .game-main') || document.body;
    var bunker = state.bunker || {};
    showPlayerDetailModal(host, playerId, state.players || [], bunker.revealedCards || {}, state.playerId, state.myCards || {});
}

export function getBunkerRevealedValue(playerId, cardKey) {
    var vals = state.bunker.revealedCardValues || {};
    if (vals[playerId] && vals[playerId][cardKey]) {
        return vals[playerId][cardKey];
    }
    return '???';
}

// ═══════════════════════════════════════════
// ЭКРАН: Результат голосования
// ═══════════════════════════════════════════

export function renderBunkerVoteResult(container) {
    var result = state.bunker.voteResult || {};
    var players = state.players || [];

    var html = '';
    html += '<div class="max-w-3xl mx-auto px-4 py-8 min-h-screen text-center">';

    if (result.result === 'eliminated') {
        html += '<div class="bk-out">';
        html += '  <div class="bk-out-door">🚪</div>';
        html += '  <div class="bk-out-label">Покидает бункер</div>';
        html += '  <div class="bk-out-name">' + escapeHtml(result.eliminatedNickname || '???') + '</div>';
        html += '  <div class="bk-out-sub">Дверь закрылась. Вот что он пытался спасти:</div>';
        html += '</div>';

        // Все карты кикнутого — КРУПНО
        if (result.eliminatedCards) {
            html += '<div class="corp-card p-5 mb-6 text-left">';
            html += '  <h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-3 text-center">Полный продукт выбывшего</h3>';

            // Название продукта
            var adj = result.eliminatedCards.adjective || '';
            var item = result.eliminatedCards.item || '';
            var modifier = result.eliminatedCards.modifier || '';
            var feature = result.eliminatedCards.feature || '';

            html += '  <div class="text-center mb-4 p-3 rounded-xl bg-corp-black/50">';
            html += '    <div class="text-lg font-black text-accent-gold">';
            html += escapeHtml(adj + ' ' + item);
            if (modifier) html += ' <span class="text-accent-green">' + escapeHtml(modifier) + '</span>';
            html += '    </div>';
            if (feature) {
                html += '    <div class="text-sm text-corp-light mt-1">' + escapeHtml(feature) + '</div>';
            }
            html += '  </div>';

            html += '  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">';
            for (var ci = 0; ci < BUNKER_CARD_TYPES.length; ci++) {
                var ct = BUNKER_CARD_TYPES[ci];
                if (ct.key === 'historicalFact') continue;
                var val = result.eliminatedCards[ct.key];
                if (val) {
                    html += '<div class="rounded-xl p-2.5 ' + ct.bg + ' ' + ct.border + ' border text-center">';
                    html += '  <div class="text-[0.65rem] font-bold text-corp-dim uppercase tracking-widest mb-1">' + ct.emoji + ' ' + ct.label + '</div>';
                    html += '  <div class="text-xs font-bold ' + ct.color + ' leading-snug">' + escapeHtml(val) + '</div>';
                    html += '</div>';
                }
            }
            html += '  </div>';
            var hfVal = result.eliminatedCards['historicalFact'];
            if (hfVal) {
                html += '<div class="mt-2 rounded-xl p-2.5 bg-yellow-900/20 border border-yellow-700/30">';
                html += '  <div class="text-[0.65rem] font-bold text-corp-dim uppercase tracking-widest mb-1">📜 Исторический факт</div>';
                html += '  <div class="text-xs font-bold text-yellow-300 leading-snug">' + escapeHtml(hfVal) + '</div>';
                html += '</div>';
            }
            html += '</div>';
        }

        var left = result.remainingPlayers || 0, need = state.bunker.survivorsCount || 0;
        html += '<div class="bk-seats-line">';
        html += '  <span>👥 Претендентов: <b>' + (left || '?') + '</b></span>';
        html += '  <span>🛏 Мест: <b>' + (need || '?') + '</b></span>';
        html += '  <span>' + (left > need ? '🚪 Выгнать ещё: <b>' + (left - need) + '</b>' : '✅ <b>Бункер укомплектован</b>') + '</span>';
        html += '</div>';
    } else {
        html += '<div class="bk-out bk-out-safe">';
        html += '  <div class="bk-out-door">🤝</div>';
        html += '  <div class="bk-out-label">Сегодня никто не выбыл</div>';
        html += '  <div class="bk-out-name">Все остаются</div>';
        html += '</div>';
        html += '<p class="text-sm text-corp-muted mb-6">' + escapeHtml(result.message || '') + '</p>';
    }

    // Результаты голосования
    if (result.voteCounts) {
        html += '<div class="corp-card p-4 mb-6 text-left">';
        html += '  <h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-3">📊 Результаты голосования</h3>';

        var entries = Object.keys(result.voteCounts).map(function (id) {
            return { id: id, votes: result.voteCounts[id] };
        }).sort(function (a, b) { return b.votes - a.votes; });

        for (var vi = 0; vi < entries.length; vi++) {
            var e = entries[vi];
            var pName = '???';
            for (var pi = 0; pi < players.length; pi++) {
                if (players[pi].id === e.id) { pName = players[pi].nickname; break; }
            }
            var barWidth = entries[0].votes > 0 ? Math.round((e.votes / entries[0].votes) * 100) : 0;

            html += '<div class="mb-2">';
            html += '  <div class="flex items-center justify-between text-xs mb-0.5">';
            html += '    <span class="font-bold text-corp-light">' + escapeHtml(pName) + '</span>';
            html += '    <span class="font-mono font-bold ' + (e.votes > 0 ? 'text-accent-red' : 'text-corp-dim') + '">' + e.votes + '</span>';
            html += '  </div>';
            html += '  <div class="h-1.5 bg-corp-graphite rounded-full overflow-hidden">';
            html += '    <div class="h-full bg-accent-red/60 rounded-full" style="width: ' + barWidth + '%"></div>';
            html += '  </div>';
            html += '</div>';
        }
        html += '</div>';
    }

    if (result.skipCount > 0) {
        html += '<div class="text-xs text-corp-dim mb-4">Пропустили голосование: ' + result.skipCount + '</div>';
    }

    var bunkerFull = result.result === 'eliminated' && result.remainingPlayers && result.survivorsCount && result.remainingPlayers <= result.survivorsCount;
    html += audienceResultHtml(result.audience);
    html += '<div class="text-sm text-corp-muted animate-pulse">' + (bunkerFull ? 'Двери закрываются — сейчас узнаем, кто выжил…' : 'Переход к следующему раунду...') + '</div>';

    html += '</div>';
    container.innerHTML = html;
}