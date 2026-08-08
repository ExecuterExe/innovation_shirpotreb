import { state, escapeHtml } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';
import { renderBunkerChat } from '../components/bunker-chat.js';
import { showNotification } from '../components/notification.js';
import { playSound } from '../components/sound.js';
import { BUNKER_CARD_TYPES } from './bunker-game.js';

// ═══════════════════════════════════════════
// ЭКРАН: Голосование за кик (bunkerVote)
// ═══════════════════════════════════════════

export function renderBunkerVote(container) {
    var bunker = state.bunker || {};
    var myId = state.playerId;
    var isHost = state.isHost;
    var activePlayers = bunker.activePlayers || [];
    var eliminatedPlayers = bunker.eliminatedPlayers || [];
    var isEliminated = eliminatedPlayers.includes(myId);
    var paused = bunker.paused;

    var html = '';
    html += '<div class="bunker-layout">';
    html += '<div id="bunker-main-content" class="bunker-main-col">';

    // Header
    html += '<div class="flex items-start justify-between mb-6">';
    html += '<div class="text-center flex-1">';
    html += '  <h2 class="text-2xl font-black text-accent-red mb-2">🗳 Голосование</h2>';
    html += '  <p class="text-sm text-corp-muted">Кого исключить из бункера? Или пропустите голосование.</p>';
    html += '  <p class="text-xs text-corp-dim mt-1">Осталось кикнуть: <span class="text-accent-red font-bold">' + (bunker.remainingKicks || '?') + '</span></p>';
    html += '</div>';
    html += '<button id="btn-exit-vote" class="flex-shrink-0 ml-2 px-2.5 py-1.5 rounded-lg border border-corp-border text-corp-muted hover:text-accent-red hover:border-accent-red/30 transition-colors text-xs font-bold cursor-pointer">✕ Выйти</button>';
    html += '</div>';

    // Timer
    if (bunker.hostMode) {
        html += '<div class="text-center mb-4">';
        html += '  <div class="text-sm font-black text-accent-gold">🎙 Ведущий завершит голосование вручную</div>';
        html += '</div>';
    } else if (!paused) {
        html += '<div class="text-center mb-4">';
        html += '  <div data-timer-text class="font-mono text-3xl font-black text-corp-white"></div>';
        html += '  <div class="max-w-xs mx-auto mt-2">';
        html += '    <div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
        html += '  </div>';
        html += '</div>';
    } else {
        html += '<div class="text-center mb-4">';
        html += '  <div class="text-xl font-black text-accent-gold">⏸ ПАУЗА</div>';
        html += '</div>';
    }

    // Progress
    html += '<div class="text-center mb-4">';
    html += '  <div id="bunker-vote-progress" class="text-sm font-semibold text-corp-muted"></div>';
    html += '</div>';

    if (isEliminated) {
        html += '<div class="corp-card p-6 text-center mb-6">';
        html += '  <span class="text-corp-muted">Вы выбыли и не можете голосовать</span>';
        html += '</div>';
    } else {
        // Кандидаты
        html += '<div class="space-y-3 mb-6">';

        // Кнопка пропуска
        html += '<div class="corp-card p-4 cursor-pointer hover:border-accent-green/40 transition-colors" data-bunker-vote="__skip__" data-voteable>';
        html += '  <div class="flex items-center justify-between">';
        html += '    <div>';
        html += '      <div class="text-sm font-bold text-accent-green">✅ Пропустить голосование</div>';
        html += '      <div class="text-xs text-corp-dim">Продолжить игру без кика</div>';
        html += '    </div>';
        html += '    <div class="vote-indicator w-8 h-8 rounded-full border-2 border-corp-border flex items-center justify-center text-xs font-bold transition-all flex-shrink-0" data-vote-target="__skip__"></div>';
        html += '  </div>';
        html += '</div>';

        // Игроки
        for (var i = 0; i < activePlayers.length; i++) {
            var p = activePlayers[i];
            var isSelf = p.id === myId;

            html += '<div class="corp-card p-4';
            if (isSelf) html += ' opacity-30';
            else html += ' cursor-pointer hover:border-accent-red/30 transition-colors';
            html += '" data-bunker-vote="' + p.id + '"';
            if (!isSelf) html += ' data-voteable';
            html += '>';

            html += '<div class="flex items-center justify-between mb-2">';
            html += '  <div class="text-sm font-bold text-accent-gold">' + escapeHtml(p.nickname);
            if (isSelf) html += ' <span class="text-corp-muted text-xs font-normal">(Вы)</span>';
            html += '  </div>';
            html += '  <div class="flex items-center gap-2 flex-shrink-0">';
            if (isHost && !isSelf) {
                html += '<button class="bunker-kick-btn" data-bunker-kick="' + p.id + '" data-bunker-kick-name="' + escapeHtml(p.nickname) + '" title="Исключить из бункера">🚫</button>';
            }
            if (!isSelf) {
                html += '  <div class="vote-indicator w-8 h-8 rounded-full border-2 border-corp-border flex items-center justify-center text-xs font-bold transition-all flex-shrink-0" data-vote-target="' + p.id + '"></div>';
            }
            html += '  </div>';
            html += '</div>';

            // Раскрытые карты
            var revealed = p.revealedCards || {};
            var hasCards = false;
            html += '<div class="flex flex-wrap gap-1.5">';
            for (var ci = 0; ci < BUNKER_CARD_TYPES.length; ci++) {
                var ct = BUNKER_CARD_TYPES[ci];
                var val = revealed[ct.key];
                if (val) {
                    hasCards = true;
                    html += '<span class="text-[0.6rem] font-bold px-2 py-1 rounded-lg ' + ct.bg + ' ' + ct.color + ' ' + ct.border + ' border">';
                    html += ct.emoji + ' ' + escapeHtml(val);
                    html += '</span>';
                }
            }
            if (!hasCards) {
                html += '<span class="text-[0.6rem] text-corp-dim italic">Нет раскрытых карт</span>';
            }
            html += '</div>';

            html += '</div>';
        }
        html += '</div>';

        // Кнопка подтверждения
        html += '<button id="btn-bunker-confirm-vote" class="btn-neon-solid w-full py-4 rounded-2xl text-sm font-black uppercase tracking-wider cursor-pointer">';
        html += '✓ ПОДТВЕРДИТЬ ГОЛОС';
        html += '</button>';

        // Карты действия (фаза vote)
        var voteActionCards = [];
        var myActionCards = state.myActionCards || [];
        for (var vai = 0; vai < myActionCards.length; vai++) {
            if (myActionCards[vai].phase === 'vote' || myActionCards[vai].phase === 'any') {
                voteActionCards.push(myActionCards[vai]);
            }
        }
        if (voteActionCards.length > 0) {
            html += '<div id="bunker-vote-action-hand" class="mt-4">';
            html += '  <h3 class="text-xs font-bold text-accent-gold uppercase tracking-widest mb-2">⚡ Карты действия</h3>';
            html += '  <div class="flex gap-3 flex-wrap">';
            for (var vac = 0; vac < voteActionCards.length; vac++) {
                var vc = voteActionCards[vac];
                html += '<div class="bunker-action-card bunker-vote-action-btn flex-1 min-w-[160px] max-w-[240px] p-4"';
                html += '  data-action-id="' + escapeHtml(vc.id) + '"';
                html += '  data-action-type="' + escapeHtml(vc.type) + '"';
                html += '  data-needs-target="' + (vc.needsTarget ? 'true' : 'false') + '"';
                html += '  data-action-name="' + escapeHtml(vc.name) + '"';
                html += '  data-action-emoji="' + escapeHtml(vc.emoji) + '"';
                html += '  data-action-desc="' + escapeHtml(vc.desc) + '"';
                html += '>';
                html += '  <div class="bunker-action-card-corner">⚡</div>';
                html += '  <div class="text-3xl mb-2.5 relative z-10">' + escapeHtml(vc.emoji) + '</div>';
                html += '  <div class="text-xs font-black uppercase tracking-wider mb-2 relative z-10" style="color:#f5d060">' + escapeHtml(vc.name) + '</div>';
                html += '  <div class="text-[0.7rem] leading-relaxed relative z-10" style="color:rgba(230,210,150,0.9)">' + escapeHtml(vc.desc) + '</div>';
                html += '</div>';
            }
            html += '  </div>';
            html += '</div>';
        }
    }

    // Модальное окно для карт действия
    html += '<div id="vote-action-modal" class="fixed inset-0 z-50 hidden"><div class="absolute inset-0 bg-black/75 backdrop-blur-sm"></div><div class="relative flex items-center justify-center min-h-screen p-4"><div id="vote-action-modal-content" class="max-w-sm w-full corp-card-elevated p-5"></div></div></div>';

    // Хост: управление голосованием
    if (isHost) {
        html += '<div class="flex items-center justify-center gap-2 mt-4">';
        if (bunker.hostMode) {
            html += '<button id="btn-bunker-host-advance" class="btn-neon-solid px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer">🗳 Завершить голосование</button>';
        } else {
            html += '<button id="btn-bunker-pause" class="btn-neon px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">';
            html += paused ? '▶ Продолжить таймер' : '⏸ Пауза';
            html += '</button>';
        }
        html += '</div>';
    }

    html += '</div>'; // end bunker-main-col
    html += '</div>'; // end bunker-layout
    container.innerHTML = html;

    renderBunkerChat(container);

    // Выход
    var btnExitVote = container.querySelector('#btn-exit-vote');
    if (btnExitVote) btnExitVote.addEventListener('click', function () {
        if (window.confirm('Выйти из игры в главное меню?')) leaveRoom();
    });

    // Ведущий: исключить игрока из бункера прямо во время голосования
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

    // ═══════ VOTING LOGIC ═══════
    var selectedVote = null;

    var voteables = container.querySelectorAll('[data-voteable]');
    for (var j = 0; j < voteables.length; j++) {
        (function (el) {
            el.addEventListener('click', function () {
                selectedVote = el.getAttribute('data-bunker-vote');

                var indicators = container.querySelectorAll('.vote-indicator');
                for (var k = 0; k < indicators.length; k++) {
                    var ind = indicators[k];
                    var target = ind.getAttribute('data-vote-target');
                    var parentCard = ind.closest('.corp-card');
                    if (target === selectedVote) {
                        ind.classList.add('bg-accent-blue', 'border-accent-blue', 'text-white');
                        ind.textContent = '✓';
                        if (parentCard) parentCard.classList.add('border-accent-blue/30');
                    } else {
                        ind.classList.remove('bg-accent-blue', 'border-accent-blue', 'text-white');
                        ind.textContent = '';
                        if (parentCard) parentCard.classList.remove('border-accent-blue/30');
                    }
                }
            });
        })(voteables[j]);
    }

    var btnConfirm = container.querySelector('#btn-bunker-confirm-vote');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', function () {
            if (!selectedVote) {
                showNotification('Выберите кого кикнуть или пропустите!', 'error');
                return;
            }
            sendMsg({ type: 'bunkerVote', targetId: selectedVote });
            btnConfirm.disabled = true;
            btnConfirm.classList.add('opacity-50');
            btnConfirm.textContent = '✓ Голос отправлен';
            playSound('invest');
        });
    }

    var btnHostAdvanceVote = container.querySelector('#btn-bunker-host-advance');
    if (btnHostAdvanceVote) {
        btnHostAdvanceVote.addEventListener('click', function () {
            btnHostAdvanceVote.disabled = true;
            btnHostAdvanceVote.textContent = 'Подводим итоги...';
            sendMsg({ type: 'bunkerHostAdvance' });
        });
    }

    var btnPause = container.querySelector('#btn-bunker-pause');
    if (btnPause) {
        btnPause.addEventListener('click', function () {
            sendMsg({ type: 'bunkerPause' });
        });
    }

    // ═══════ Vote action cards ═══════
    var voteActionBtns = container.querySelectorAll('.bunker-vote-action-btn');
    for (var vab = 0; vab < voteActionBtns.length; vab++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var cardId = btn.getAttribute('data-action-id');
                var cardType = btn.getAttribute('data-action-type');
                var needsTarget = btn.getAttribute('data-needs-target') === 'true';
                var cardName = btn.getAttribute('data-action-name');
                var cardEmoji = btn.getAttribute('data-action-emoji');
                var cardDesc = btn.getAttribute('data-action-desc');

                openVoteActionFlow(container, { cardId: cardId, cardType: cardType, needsTarget: needsTarget, name: cardName, emoji: cardEmoji, desc: cardDesc });
            });
        })(voteActionBtns[vab]);
    }
}

