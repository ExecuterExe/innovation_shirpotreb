import { state, escapeHtml } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';
import { showNotification } from '../components/notification.js';
import { playSound } from '../components/sound.js';
import { CARD_TYPES, renderCardGrid } from './presentation.js';

function bindExitButton(container) {
    var btn = container.querySelector('#btn-exit-game');
    if (btn) btn.addEventListener('click', function () {
        if (window.confirm('Выйти из игры в главное меню?')) leaveRoom();
    });
}

export function renderTied(container) {
    var tied = state.tiedPlayers || [];
    var details = state.investmentDetails || [];
    var streamer = state.settings && state.settings.streamerMode;

    var iAmTied = false;
    for (var ti = 0; ti < tied.length; ti++) {
        if (tied[ti].id === state.playerId) { iAmTied = true; break; }
    }

    var html = '';
    html += '<div class="max-w-4xl mx-auto px-4 py-8 min-h-screen relative">';
    html += '<button id="btn-exit-game" class="fixed top-4 right-4 z-20 px-2.5 py-1.5 rounded-lg border border-corp-border bg-corp-black/60 text-corp-muted hover:text-accent-red hover:border-accent-red/30 transition-colors text-xs font-bold cursor-pointer">✕</button>';

    // Header
    html += '<div class="text-center mb-6">';
    html += '<h2 class="font-display text-4xl font-black text-accent-red mb-3" style="text-shadow: 0 0 30px rgba(255,59,59,0.3);">⚔️ НИЧЬЯ!</h2>';
    html += '<p class="text-sm text-corp-muted mb-2">Несколько игроков набрали одинаковое количество инвестиций</p>';
    html += '<p class="text-xs text-corp-muted">Подготовьтесь к дополнительным выступлениям</p>';
    html += '</div>';

    // Timer
    html += '<div class="text-center mb-6">';
    html += '<div data-timer-text class="font-mono text-4xl font-black text-corp-white"></div>';
    html += '<div class="max-w-xs mx-auto mt-2">';
    html += '<div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
    html += '</div>';
    html += '</div>';

    // Ready progress
    html += '<div class="text-center mb-6">';
    html += '<div id="tb-ready-progress" class="text-sm font-semibold text-corp-muted"></div>';
    html += '</div>';

    // Tied players with cards
    html += '<div class="space-y-4 mb-8">';
    for (var i = 0; i < tied.length; i++) {
        var tp = tied[i];
        var isMe = tp.id === state.playerId;

        html += '<div class="corp-card p-5';
        if (isMe) html += ' border-accent-red/30';
        html += '">';

        html += '<div class="flex items-center gap-3 mb-3">';
        html += '<div class="px-4 py-1.5 rounded-lg bg-accent-red-dim border border-accent-red/20 text-accent-red font-black text-sm">';
        html += escapeHtml(tp.nickname);
        if (isMe) html += ' (Вы)';
        html += '</div>';
        html += '</div>';

        if (tp.cards) {
            html += '<div class="flex flex-wrap gap-2">';
            for (var ct = 0; ct < CARD_TYPES.length; ct++) {
                var ctype = CARD_TYPES[ct];
                var cval = tp.cards[ctype.key];
                if (!cval) continue;
                var tagColors = [
                    'bg-red-900/30 text-red-400 border-red-800/30',
                    'bg-cyan-900/30 text-cyan-400 border-cyan-800/30',
                    'bg-purple-900/30 text-purple-400 border-purple-800/30',
                ];
                html += '<span class="text-xs font-bold px-3 py-1.5 rounded-lg border ' + (tagColors[ct] || tagColors[0]) + '">';
                html += escapeHtml(cval) + '</span>';
            }
            html += '</div>';
        }

        html += '</div>';
    }
    html += '</div>';

    // Мои карточки + textarea + кнопка ОТПРАВИТЬ (только для участников ничьи)
    if (iAmTied) {
        html += '<div class="corp-card border-accent-red/20 p-6 mb-8">';
        html += '<h3 class="text-sm font-black text-accent-red uppercase tracking-widest mb-4">🎯 Ваши карты — подготовьте аргумент</h3>';

        var myCards = state.myCards || {};
        var myCardList = [];
        for (var mc = 0; mc < CARD_TYPES.length; mc++) {
            var mtype = CARD_TYPES[mc];
            var mval = myCards[mtype.key];
            if (mval) myCardList.push({ label: mtype.label, value: mval, gradient: mtype.gradient, shadow: mtype.shadow });
        }
        html += renderCardGrid(myCardList, 'presentation');

        if (streamer) {
            html += '<div class="mt-6">';
            html += '<h4 class="text-sm font-bold text-accent-gold mb-2">📝 Дополнительный питч</h4>';
            html += '<textarea id="tb-pitch-textarea" class="w-full h-32 p-4 bg-corp-black border border-corp-border rounded-xl text-sm text-corp-light resize-y outline-none focus:border-accent-gold/40 transition-colors leading-relaxed" placeholder="Мой продукт лучше потому что..." maxlength="3000"></textarea>';
            html += '</div>';
        }

        // Кнопка отправить
        html += '<div class="mt-4 flex items-center justify-between">';
        html += '<div id="tb-send-status" class="text-xs text-corp-muted"></div>';
        html += '<button id="btn-tb-ready" class="btn-neon-solid px-8 py-3 rounded-xl text-sm font-black uppercase tracking-wider cursor-pointer">';
        html += '✓ Отправить и подтвердить готовность';
        html += '</button>';
        html += '</div>';

        // Confirmed banner
        html += '<div id="tb-confirmed" class="hidden mt-4 text-center py-3 rounded-xl bg-accent-green-dim border border-accent-green/20">';
        html += '<span class="text-accent-green text-sm font-bold">✓ Питч отправлен! Ожидание соперника...</span>';
        html += '</div>';

        html += '</div>';
    }

    // Investment details
    if (details.length > 0) {
        html += '<div class="mb-6">';
        html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-3">💸 Инвестиции раунда</h3>';
        html += '<div class="space-y-1.5">';
        for (var d = 0; d < details.length; d++) {
            html += '<div class="corp-card px-4 py-2.5 flex items-center justify-between text-xs flex-wrap gap-2">';
            html += '<span class="font-semibold text-corp-light">' + escapeHtml(details[d].from) + '</span>';
            html += '<span class="font-mono font-bold text-accent-blue">→ ' + details[d].amount + ' →</span>';
            html += '<span class="font-semibold text-corp-light">' + escapeHtml(details[d].to) + '</span>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    bindExitButton(container);

    // ═══════ BUTTON LISTENER ═══════
    var btnReady = container.querySelector('#btn-tb-ready');
    var tbTextarea = container.querySelector('#tb-pitch-textarea');
    var confirmed = container.querySelector('#tb-confirmed');

    if (btnReady) {
        btnReady.addEventListener('click', function () {
            var text = tbTextarea ? tbTextarea.value : '';

            console.log('[tiebreaker] Sending ready with text length:', text.length);

            // Отправляем текст + готовность одним сообщением
            sendMsg({ type: 'tiebreakerReady', text: text });

            // UI
            btnReady.textContent = '✓ Отправлено!';
            btnReady.disabled = true;
            btnReady.classList.add('opacity-50');
            if (tbTextarea) {
                tbTextarea.disabled = true;
                tbTextarea.classList.add('opacity-50');
            }
            if (confirmed) confirmed.classList.remove('hidden');
        });
    }
}

// ═══════ TIEBREAKER PRESENTATION ═══════

export function renderTiebreaker(container) {
    var pres = state.currentPresenter;
    if (!pres) return;

    var isHost = state.isHost;
    var isMe = pres.id === state.playerId;
    var streamer = state.settings && state.settings.streamerMode;

    // Сохраняем текст тайбрейкера если был textarea
    if (window._tbSavePitch) {
        window._tbSavePitch();
        window._tbSavePitch = null;
    }

    // Собираем карточки для рендера
    var presCards = [];
    for (var ct = 0; ct < CARD_TYPES.length; ct++) {
        var ctype = CARD_TYPES[ct];
        var cval = pres.cards[ctype.key];
        if (cval) {
            presCards.push({ label: ctype.label, value: cval, gradient: ctype.gradient, shadow: ctype.shadow });
        }
    }

    var html = '';
    html += '<div class="max-w-4xl mx-auto px-4 py-8 min-h-screen relative">';
    html += '<button id="btn-exit-game" class="fixed top-4 right-4 z-20 px-2.5 py-1.5 rounded-lg border border-corp-border bg-corp-black/60 text-corp-muted hover:text-accent-red hover:border-accent-red/30 transition-colors text-xs font-bold cursor-pointer">✕</button>';

    // Header
    html += '<div class="text-center mb-6">';
    html += '<h2 class="text-xl font-black text-accent-red mb-1">⚔️ Дополнительное выступление</h2>';
    html += '<p class="text-xs text-corp-muted">Докажите, что ваш продукт лучше!</p>';
    html += '</div>';

    // Timer
    html += '<div class="text-center mb-6">';
    html += '<div data-timer-text class="font-mono text-4xl font-black text-corp-white"></div>';
    html += '<div class="max-w-xs mx-auto mt-2">';
    html += '<div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
    html += '</div>';
    html += '</div>';

    // Stage
    var stageExtra = isMe ? ' spotlight-glow border-accent-blue/30' : '';
    html += '<div class="corp-card-elevated p-8 text-center mb-6' + stageExtra + '">';

    html += '<div class="text-xs text-corp-muted font-bold uppercase tracking-widest mb-2">Выступает</div>';
    html += '<h2 class="font-display text-3xl md:text-4xl font-black text-accent-gold mb-4" style="text-shadow: 0 0 30px rgba(255,215,0,0.2);">';
    html += escapeHtml(pres.nickname);
    html += '</h2>';

    if (isMe) {
        html += '<div class="inline-flex items-center gap-2 bg-accent-blue text-white px-5 py-2 rounded-full text-sm font-black uppercase tracking-wider mb-6 animate-glow-pulse">';
        html += '<span class="w-2 h-2 rounded-full bg-white/80 animate-ping"></span>';
        html += '🎤 ЭТО ВЫ!';
        html += '</div>';
    }

    // Pitch text
    if (streamer && pres.pitchText && pres.pitchText.trim()) {
        html += '<div class="text-left mb-6 max-w-2xl mx-auto">';
        html += '<div class="flex items-center gap-2 text-xs font-bold text-accent-gold uppercase tracking-widest mb-3">';
        html += '<span>📝</span> Текст питча';
        html += '</div>';
        html += '<div class="bg-corp-black/60 rounded-2xl p-6 border-l-3 border-accent-gold/40 text-sm text-corp-light leading-[1.8] whitespace-pre-wrap break-words">';
        html += escapeHtml(pres.pitchText);
        html += '</div>';
        html += '</div>';
    } else if (streamer) {
        html += '<div class="mb-4 text-sm text-corp-muted italic">(текст не написан — выступление голосом)</div>';
    }

    // Cards — крупные
    html += renderCardGrid(presCards, 'presentation');

    html += '</div>'; // end stage

    // Controls
    if (isHost) {
        html += '<div class="text-center mt-6">';
        html += '<button id="btn-tb-next" class="btn-neon-solid px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-wider cursor-pointer">';
        html += '⏭ Следующий';
        html += '</button>';
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    bindExitButton(container);

    container.querySelector('#btn-tb-next')?.addEventListener('click', function () {
        console.log('[tiebreaker] Next clicked');
        sendMsg({ type: 'nextTiebreakerPresenter' });
    });
}

// ═══════ TIEBREAKER VOTING ═══════

export function renderTiebreakerVoting(container) {
    var tied = state.tiedPlayers || [];

    var html = '';
    html += '<div class="max-w-3xl mx-auto px-4 py-8 min-h-screen relative">';
    html += '<button id="btn-exit-game" class="fixed top-4 right-4 z-20 px-2.5 py-1.5 rounded-lg border border-corp-border bg-corp-black/60 text-corp-muted hover:text-accent-red hover:border-accent-red/30 transition-colors text-xs font-bold cursor-pointer">✕</button>';

    html += '<div class="text-center mb-6">';
    html += '<h2 class="text-xl font-black text-corp-white mb-1">🗳 Переголосование</h2>';
    html += '<p class="text-xs text-corp-muted">Выберите, чей продукт лучше (нажмите на карточку)</p>';
    html += '</div>';

    // Timer
    html += '<div class="text-center mb-6">';
    html += '<div data-timer-text class="font-mono text-3xl font-black text-corp-white"></div>';
    html += '<div class="max-w-xs mx-auto mt-2">';
    html += '<div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
    html += '</div>';
    html += '</div>';

    // Vote options — с карточками
    html += '<div class="space-y-4 mb-8">';
    for (var i = 0; i < tied.length; i++) {
        var p = tied[i];
        var isSelf = p.id === state.playerId;

        html += '<div class="corp-card p-5';
        if (isSelf) html += ' opacity-30';
        else html += ' cursor-pointer hover:border-accent-blue/40 transition-colors';
        html += '" data-vote-id="' + p.id + '"';
        if (!isSelf) html += ' data-voteable';
        html += '>';

        html += '<div class="flex items-center justify-between gap-4 mb-3">';

        // Name
        html += '<div class="text-base font-bold text-accent-gold">';
        html += escapeHtml(p.nickname);
        if (isSelf) html += ' <span class="text-corp-muted text-sm font-normal">(Вы)</span>';
        html += '</div>';

        // Vote indicator
        if (!isSelf) {
            html += '<div class="vote-indicator w-9 h-9 rounded-full border-2 border-corp-border flex items-center justify-center text-sm font-bold transition-all flex-shrink-0" data-vote-target="' + p.id + '"></div>';
        }

        html += '</div>';

        // Cards
        if (p.cards) {
            html += '<div class="flex flex-wrap gap-2">';
            for (var ct = 0; ct < CARD_TYPES.length; ct++) {
                var ctype = CARD_TYPES[ct];
                var cval = p.cards[ctype.key];
                if (!cval) continue;
                var tagColors = [
                    'bg-red-900/30 text-red-400 border-red-800/30',
                    'bg-cyan-900/30 text-cyan-400 border-cyan-800/30',
                    'bg-purple-900/30 text-purple-400 border-purple-800/30',
                ];
                html += '<span class="text-xs font-bold px-3 py-1.5 rounded-lg border ' + (tagColors[ct] || tagColors[0]) + '">';
                html += escapeHtml(cval);
                html += '</span>';
            }
            html += '</div>';
        }

        html += '</div>';
    }
    html += '</div>';

    // Submit
    html += '<button id="btn-submit-tie-vote" class="btn-neon-solid w-full py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">';
    html += '✓ ПОДТВЕРДИТЬ ГОЛОС';
    html += '</button>';

    html += '</div>';
    container.innerHTML = html;
    bindExitButton(container);

    // ═══════ VOTING LOGIC ═══════
    var selectedVote = null;

    var voteables = container.querySelectorAll('[data-voteable]');
    for (var j = 0; j < voteables.length; j++) {
        (function (el) {
            el.addEventListener('click', function () {
                selectedVote = el.getAttribute('data-vote-id');

                var indicators = container.querySelectorAll('.vote-indicator');
                for (var k = 0; k < indicators.length; k++) {
                    var ind = indicators[k];
                    var targetId = ind.getAttribute('data-vote-target');
                    var parentCard = ind.closest('.corp-card');

                    if (targetId === selectedVote) {
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

    container.querySelector('#btn-submit-tie-vote')?.addEventListener('click', function () {
        console.log('[tb-voting] Submit vote:', selectedVote);
        var investments = [];
        if (selectedVote) investments.push({ targetId: selectedVote, amount: 1 });
        sendMsg({ type: 'submitTieInvestment', investments: investments });
        playSound('invest');
    });
}