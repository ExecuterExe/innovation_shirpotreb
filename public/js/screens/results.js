import { state, escapeHtml } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';
import { CARD_TYPES } from './presentation.js';

export function renderResults(container) {
    var winners = state.roundWinners || [];
    var details = state.investmentDetails || [];
    var lucky = state.luckyInvestors || [];
    var bestInvestor = state.roundBestInvestor;
    var players = state.players || [];
    var isHost = state.isHost;
    var isLast = state.isLastRound;

    var byCapital = players.slice().sort(function (a, b) { return b.capital - a.capital; });
    var byAttracted = players.slice().sort(function (a, b) { return b.attractedInvestments - a.attractedInvestments; });

    var html = '';
    html += '<div class="max-w-5xl mx-auto px-4 py-8 min-h-screen">';

    html += '<div class="flex items-start justify-between mb-8 gap-3">';
    html += '  <div class="w-0 flex-shrink-0 sm:w-[70px]"></div>';
    html += '  <h2 class="text-2xl font-black text-corp-white text-center flex-1">Результаты раунда ' + state.currentRound + '</h2>';
    html += '  <button id="btn-exit-game" class="flex-shrink-0 px-2.5 py-1.5 rounded-lg border border-corp-border text-corp-muted hover:text-accent-red hover:border-accent-red/30 transition-colors text-xs font-bold cursor-pointer">✕</button>';
    html += '</div>';

    if (winners.length > 0) {
        var mvp = winners[0];
        html += '<div class="corp-card border-accent-gold/35 bg-gradient-to-r from-accent-gold-dim to-accent-blue-dim p-6 mb-8 mvp-reveal">';
        html += '<div class="flex items-center justify-between gap-4 flex-wrap">';
        html += '<div>';
        html += '<div class="text-[0.65rem] font-black uppercase tracking-[0.12em] text-corp-muted mb-1">MVP раунда</div>';
        html += '<div class="text-2xl font-black text-accent-gold">👑 ' + escapeHtml(mvp.nickname) + '</div>';
        if (bestInvestor && bestInvestor.totalSpent > 0) {
            html += '<div class="text-xs text-corp-light mt-2">Инвест-движ раунда: <span class="font-black text-accent-blue">' + escapeHtml(bestInvestor.nickname) + '</span></div>';
        }
        html += '</div>';
        html += '<div class="text-right">';
        html += '<div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">Статус</div>';
        html += '<div class="inline-flex items-center gap-2 mt-1 px-3 py-1 rounded-lg border border-accent-gold/30 bg-accent-gold/10 text-accent-gold text-xs font-black uppercase tracking-wider">Раунд закрыт</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }

    // ═══════ TOP BANNERS ═══════
    html += '<div class="grid md:grid-cols-2 gap-4 mb-8">';
    html += '<div class="corp-card border-accent-gold/30 bg-accent-gold-dim p-6 text-center">';
    if (winners.length > 0) {
        var winnerNames = [];
        for (var w = 0; w < winners.length; w++) winnerNames.push(escapeHtml(winners[w].nickname));
        html += '<div class="text-4xl mb-3">🏆</div>';
        html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-2">Лучший предприниматель раунда</div>';
        html += '<div class="text-xl font-black text-accent-gold">' + winnerNames.join(', ') + '</div>';
    } else {
        html += '<div class="text-4xl mb-3">😬</div>';
        html += '<div class="text-sm font-bold text-corp-dim">Никто не получил инвестиций в этом раунде</div>';
    }
    html += '</div>';

    html += '<div class="corp-card border-accent-blue/25 bg-accent-blue-dim p-6 text-center">';
    if (bestInvestor && bestInvestor.totalSpent > 0) {
        html += '<div class="text-4xl mb-3">💼</div>';
        html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-2">Лучший инвестор раунда</div>';
        html += '<div class="text-xl font-black text-accent-blue">' + escapeHtml(bestInvestor.nickname) + '</div>';
        html += '<div class="text-xs text-corp-light mt-2">Поставил: <span class="font-black">' + bestInvestor.totalSpent + '</span> • Угадал: <span class="font-black">' + bestInvestor.investedInWinners + '</span> • Получил: <span class="font-black text-accent-green">+' + bestInvestor.reward + '</span></div>';
    } else {
        html += '<div class="text-4xl mb-3">🧐</div>';
        html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-2">Лучший инвестор раунда</div>';
        html += '<div class="text-sm font-bold text-corp-dim">Явного лидера по инвестициям нет</div>';
    }
    html += '</div>';
    html += '</div>';

    // ═══════ WINNER RECAP ═══════
    if (winners.length > 0) {
        html += '<div class="mb-8">';
        html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-4">🎤 Что представил победитель</h3>';
        html += '<div class="space-y-4">';
        for (var wr = 0; wr < winners.length; wr++) {
            var win = winners[wr];
            html += '<div class="corp-card p-5 border-accent-gold/20">';
            html += '<div class="flex items-center justify-between gap-4 flex-wrap mb-3">';
            html += '<div class="text-lg font-black text-accent-gold">' + escapeHtml(win.nickname) + '</div>';
            html += '</div>';
            html += '<div class="flex flex-wrap gap-2">';
            var cards = win.cards || {};
            for (var ct = 0; ct < CARD_TYPES.length; ct++) {
                var ctype = CARD_TYPES[ct];
                var cval = cards[ctype.key];
                if (!cval) continue;
                var tagColors = [
                    'bg-red-900/30 text-red-400 border-red-800/30',
                    'bg-cyan-900/30 text-cyan-400 border-cyan-800/30',
                    'bg-purple-900/30 text-purple-400 border-purple-800/30',
                    'bg-amber-900/30 text-amber-400 border-amber-800/30',
                    'bg-green-900/30 text-green-400 border-green-800/30',
                ];
                var tagColor = tagColors[ct] || tagColors[0];
                html += '<span class="text-xs font-bold px-3 py-1 rounded-lg border ' + tagColor + '">' + escapeHtml(cval) + '</span>';
            }
            html += '</div>';
            if (win.pitchText && win.pitchText.trim()) {
                html += '<div class="mt-3 p-4 rounded-xl border border-accent-gold/20 bg-corp-black/40">';
                html += '<div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest mb-2">Текст питча</div>';
                html += '<div class="text-sm text-corp-light leading-relaxed whitespace-pre-wrap break-words">' + escapeHtml(win.pitchText) + '</div>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }

    // ═══════ INVESTMENT DETAILS ═══════
    html += '<div class="mb-8">';
    html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-4">💸 Кто и куда инвестировал</h3>';
    if (details.length === 0) {
        html += '<p class="text-sm text-corp-muted">Никто не инвестировал</p>';
    } else {
        var byInvestor = {};
        for (var d = 0; d < details.length; d++) {
            var from = details[d].fromId || ('n-' + d);
            if (!byInvestor[from]) byInvestor[from] = { name: details[d].from, total: 0, rows: [] };
            byInvestor[from].rows.push(details[d]);
            byInvestor[from].total += details[d].amount || 0;
        }

        var investorIds = Object.keys(byInvestor);
        html += '<div class="space-y-3">';
        for (var bi = 0; bi < investorIds.length; bi++) {
            var inv = byInvestor[investorIds[bi]];
            html += '<div class="corp-card p-4 border-accent-blue/15">';
            html += '<div class="flex items-center justify-between mb-3">';
            html += '<div class="text-sm font-black text-corp-light">💼 ' + escapeHtml(inv.name) + '</div>';
            html += '<div class="text-xs font-mono font-black text-accent-blue">всего: ' + inv.total + '</div>';
            html += '</div>';
            html += '<div class="space-y-2">';
            for (var r = 0; r < inv.rows.length; r++) {
                var row = inv.rows[r];
                var isHit = isWinnerTarget(row.toId, winners);
                html += '<div class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ';
                html += isHit ? 'border-accent-green/25 bg-accent-green-dim' : 'border-corp-border bg-corp-black/30';
                html += '">';
                html += '<span class="text-sm font-semibold text-corp-light">' + escapeHtml(row.to) + '</span>';
                html += '<span class="font-mono font-black ' + (isHit ? 'text-accent-green' : 'text-accent-blue') + '">' + row.amount + ' жет.</span>';
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';
    }
    html += '</div>';

    // ═══════ LUCKY INVESTORS ═══════
    if (lucky.length > 0) {
        html += '<div class="mb-8">';
        html += '<h3 class="text-xs font-bold text-accent-green uppercase tracking-widest mb-4">🎰 Кто поставил на победителя и что получил</h3>';
        html += '<div class="space-y-2">';
        for (var l = 0; l < lucky.length; l++) {
            html += '<div class="corp-card border-accent-green/20 bg-accent-green-dim px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">';
            html += '<span class="text-sm font-semibold text-accent-green">✓ ' + escapeHtml(lucky[l].investorName) + ' → ' + escapeHtml(lucky[l].targetName) + '</span>';
            html += '<span class="text-xs font-mono font-black text-accent-green">ставка ' + lucky[l].invested + ' • выплата +' + lucky[l].reward + '</span>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }

    // ═══════ LEADERBOARDS ═══════
    html += '<div class="mb-8">';
    html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-4">📊 Топы отдельно</h3>';
    html += '<div class="grid md:grid-cols-2 gap-4">';
    html += buildTopCard(byCapital, '💰 Топ по личному капиталу', 'capital', 'text-accent-blue');
    html += buildTopCard(byAttracted, '🧲 Топ по привлечённым инвестициям', 'attractedInvestments', 'text-accent-gold');
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // ═══════ CONTROLS ═══════
    if (isHost) {
        html += '<div class="text-center mt-10">';
        if (isLast) {
            html += '<button id="btn-show-final" class="btn-neon-solid px-12 py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">';
            html += '🏆 Финальные результаты';
            html += '</button>';
        } else {
            html += '<button id="btn-next-round" class="btn-neon-solid px-12 py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">';
            html += '⏭ Следующий раунд';
            html += '</button>';
        }
        html += '</div>';
    } else {
        html += '<div class="text-center mt-10">';
        html += '<div class="inline-flex items-center gap-3 text-sm text-corp-muted font-semibold">';
        html += '<div class="w-4 h-4 border-2 border-corp-muted border-t-accent-blue rounded-full animate-spin"></div>';
        html += 'Ожидание хоста...';
        html += '</div>';
        html += '</div>';
    }

    html += '</div>';

    container.innerHTML = html;

    // ═══════ LISTENERS ═══════
    var btnExitGame = container.querySelector('#btn-exit-game');
    if (btnExitGame) btnExitGame.addEventListener('click', function () {
        if (window.confirm('Выйти из игры в главное меню?')) leaveRoom();
    });

    var btnNext = container.querySelector('#btn-next-round');
    if (btnNext) {
        btnNext.addEventListener('click', function () {
            console.log('[results] Next round clicked');
            sendMsg({ type: 'nextRound' });
        });
    }

    var btnFinal = container.querySelector('#btn-show-final');
    if (btnFinal) {
        btnFinal.addEventListener('click', function () {
            console.log('[results] Show final clicked');
            sendMsg({ type: 'nextRound' });
        });
    }
}

function buildTopCard(sortedPlayers, title, field, valueClass) {
    var html = '';
    html += '<div class="corp-card p-4">';
    html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-3">' + title + '</div>';
    html += '<div class="space-y-2">';
    for (var i = 0; i < sortedPlayers.length; i++) {
        var p = sortedPlayers[i];
        var isMe = p.id === state.playerId;
        var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
        html += '<div class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ';
        html += isMe ? 'border-accent-blue/25 bg-accent-blue-dim' : 'border-corp-border bg-corp-black/30';
        html += '">';
        html += '<div class="text-sm font-semibold text-corp-light">' + medal + ' ' + escapeHtml(p.nickname);
        if (isMe) html += ' <span class="text-accent-blue text-xs">(Вы)</span>';
        html += '</div>';
        html += '<div class="font-mono font-black text-sm ' + valueClass + '">' + (p[field] || 0) + '</div>';
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    return html;
}

function isWinnerTarget(targetId, winners) {
    for (var i = 0; i < winners.length; i++) {
        if (winners[i].id === targetId) return true;
    }
    return false;
}