function openVoteActionModal(container, contentHtml) {
    var modal = container.querySelector('#vote-action-modal');
    var content = container.querySelector('#vote-action-modal-content');
    if (!modal || !content) return;
    content.innerHTML = contentHtml;
    modal.classList.remove('hidden');

    var btnCancel = content.querySelector('#btn-vote-action-cancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', function () { modal.classList.add('hidden'); });
    }
    modal.addEventListener('click', function handler(e) {
        if (e.target === modal) { modal.classList.add('hidden'); modal.removeEventListener('click', handler); }
    });
}

function closeVoteActionModal(container) {
    var modal = container.querySelector('#vote-action-modal');
    if (modal) modal.classList.add('hidden');
}

function openVoteActionFlow(container, card) {
    var activePlayers = (state.bunker && state.bunker.activePlayers) || [];
    var myId = state.playerId;

    if (card.needsTarget) {
        // blackPR: pick active player (not self)
        var targets = [];
        for (var i = 0; i < activePlayers.length; i++) {
            if (activePlayers[i].id !== myId) targets.push(activePlayers[i]);
        }
        var html = '';
        html += '<div class="text-2xl mb-1 text-center">' + escapeHtml(card.emoji) + '</div>';
        html += '<div class="text-xs font-black text-accent-gold text-center mb-1">' + escapeHtml(card.name) + '</div>';
        html += '<div class="text-[0.6rem] text-corp-muted text-center mb-3">Выберите цель:</div>';
        if (targets.length === 0) {
            html += '<div class="text-xs text-accent-red text-center mb-3">Нет доступных целей</div>';
            html += '<div class="flex justify-center"><button id="btn-vote-action-cancel" class="btn-ghost px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Закрыть</button></div>';
            openVoteActionModal(container, html);
            return;
        }
        html += '<div class="space-y-1.5 mb-3 max-h-48 overflow-y-auto">';
        for (var j = 0; j < targets.length; j++) {
            html += '<button class="btn-vote-target w-full text-left px-3 py-2 rounded-xl corp-card hover:border-accent-gold/40 text-sm font-bold text-corp-light cursor-pointer transition-colors" data-target-id="' + escapeHtml(targets[j].id) + '">' + escapeHtml(targets[j].nickname) + '</button>';
        }
        html += '</div>';
        html += '<div class="flex justify-center"><button id="btn-vote-action-cancel" class="btn-ghost px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer">Отмена</button></div>';
        openVoteActionModal(container, html);

        var tBtns = container.querySelectorAll('#vote-action-modal-content .btn-vote-target');
        for (var tb = 0; tb < tBtns.length; tb++) {
            (function (tbtn) {
                tbtn.addEventListener('click', function () {
                    closeVoteActionModal(container);
                    sendMsg({ type: 'bunkerPlayActionCard', cardId: card.cardId, targetPlayerId: tbtn.getAttribute('data-target-id') });
                    playSound('start');
                });
            })(tBtns[tb]);
        }
    } else {
        // voteDouble: confirm
        var html2 = '<div class="text-center">';
        html2 += '<div class="text-4xl mb-2">' + escapeHtml(card.emoji) + '</div>';
        html2 += '<div class="text-sm font-black text-accent-gold mb-1">' + escapeHtml(card.name) + '</div>';
        html2 += '<div class="text-xs text-corp-muted mb-4">' + escapeHtml(card.desc) + '</div>';
        html2 += '<div class="flex gap-2 justify-center">';
        html2 += '<button id="btn-vote-action-cancel" class="btn-ghost px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Отмена</button>';
        html2 += '<button id="btn-vote-action-confirm" class="btn-neon px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Сыграть</button>';
        html2 += '</div></div>';
        openVoteActionModal(container, html2);
        var btnConfirm = container.querySelector('#btn-vote-action-confirm');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', function () {
                closeVoteActionModal(container);
                sendMsg({ type: 'bunkerPlayActionCard', cardId: card.cardId });
                playSound('start');
            });
        }
    }
}

// ═══════════════════════════════════════════
// ЭКРАН: Переголосование (bunkerTieVote)
// ═══════════════════════════════════════════

export function renderBunkerTieVote(container) {
    var bunker = state.bunker || {};
    var tiedPlayers = bunker.tiedPlayers || [];
    var myId = state.playerId;
    var isHost = state.isHost;
    var isEliminated = (bunker.eliminatedPlayers || []).includes(myId);

    var html = '';
    html += '<div class="max-w-3xl mx-auto px-4 py-8 min-h-screen">';

    html += '<div class="text-center mb-6">';
    html += '  <h2 class="text-xl font-black text-accent-red mb-2">⚔️ Ничья! Переголосование</h2>';
    html += '  <p class="text-xs text-corp-muted">Выберите одного из кандидатов</p>';
    html += '</div>';

    // Timer
    if (bunker.hostMode) {
        html += '<div class="text-center mb-6">';
        html += '  <div class="text-sm font-black text-accent-gold">🎙 Ведущий завершит переголосование вручную</div>';
        html += '</div>';
    } else {
        html += '<div class="text-center mb-6">';
        html += '  <div data-timer-text class="font-mono text-3xl font-black text-corp-white"></div>';
        html += '  <div class="max-w-xs mx-auto mt-2">';
        html += '    <div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
        html += '  </div>';
        html += '</div>';
    }

    if (isEliminated) {
        html += '<div class="corp-card p-6 text-center"><span class="text-corp-muted">Вы выбыли</span></div>';
    } else {
        html += '<div class="space-y-3 mb-6">';
        for (var i = 0; i < tiedPlayers.length; i++) {
            var p = tiedPlayers[i];
            var isSelf = p.id === myId;

            html += '<div class="corp-card p-4';
            if (isSelf) html += ' opacity-30';
            else html += ' cursor-pointer hover:border-accent-red/30 transition-colors';
            html += '" data-bunker-tie-vote="' + p.id + '"';
            if (!isSelf) html += ' data-tie-voteable';
            html += '>';

            html += '<div class="flex items-center justify-between">';
            html += '  <span class="text-sm font-bold text-accent-gold">' + escapeHtml(p.nickname);
            if (isSelf) html += ' (Вы)';
            html += '  </span>';
            if (!isSelf) {
                html += '  <div class="vote-indicator w-8 h-8 rounded-full border-2 border-corp-border flex items-center justify-center text-xs font-bold transition-all" data-tie-target="' + p.id + '"></div>';
            }
            html += '</div>';

            html += '</div>';
        }
        html += '</div>';

        html += '<button id="btn-bunker-tie-confirm" class="btn-neon-solid w-full py-4 rounded-2xl text-sm font-black uppercase tracking-wider cursor-pointer">';
        html += '✓ ПОДТВЕРДИТЬ';
        html += '</button>';
    }

    // Пауза / ведущий
    if (isHost) {
        html += '<div class="flex items-center justify-center gap-2 mt-4">';
        if (bunker.hostMode) {
            html += '<button id="btn-bunker-host-advance" class="btn-neon-solid px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer">🗳 Завершить переголосование</button>';
        } else {
            html += '<button id="btn-bunker-tie-pause" class="btn-neon px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">';
            html += bunker.paused ? '▶ Продолжить' : '⏸ Пауза';
            html += '</button>';
        }
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Logic
    var selectedTie = null;

    var tieVoteables = container.querySelectorAll('[data-tie-voteable]');
    for (var j = 0; j < tieVoteables.length; j++) {
        (function (el) {
            el.addEventListener('click', function () {
                selectedTie = el.getAttribute('data-bunker-tie-vote');
                var inds = container.querySelectorAll('.vote-indicator');
                for (var k = 0; k < inds.length; k++) {
                    var ind = inds[k];
                    var t = ind.getAttribute('data-tie-target');
                    if (t === selectedTie) {
                        ind.classList.add('bg-accent-red', 'border-accent-red', 'text-white');
                        ind.textContent = '✓';
                    } else {
                        ind.classList.remove('bg-accent-red', 'border-accent-red', 'text-white');
                        ind.textContent = '';
                    }
                }
            });
        })(tieVoteables[j]);
    }

    var btnConfirm = container.querySelector('#btn-bunker-tie-confirm');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', function () {
            if (!selectedTie) {
                showNotification('Выберите кандидата!', 'error');
                return;
            }
            sendMsg({ type: 'bunkerTieVote', targetId: selectedTie });
            btnConfirm.disabled = true;
            btnConfirm.classList.add('opacity-50');
            playSound('invest');
        });
    }

    var btnHostAdvanceTie = container.querySelector('#btn-bunker-host-advance');
    if (btnHostAdvanceTie) {
        btnHostAdvanceTie.addEventListener('click', function () {
            btnHostAdvanceTie.disabled = true;
            btnHostAdvanceTie.textContent = 'Подводим итоги...';
            sendMsg({ type: 'bunkerHostAdvance' });
        });
    }

    var btnPause = container.querySelector('#btn-bunker-tie-pause');
    if (btnPause) {
        btnPause.addEventListener('click', function () {
            sendMsg({ type: 'bunkerPause' });
        });
    }
}

// ═══════════════════════════════════════════
// ЭКРАН: Финал бункера (bunkerGameOver)
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// ЭКРАН: Финал бункера (bunkerGameOver)
// ═══════════════════════════════════════════

export function renderBunkerGameOver(container) {
    var bunker = state.bunker || {};
    var survivors = bunker.survivors || [];
    var eliminated = bunker.eliminated || [];
    var isHost = state.isHost;

    var html = '';
    html += '<div class="max-w-4xl mx-auto px-4 py-8 min-h-screen text-center">';

    html += '<div class="text-6xl mb-4" style="filter: drop-shadow(0 0 30px rgba(34,197,94,0.3));">🏠</div>';
    html += '<h1 class="text-3xl md:text-4xl font-black text-accent-green mb-2">БУНКЕР ОПРЕДЕЛЁН!</h1>';
    html += '<p class="text-sm text-corp-muted mb-8">Вот кто выжил и спасёт мир своими продуктами:</p>';

    // Глобальная проблема
    html += '<div class="corp-card border-accent-red/20 bg-accent-red-dim px-5 py-3 mb-6 text-left">';
    html += '  <div class="text-xs font-black text-accent-red uppercase tracking-widest mb-1">🌍 Глобальная проблема</div>';
    html += '  <div class="text-xs text-corp-light leading-relaxed">' + escapeHtml(bunker.globalProblem || '') + '</div>';
    html += '</div>';

    // Выжившие
    html += '<div class="mb-8">';
    html += '  <h3 class="text-xs font-bold text-accent-green uppercase tracking-widest mb-4">✅ Выжившие (' + survivors.length + ')</h3>';
    html += '  <div class="space-y-3">';
    for (var si = 0; si < survivors.length; si++) {
        html += renderBunkerPlayerFull(survivors[si], true);
    }
    html += '  </div>';
    html += '</div>';

    // Выбывшие
    html += '<div class="mb-8">';
    html += '  <h3 class="text-xs font-bold text-accent-red uppercase tracking-widest mb-4">❌ Выбывшие (' + eliminated.length + ')</h3>';
    html += '  <div class="space-y-3">';
    for (var ei = 0; ei < eliminated.length; ei++) {
        html += renderBunkerPlayerFull(eliminated[ei], false);
    }
    html += '  </div>';
    html += '</div>';

    // ═══════ AI PROMPT SECTION ═══════
    html += '<div class="corp-card border-accent-purple/20 bg-purple-900/10 p-6 mb-8">';
    html += '  <div class="flex items-center justify-center gap-3 mb-3">';
    html += '    <span class="text-3xl">🤖</span>';
    html += '    <div class="text-left">';
    html += '      <div class="text-sm font-black text-purple-400">Узнайте судьбу бункера!</div>';
    html += '      <div class="text-xs text-corp-dim leading-relaxed">Скопируйте промпт и вставьте в ChatGPT / Claude / любой ИИ — он расскажет, выжили ли вы на самом деле</div>';
    html += '    </div>';
    html += '  </div>';

    // Вердикт — главная кнопка: сразу после игры за столом хотят именно его,
    // а длинные разборы читает потом тот, кому интересно.
    html += '  <button id="btn-generate-prompt-verdict" class="btn-neon-solid w-full py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer mb-2">';
    html += '    ⚡ Вердикт за 30 секунд';
    html += '  </button>';

    html += '  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">';
    html += '    <button id="btn-generate-prompt" class="py-3 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer bg-blue-900/20 border border-blue-700/30 text-accent-blue hover:bg-blue-800/30 transition-colors">';
    html += '      🧠 Подробный';
    html += '    </button>';
    html += '    <button id="btn-generate-prompt-mini" class="py-3 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer bg-purple-900/20 border border-purple-700/30 text-purple-300 hover:bg-purple-800/30 transition-colors">';
    html += '      🎴 Мини по карточкам';
    html += '    </button>';
    html += '    <button id="btn-generate-prompt-impact" class="py-3 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer bg-cyan-900/20 border border-cyan-700/30 text-accent-cyan hover:bg-cyan-800/30 transition-colors">';
    html += '      🔬 Разбор изобретений';
    html += '    </button>';
    html += '  </div>';
    html += '  <div class="text-[0.6rem] text-corp-dim text-center mb-3 leading-relaxed">Вердикт — только исход, три абзаца, читается вслух.<br>Подробный — эпичная история на 1500+ слов. Мини — быстрый прогон по каждой карточке.<br>Разбор — экспертный отчёт: как карточки повлияли на саму катастрофу.</div>';

    // Скрытый контейнер для промпта
    html += '  <div id="ai-prompt-container" class="hidden">';
    html += '    <div class="relative">';
    html += '      <textarea id="ai-prompt-text" class="w-full h-64 p-4 bg-corp-black border border-purple-800/30 rounded-xl text-xs text-corp-light resize-y outline-none focus:border-purple-500/40 transition-colors leading-relaxed font-mono" readonly></textarea>';
    html += '      <button id="btn-copy-prompt" class="absolute top-2 right-2 px-3 py-1.5 rounded-lg bg-purple-900/50 border border-purple-700/30 text-purple-400 text-xs font-bold hover:bg-purple-800/50 transition-colors cursor-pointer">';
    html += '        📋 Копировать';
    html += '      </button>';
    html += '    </div>';
    html += '    <div id="copy-status" class="text-xs text-corp-muted mt-2"></div>';

    // Быстрые ссылки на ИИ
    html += '    <div class="flex flex-wrap items-center justify-center gap-2 mt-3">';
    html += '      <span class="text-xs text-corp-dim">Открыть:</span>';
    html += '      <a href="https://chat.openai.com/" target="_blank" class="px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-800/30 text-green-400 text-xs font-bold hover:bg-green-800/30 transition-colors">ChatGPT ↗</a>';
    html += '      <a href="https://claude.ai/" target="_blank" class="px-3 py-1.5 rounded-lg bg-amber-900/30 border border-amber-800/30 text-amber-400 text-xs font-bold hover:bg-amber-800/30 transition-colors">Claude ↗</a>';
    html += '      <a href="https://gemini.google.com/" target="_blank" class="px-3 py-1.5 rounded-lg bg-blue-900/30 border border-blue-800/30 text-blue-400 text-xs font-bold hover:bg-blue-800/30 transition-colors">Gemini ↗</a>';
    html += '    </div>';

    html += '  </div>'; // end prompt container
    html += '</div>'; // end AI section

    // Кнопки
    html += '<div class="flex flex-col items-center gap-4">';
    if (isHost) {
        html += '<button id="btn-bunker-play-again" class="btn-neon-solid px-12 py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">';
        html += '🔄 ИГРАТЬ ЕЩЁ';
        html += '</button>';
    }
    html += '<button id="btn-exit-bunker-over" class="text-xs font-bold text-corp-muted hover:text-accent-red transition-colors cursor-pointer">✕ Выйти в главное меню</button>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    // ═══════ LISTENERS ═══════

    var btn = container.querySelector('#btn-bunker-play-again');
    if (btn) {
        btn.addEventListener('click', function () {
            sendMsg({ type: 'playAgain' });
        });
    }

    var btnExit = container.querySelector('#btn-exit-bunker-over');
    if (btnExit) {
        btnExit.addEventListener('click', function () {
            leaveRoom();
        });
    }

    // Генерация промптов. Кнопок несколько, поэтому при клике по одной
    // остальные возвращаем в исходный вид — иначе на них копятся галочки
    // от прошлых нажатий и непонятно, какой промпт сейчас в поле.
    var promptButtons = [
        { id: '#btn-generate-prompt-verdict', idle: '⚡ Вердикт за 30 секунд', done: '✓ Вердикт готов!',       build: generateBunkerAIPromptVerdict },
        { id: '#btn-generate-prompt',         idle: '🧠 Подробный',            done: '✓ Промпт готов!',        build: generateBunkerAIPrompt },
        { id: '#btn-generate-prompt-mini',    idle: '🎴 Мини по карточкам',    done: '✓ Мини-промпт готов!',   build: generateBunkerAIPromptMini },
        { id: '#btn-generate-prompt-impact',  idle: '🔬 Разбор изобретений',   done: '✓ Разбор готов!',        build: generateBunkerAIPromptImpact },
    ];

    promptButtons.forEach(function (cfg) {
        var el = container.querySelector(cfg.id);
        if (!el) return;
        el.addEventListener('click', function () {
            var promptContainer = container.querySelector('#ai-prompt-container');
            var promptTextarea = container.querySelector('#ai-prompt-text');
            if (!promptContainer || !promptTextarea) return;

            promptButtons.forEach(function (other) {
                var otherEl = container.querySelector(other.id);
                if (otherEl) {
                    otherEl.textContent = other.idle;
                    otherEl.classList.remove('opacity-50');
                }
            });

            promptTextarea.value = cfg.build(bunker, survivors, eliminated);
            promptContainer.classList.remove('hidden');
            el.textContent = cfg.done;
            el.classList.add('opacity-50');

            var copyStatus = container.querySelector('#copy-status');
            if (copyStatus) copyStatus.textContent = '';

            // Скроллим к промпту
            promptContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            playSound('success');
        });
    });

    // Копирование промпта
    var btnCopy = container.querySelector('#btn-copy-prompt');
    if (btnCopy) {
        btnCopy.addEventListener('click', function () {
            var promptTextarea = container.querySelector('#ai-prompt-text');
            var copyStatus = container.querySelector('#copy-status');
            if (!promptTextarea) return;

            var text = promptTextarea.value;

            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function () {
                    btnCopy.textContent = '✓ Скопировано!';
                    btnCopy.classList.add('bg-accent-green/20', 'text-accent-green', 'border-accent-green/30');
                    if (copyStatus) copyStatus.textContent = 'Промпт скопирован! Вставьте его в любой ИИ-чат.';
                    playSound('success');
                    setTimeout(function () {
                        btnCopy.textContent = '📋 Копировать';
                        btnCopy.classList.remove('bg-accent-green/20', 'text-accent-green', 'border-accent-green/30');
                    }, 3000);
                }).catch(function () {
                    fallbackCopy(promptTextarea, copyStatus);
                });
            } else {
                fallbackCopy(promptTextarea, copyStatus);
            }
        });
    }
}

// ═══════════════════════════════════════════
// Фоллбэк копирования
// ═══════════════════════════════════════════

function fallbackCopy(textarea, statusEl) {
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    try {
        document.execCommand('copy');
        if (statusEl) statusEl.textContent = 'Скопировано через выделение! Вставьте в ИИ-чат.';
    } catch (e) {
        if (statusEl) statusEl.textContent = 'Выделите текст вручную (Ctrl+A) и скопируйте (Ctrl+C).';
    }
}

// ═══════════════════════════════════════════
// ГЕНЕРАТОР AI-ПРОМПТА
// ═══════════════════════════════════════════

function generateBunkerAIPrompt(bunker, survivors, eliminated) {
    var lines = [];

    lines.push('=== 🏠 ИННОВАЦИОННЫЙ ШИРПОТРЕБ — РЕЖИМ «БУНКЕР» ===');
    lines.push('');
    lines.push('Ты — драматичный и остроумный рассказчик постапокалиптического мира.');
    lines.push('Перед тобой результаты игры, где участники пытались попасть в бункер,');
    lines.push('имея при себе только свои абсурдные «инновационные продукты».');
    lines.push('');
    lines.push('Твоя задача — на основе ВСЕХ карточек каждого игрока определить,');
    lines.push('выживет ли человечество, и рассказать об этом ЯРКО, с ЮМОРОМ и ДЕТАЛЯМИ.');
    lines.push('');

    // Глобальная проблема
    lines.push('══════════════════════════════════════');
    lines.push('🌍 ГЛОБАЛЬНАЯ КАТАСТРОФА:');
    lines.push('══════════════════════════════════════');
    lines.push(bunker.globalProblem || 'Неизвестная угроза');
    lines.push('');

    // Выжившие
    lines.push('══════════════════════════════════════');
    lines.push('✅ ВЫЖИВШИЕ — ПОПАЛИ В БУНКЕР (' + survivors.length + ' чел.):');
    lines.push('══════════════════════════════════════');
    lines.push('');

    for (var si = 0; si < survivors.length; si++) {
        lines.push(formatPlayerForPrompt(survivors[si], si + 1));
    }

    // Выбывшие
    if (eliminated.length > 0) {
        lines.push('══════════════════════════════════════');
        lines.push('❌ ВЫБЫВШИЕ — НЕ ПОПАЛИ В БУНКЕР (' + eliminated.length + ' чел.):');
        lines.push('══════════════════════════════════════');
        lines.push('');

        for (var ei = 0; ei < eliminated.length; ei++) {
            lines.push(formatPlayerForPrompt(eliminated[ei], ei + 1));
        }
    }

    // Задание
    lines.push('══════════════════════════════════════');
    lines.push('📋 ТВОЁ ЗАДАНИЕ:');
    lines.push('══════════════════════════════════════');
    lines.push('');
    lines.push('1. 🏅 ОЦЕНКА ПОЛЕЗНОСТИ (для каждого выжившего):');
    lines.push('   — Оцени продукт по шкале 1-10: насколько он полезен при данной катастрофе?');
    lines.push('   — Учитывай ВСЕ карточки: прилагательное, предмет, особенность,');
    lines.push('     бонус к продукту, скрытый дефект, упаковку, первый отзыв и исторический факт.');
    lines.push('   — Исторический факт — это реальная история продукта или биография события с ним связанного.');
    lines.push('   — Объясни, как конкретно этот продукт помогает (или мешает) выживанию.');
    lines.push('');
    lines.push('2. 📖 ИСТОРИЯ ПЕРВОЙ НЕДЕЛИ В БУНКЕРЕ:');
    lines.push('   — Расскажи день за днём (или ключевыми моментами),');
    lines.push('     как продукты взаимодействовали друг с другом.');
    lines.push('   — Были ли конфликты? Неожиданные союзы? Курьёзные ситуации?');
    lines.push('   — Скрытые дефекты ОБЯЗАНЫ проявиться и создать проблемы!');
    lines.push('   — Отзывы клиентов должны оказаться пророческими.');
    lines.push('');
    lines.push('3. 👑 ЛИДЕР БУНКЕРА:');
    lines.push('   — Кто стал лидером и почему?');
    lines.push('   — Чей продукт оказался самым полезным в критический момент?');
    lines.push('');
    lines.push('4. ⚖️ ФИНАЛЬНЫЙ ВЕРДИКТ:');
    lines.push('   — Выжило ли человечество? (ДА / НЕТ / ЧАСТИЧНО)');
    lines.push('   — Благодаря кому конкретно? Или из-за кого всё провалилось?');
    lines.push('   — Какой продукт стал решающим?');
    lines.push('');
    lines.push('5. 🔮 АЛЬТЕРНАТИВНАЯ ИСТОРИЯ (бонус):');
    lines.push('   — Мог ли кто-то из ВЫБЫВШИХ изменить ход истории?');
    lines.push('   — Чей продукт из выбывших был бы полезнее, чем у кого-то из выживших?');
    lines.push('   — Был ли среди выбывших «тот самый», кого зря выгнали?');
    lines.push('');
    lines.push('══════════════════════════════════════');
    lines.push('⚡ СТИЛЬ:');
    lines.push('══════════════════════════════════════');
    lines.push('— Пиши ЯРКО, с чёрным юмором, но с элементами настоящей драмы.');
    lines.push('— Каждый продукт ОБЯЗАН быть обыгран — никаких пропусков.');
    lines.push('— Упоминай конкретные карточки игроков (дефекты, отзывы, особенности).');
    lines.push('— Сделай это эпичным — как будто это Netflix-сериал про бункер,');
    lines.push('  только вместо оружия у людей надувные чайники и съедобные носки.');
    lines.push('— Длина ответа: развёрнутый (минимум 1500 слов).');
    lines.push('');

    return lines.join('\n');
}

// ═══════════════════════════════════════════
// Форматирование одного игрока для промпта
// ═══════════════════════════════════════════

// Единый список карточек для всех промптов — и для вывода, и для подсчёта
var PROMPT_CARD_MAP = [
    { key: 'adjective', label: '🎨 Прилагательное' },
    { key: 'item', label: '📦 Предмет' },
    { key: 'modifier', label: '📜 Модификатор' },
    { key: 'feature', label: '✨ Особенность' },
    { key: 'gift', label: '🎁 Бонус к продукту' },
    { key: 'hiddenDefect', label: '⚠️ Скрытый дефект' },
    { key: 'packaging', label: '📦 Упаковка' },
    { key: 'review', label: '💬 Первый отзыв клиента' },
    { key: 'historicalFact', label: '📜 Исторический факт' },
];

var PROMPT_CARD_KEYS = PROMPT_CARD_MAP.map(function (c) { return c.key; });

function formatPlayerForPrompt(player, index) {
    var cards = player.cards || {};
    var lines = [];

    // Название продукта
    var productName = '';
    if (cards.adjective) productName += cards.adjective + ' ';
    if (cards.item) productName += cards.item;
    if (cards.modifier) productName += ' ' + cards.modifier;

    lines.push('--- Игрок #' + index + ': ' + (player.nickname || 'Неизвестный') + ' ---');
    lines.push('🏷 Продукт: ' + (productName.trim() || 'Не определён'));
    lines.push('');

    for (var i = 0; i < PROMPT_CARD_MAP.length; i++) {
        var val = cards[PROMPT_CARD_MAP[i].key];
        if (val) {
            lines.push('  ' + PROMPT_CARD_MAP[i].label + ': ' + val);
        }
    }

    lines.push('');
    return lines.join('\n');
}

// ═══════════════════════════════════════════
// ГЕНЕРАТОР МИНИ-ПРОМПТА (короткая версия)
// ═══════════════════════════════════════════

function generateBunkerAIPromptMini(bunker, survivors, eliminated) {
    var lines = [];

    lines.push('🏠 БУНКЕР: реши судьбу выживших — коротко и с юмором.');
    lines.push('Катастрофа: ' + (bunker.globalProblem || 'неизвестная угроза'));
    lines.push('');
    lines.push('══════════════════════════════════════');
    lines.push('✅ ВЫЖИВШИЕ — ПОПАЛИ В БУНКЕР (' + survivors.length + ' чел.):');
    lines.push('══════════════════════════════════════');
    lines.push('');
    for (var si = 0; si < survivors.length; si++) {
        lines.push(formatPlayerForPrompt(survivors[si], si + 1));
    }

    if (eliminated.length > 0) {
        lines.push('══════════════════════════════════════');
        lines.push('❌ ВЫБЫВШИЕ — НЕ ПОПАЛИ В БУНКЕР (' + eliminated.length + ' чел.):');
        lines.push('══════════════════════════════════════');
        lines.push('');
        for (var ei = 0; ei < eliminated.length; ei++) {
            lines.push(formatPlayerForPrompt(eliminated[ei], ei + 1));
        }
    }

    var totalCards = countPromptCards(survivors) + countPromptCards(eliminated);
    var totalPlayers = survivors.length + eliminated.length;

    lines.push('══════════════════════════════════════');
    lines.push('📋 ЗАДАНИЕ — быстро, но по КАЖДОЙ карточке:');
    lines.push('══════════════════════════════════════');
    lines.push('');
    lines.push('1. ПОКАРТОЧНЫЙ ПРОГОН — это главная часть ответа.');
    lines.push('   На каждого игрока — свой блок. Внутри блока');
    lines.push('   РОВНО ОДНА строка на каждую карточку, не длиннее 10 слов:');
    lines.push('');
    lines.push('   <карточка дословно> — <что она даёт при ЭТОЙ катастрофе> <✅ / 😐 / 💀>');
    lines.push('     ✅ спасает   😐 бесполезна   💀 губит');
    lines.push('');
    lines.push('   Закрывай блок строкой: ⇒ ИТОГ: <вердикт по продукту, 5-7 слов>');
    lines.push('');
    lines.push('   Пропускать карточки НЕЛЬЗЯ — упаковка, отзыв, бонус');
    lines.push('   и исторический факт идут наравне с предметом.');
    lines.push('   Всего карточек к разбору: ' + totalCards + ' у ' + totalPlayers + ' игроков.');
    lines.push('   Значков на строку — ровно один, без пояснений после него.');
    lines.push('');
    lines.push('2. Вердикт: ДА/НЕТ/ЧАСТИЧНО + одна конкретная цифра');
    lines.push('   (сколько % выжило или сколько дней продержались).');
    lines.push('');
    lines.push('3. MVP и FAIL — ссылайся на строки из пункта 1:');
    lines.push('   — Чей продукт спас (название + одна деталь из бонуса/упаковки)');
    lines.push('   — Чей дефект всех подставил (обыграй буквально)');
    lines.push('');
    lines.push('4. Самый абсурдный момент первой недели:');
    lines.push('   — Один абзац, не больше');
    lines.push('   — Обязательно упомяни ОТЗЫВ одного из игроков как пророчество');
    lines.push('');
    lines.push('5. Мог ли выбывший изменить всё? (1 предложение)');
    lines.push('');
    lines.push('Стиль:');
    lines.push('— Как стендап-комик пересказывает новости');
    lines.push('— Чёрный юмор + конкретика');
    lines.push('— Без «возможно», «вероятно» — только факты из параллельной реальности');
    lines.push('— В пункте 1 — только строки, никакой прозы и вступлений.');
    lines.push('— Пункты 2-5 держи сжатыми: рубленые фразы, без разгона и повторов.');
    lines.push('  Разбор из пункта 1 не сокращай ради краткости — он важнее.');

    return lines.join('\n');
}

// Сколько карточек реально роздано — нужно, чтобы задать модели
// честный объём разбора вместо абстрактного «коротко»
function countPromptCards(players) {
    var n = 0;
    for (var i = 0; i < players.length; i++) {
        var cards = players[i].cards || {};
        for (var k = 0; k < PROMPT_CARD_KEYS.length; k++) {
            if (cards[PROMPT_CARD_KEYS[k]]) n++;
        }
    }
    return n;
}

// ═══════════════════════════════════════════
// ГЕНЕРАТОР ПРОМПТА «ВЕРДИКТ»
// Самый короткий из четырёх: только исход, без покарточного разбора.
// На вход даётся сжатый состав — если вывалить все девять карт на игрока,
// модель начинает их перечислять и вердикт превращается в мини-промпт.
// ═══════════════════════════════════════════

function generateBunkerAIPromptVerdict(bunker, survivors, eliminated) {
    var lines = [];

    lines.push('=== 🏠 БУНКЕР — ФИНАЛЬНЫЙ ВЕРДИКТ ===');
    lines.push('');
    lines.push('Скажи одно: пережили они катастрофу с тем, что у них было, или нет.');
    lines.push('');
    lines.push('КАТАСТРОФА:');
    lines.push(bunker.globalProblem || 'Неизвестная угроза');
    lines.push('');

    lines.push('В БУНКЕРЕ (' + survivors.length + '):');
    for (var si = 0; si < survivors.length; si++) {
        lines.push(formatPlayerCompact(survivors[si]));
    }
    lines.push('');

    if (eliminated.length > 0) {
        lines.push('ОСТАЛИСЬ СНАРУЖИ (' + eliminated.length + '):');
        for (var ei = 0; ei < eliminated.length; ei++) {
            lines.push(formatPlayerCompact(eliminated[ei]));
        }
        lines.push('');
    }

    lines.push('══════════════════════════════════════');
    lines.push('📋 ЧТО НУЖНО — три абзаца, читается вслух за 30 секунд:');
    lines.push('══════════════════════════════════════');
    lines.push('');
    lines.push('1. ВЕРДИКТ первой строкой, заглавными:');
    lines.push('   ВЫЖИЛИ / ВЫЖИЛИ ЧАСТИЧНО / НЕ ВЫЖИЛИ');
    lines.push('   и сразу срок — сколько они продержались. Конкретная цифра.');
    lines.push('');
    lines.push('2. ПОЧЕМУ — 2-3 предложения.');
    lines.push('   Чего им хватило, чего не хватило, что стало последней каплей.');
    lines.push('   Говори о бункере как о целом: «у них было», «им не хватило».');
    lines.push('');
    lines.push('3. КТО ОКАЗАЛСЯ ЛИШНИМ — одна фраза.');
    lines.push('   Чьё присутствие ничего не изменило — или всё испортило.');
    lines.push('   Если зря выгнали кого-то из оставшихся снаружи — скажи это здесь.');
    lines.push('');
    lines.push('Всё. Больше ничего.');
    lines.push('');
    lines.push('🚫 НЕЛЬЗЯ:');
    lines.push('— Разбирать предметы по характеристикам. Это приговор, а не экспертиза.');
    lines.push('— Списков, таблиц, заголовков, оценок в баллах, процентов по каждому.');
    lines.push('— Хроники по дням и сцен из жизни бункера.');
    lines.push('— «Возможно» и «скорее всего». Вердикт выносится один раз и без оговорок.');
    lines.push('');
    lines.push('⚡ ТОН:');
    lines.push('— Как диктор, зачитывающий результат в прямом эфире: спокойно и окончательно.');
    lines.push('— Мрачно, но с сухой усмешкой. Абсурд предметов принимай как данность,');
    lines.push('  всерьёз и без подмигиваний.');
    lines.push('— Три абзаца максимум. Ни одного лишнего слова.');

    return lines.join('\n');
}

// Сжатая строка про игрока: название продукта и пара решающих для выживания
// деталей. Полный список карт здесь намеренно не разворачивается.
function formatPlayerCompact(player) {
    var cards = player.cards || {};

    var productName = '';
    if (cards.adjective) productName += cards.adjective + ' ';
    if (cards.item) productName += cards.item;
    if (cards.modifier) productName += ' ' + cards.modifier;
    productName = productName.trim() || 'продукт не определён';

    var parts = ['— ' + (player.nickname || 'Неизвестный') + ': ' + productName];
    if (cards.feature) parts.push('умеет: ' + cards.feature);
    if (cards.gift) parts.push('в комплекте: ' + cards.gift);
    if (cards.hiddenDefect) parts.push('дефект: ' + cards.hiddenDefect);

    return parts.join(' | ');
}

// ═══════════════════════════════════════════
// ГЕНЕРАТОР ПРОМПТА «РАЗБОР ИЗОБРЕТЕНИЙ»
// Не история выживания, а экспертиза: что каждая карточка сделала
// с самой катастрофой. Сознательно построен на другом каркасе,
// чем два промпта выше — там повествование, здесь отчёт.
// ═══════════════════════════════════════════

function generateBunkerAIPromptImpact(bunker, survivors, eliminated) {
    var lines = [];

    lines.push('=== 🔬 ИННОВАЦИОННЫЙ ШИРПОТРЕБ — ЭКСПЕРТИЗА ВОЗДЕЙСТВИЯ ===');
    lines.push('');
    lines.push('Ты — ведущий аналитик Комиссии по оценке последствий глобальной катастрофы.');
    lines.push('Твоя работа — не рассказывать истории, а РАЗБИРАТЬ МЕХАНИЗМЫ.');
    lines.push('Перед тобой реестр изобретений, оказавшихся в эпицентре событий.');
    lines.push('Установи, как каждое из них — и каждая отдельная его характеристика —');
    lines.push('повлияло на ход самой катастрофы.');
    lines.push('');
    lines.push('Пиши как эксперт, от точности отчёта которого зависит всё:');
    lines.push('сухо по форме, беспощадно по содержанию, драматично по сути.');
    lines.push('');

    // Явные рамки — иначе модель по инерции скатывается в «день первый, день второй»
    lines.push('══════════════════════════════════════');
    lines.push('🚫 РАМКИ ОТЧЁТА — НАРУШАТЬ ЗАПРЕЩЕНО:');
    lines.push('══════════════════════════════════════');
    lines.push('— НИКАКОЙ хронологии: ни «день первый», ни «первая неделя», ни «спустя месяц».');
    lines.push('— НИКАКИХ сцен выживания, диалогов, конфликтов и бункерного быта.');
    lines.push('— Не пересказывай, как людям жилось. Разбирай, что сделали ПРЕДМЕТЫ.');
    lines.push('— Не спрашивай «выжили ли они» — оценивай, что стало с САМОЙ КАТАСТРОФОЙ.');
    lines.push('— Никаких «возможно» и «наверное»: у эксперта выводы, а не догадки.');
    lines.push('— Без вступлений и извинений: начинай сразу с ШАГА 1.');
    lines.push('');

    // Объект экспертизы
    lines.push('══════════════════════════════════════');
    lines.push('🌍 ОБЪЕКТ ЭКСПЕРТИЗЫ — КАТАСТРОФА:');
    lines.push('══════════════════════════════════════');
    lines.push(bunker.globalProblem || 'Неизвестная угроза');
    lines.push('');

    // Реестр
    lines.push('══════════════════════════════════════');
    lines.push('🧾 РЕЕСТР ИЗОБРЕТЕНИЙ');
    lines.push('══════════════════════════════════════');
    lines.push('');
    lines.push('▼ ДОПУЩЕНЫ В БУНКЕР — сработали в полную силу (' + survivors.length + '):');
    lines.push('');
    for (var si = 0; si < survivors.length; si++) {
        lines.push(formatPlayerForPrompt(survivors[si], si + 1));
    }

    if (eliminated.length > 0) {
        lines.push('▼ ОТСЕЧЕНЫ — не были задействованы (' + eliminated.length + '):');
        lines.push('');
        for (var ei = 0; ei < eliminated.length; ei++) {
            lines.push(formatPlayerForPrompt(eliminated[ei], ei + 1));
        }
    }

    // Регламент
    lines.push('══════════════════════════════════════');
    lines.push('📋 РЕГЛАМЕНТ ЭКСПЕРТИЗЫ');
    lines.push('══════════════════════════════════════');
    lines.push('');
    lines.push('ШАГ 1. ДЕКОМПОЗИЦИЯ КАТАСТРОФЫ');
    lines.push('Разложи катастрофу на 3-5 конкретных поражающих факторов —');
    lines.push('что именно она убивает, ломает, отравляет или отнимает.');
    lines.push('Дай каждому короткое имя. Дальше ссылайся на них по этим именам:');
    lines.push('это система координат всего отчёта.');
    lines.push('');
    lines.push('ШАГ 2. ПОКАРТОЧНЫЙ РАЗБОР — ПО КАЖДОМУ ИЗОБРЕТЕНИЮ');
    lines.push('Выдай досье строго в таком виде:');
    lines.push('');
    lines.push('  ▸ ПРОДУКТ: <название> | автор: <ник> | статус: <в бункере / отсечён>');
    lines.push('');
    lines.push('    ОТДЕЛЬНАЯ СТРОКА НА КАЖДУЮ КАРТОЧКУ, формат:');
    lines.push('    <карточка дословно> → <какой поражающий фактор задевает и каким');
    lines.push('    именно физическим или социальным механизмом> → <↓ гасит / = нейтрально /');
    lines.push('    ↑ разгоняет> <сила 0-10>');
    lines.push('');
    lines.push('    ⚙️ СОВОКУПНЫЙ ЭФФЕКТ: одно плотное предложение — что продукт');
    lines.push('       целиком сделал с катастрофой.');
    lines.push('    🎯 РОЛЬ В ИСХОДЕ: переломная / весомая / фоновая / вредоносная');
    lines.push('');
    lines.push('Пропускать карточки запрещено — разбирается каждая, включая упаковку');
    lines.push('и исторический факт. Скрытый дефект и отзыв клиента идут наравне');
    lines.push('с остальными: часто именно они переворачивают итоговую оценку.');
    lines.push('Отсечённые изобретения разбираются так же подробно, но их вектор —');
    lines.push('это нереализованный потенциал, а не фактическое воздействие.');
    lines.push('');
    lines.push('ШАГ 3. ЦЕПНЫЕ РЕАКЦИИ');
    lines.push('Найди 3-4 связки, где изобретения РАЗНЫХ авторов сработали вместе.');
    lines.push('Формат: <продукт A> + <продукт B> = <что получилось на выходе>');
    lines.push('(синергия / взаимное гашение / незапланированный побочный эффект)');
    lines.push('Описывай механизм, а не сцену.');
    lines.push('');
    lines.push('ШАГ 4. РЕЙТИНГ ВЛИЯНИЯ');
    lines.push('Таблица всех изобретений по силе воздействия на катастрофу —');
    lines.push('от максимального к нулевому.');
    lines.push('Колонки: место | продукт | автор | вектор | оценка 0-10 | обоснование одной фразой.');
    lines.push('Отдельно назови:');
    lines.push('  🏆 РЕШАЮЩИЙ ФАКТОР — изобретение, без которого всё пошло бы иначе.');
    lines.push('  ☠️ КРИТИЧЕСКИЙ ПРОСЧЁТ — конкретная карточка, нанёсшая больше всего вреда.');
    lines.push('  🃏 НЕДООЦЕНЁННОЕ — то, чью роль никто не мог предугадать.');
    lines.push('');
    lines.push('ШАГ 5. СОСТОЯНИЕ КАТАСТРОФЫ НА МОМЕНТ ОТЧЁТА');
    lines.push('— Пройдись по каждому поражающему фактору из шага 1 и укажи его судьбу:');
    lines.push('  СНЯТ / ОСЛАБЛЕН / БЕЗ ИЗМЕНЕНИЙ / УСИЛЕН.');
    lines.push('— Изменила ли катастрофа свою природу? Во что она превратилась?');
    lines.push('— Итоговый статус одной строкой:');
    lines.push('  ЛОКАЛИЗОВАНА / СДЕРЖИВАЕТСЯ / НЕОБРАТИМА / ПЕРЕРОДИЛАСЬ ВО ЧТО-ТО ХУДШЕЕ.');
    lines.push('');

    if (eliminated.length > 0) {
        lines.push('ШАГ 6. ПЕРЕСЧЁТ ПО ОТСЕЧЁННЫМ');
        lines.push('По каждому отсечённому изобретению — одна строка:');
        lines.push('какой поражающий фактор оно закрывало и как изменился бы');
        lines.push('итоговый статус из шага 5, будь оно допущено.');
        lines.push('Без сожалений и морали — только расчёт.');
        lines.push('');
    }

    lines.push('══════════════════════════════════════');
    lines.push('⚡ ТРЕБОВАНИЯ К ТЕКСТУ:');
    lines.push('══════════════════════════════════════');
    lines.push('— Голос эксперта: точный, холодный, местами циничный.');
    lines.push('  Драма рождается из фактов, а не из прилагательных.');
    lines.push('— Каждое утверждение опирается на конкретную карточку, названную дословно.');
    lines.push('— Абсурдные предметы разбирай абсолютно всерьёз, с инженерной дотошностью —');
    lines.push('  в этом весь эффект. Ни разу не подмигивай читателю.');
    lines.push('— Держи структуру отчёта: заголовки шагов, досье, таблица. Это не эссе.');
    lines.push('— Объём: столько, сколько нужно на полный разбор всех карточек, без сокращений.');
    lines.push('');

    return lines.join('\n');
}

function renderBunkerPlayerFull(player, survived) {
    var html = '';
    var borderClass = survived ? 'border-accent-green/20' : 'border-accent-red/20 opacity-60';

    html += '<div class="corp-card p-4 text-left ' + borderClass + '">';
    html += '  <div class="text-base font-black ' + (survived ? 'text-accent-gold' : 'text-corp-dim line-through') + ' mb-2">';
    html += (survived ? '✅ ' : '❌ ') + escapeHtml(player.nickname);
    html += '  </div>';

    html += '  <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">';
    for (var ci = 0; ci < BUNKER_CARD_TYPES.length; ci++) {
        var ct = BUNKER_CARD_TYPES[ci];
        if (ct.key === 'historicalFact') continue;
        var val = player.cards ? player.cards[ct.key] : null;
        if (val) {
            html += '<div class="rounded-lg p-2 ' + ct.bg + ' ' + ct.border + ' border text-center">';
            html += '  <div class="text-[0.65rem] font-bold text-corp-dim uppercase">' + ct.emoji + ' ' + ct.label + '</div>';
            html += '  <div class="text-[0.6rem] font-bold ' + ct.color + '">' + escapeHtml(val) + '</div>';
            html += '</div>';
        }
    }
    html += '  </div>';
    var hfVal2 = player.cards ? player.cards['historicalFact'] : null;
    if (hfVal2) {
        html += '<div class="mt-1.5 rounded-lg p-2 bg-yellow-900/20 border border-yellow-700/30">';
        html += '  <div class="text-[0.65rem] font-bold text-corp-dim uppercase">📜 Исторический факт</div>';
        html += '  <div class="text-[0.6rem] font-bold text-yellow-300">' + escapeHtml(hfVal2) + '</div>';
        html += '</div>';
    }

    html += '</div>';
    return html;
}