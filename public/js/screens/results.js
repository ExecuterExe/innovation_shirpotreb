import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';
import { CARD_TYPES } from './presentation.js';

export function renderResults(container) {
    var winners = state.roundWinners || [];
    var details = state.investmentDetails || [];
    var lucky = state.luckyInvestors || [];
    var players = state.players || [];
    var isHost = state.isHost;
    var isLast = state.isLastRound;

    var sorted = players.slice().sort(function (a, b) { return b.capital - a.capital; });

    var html = '';
    html += '<div class="max-w-3xl mx-auto px-4 py-8 min-h-screen">';

    html += '<h2 class="text-2xl font-black text-corp-white text-center mb-8">Результаты раунда ' + state.currentRound + '</h2>';

    // ═══════ WINNER BANNER ═══════
    html += '<div class="corp-card border-accent-gold/30 bg-accent-gold-dim p-8 text-center mb-8">';
    if (winners.length > 0) {
        var winnerNames = [];
        for (var w = 0; w < winners.length; w++) winnerNames.push(escapeHtml(winners[w].nickname));
        html += '<div class="text-5xl mb-4">🏆</div>';
        html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-2">Лучший предприниматель раунда</div>';
        html += '<div class="text-2xl font-black text-accent-gold">' + winnerNames.join(', ') + '</div>';
    } else {
        html += '<div class="text-5xl mb-4">😬</div>';
        html += '<div class="text-sm font-bold text-corp-dim">Никто не получил инвестиций в этом раунде</div>';
    }
    html += '</div>';

    // ═══════ INVESTMENT DETAILS ═══════
    html += '<div class="mb-8">';
    html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-4">💸 Инвестиции раунда</h3>';
    if (details.length === 0) {
        html += '<p class="text-sm text-corp-muted">Никто не инвестировал</p>';
    } else {
        html += '<div class="space-y-2">';
        for (var d = 0; d < details.length; d++) {
            html += '<div class="corp-card px-5 py-3.5 flex items-center justify-between flex-wrap gap-3">';
            html += '<span class="font-semibold text-corp-light">' + escapeHtml(details[d].from) + '</span>';
            html += '<span class="font-mono font-bold text-accent-blue">→ ' + details[d].amount + ' жет. →</span>';
            html += '<span class="font-semibold text-corp-light">' + escapeHtml(details[d].to) + '</span>';
            html += '</div>';
        }
        html += '</div>';
    }
    html += '</div>';

    // ═══════ LUCKY INVESTORS ═══════
    if (lucky.length > 0) {
        html += '<div class="mb-8">';
        html += '<h3 class="text-xs font-bold text-accent-green uppercase tracking-widest mb-4">🎰 Удачные инвестиции (×2)</h3>';
        html += '<div class="space-y-2">';
        for (var l = 0; l < lucky.length; l++) {
            html += '<div class="corp-card border-accent-green/15 bg-accent-green-dim px-5 py-3.5">';
            html += '<span class="text-sm font-semibold text-accent-green">';
            html += '✓ ' + escapeHtml(lucky[l].investorName) + ' вложил ' + lucky[l].invested;
            html += ' в ' + escapeHtml(lucky[l].targetName) + ' → получил ' + lucky[l].reward + ' жетонов';
            html += '</span>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }

    // ═══════ SCOREBOARD ═══════
    html += '<div class="mb-8">';
    html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-4">📊 Таблица</h3>';

    html += '<div class="grid grid-cols-[2fr_1fr_1fr] px-5 py-2 text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">';
    html += '<span>Игрок</span>';
    html += '<span class="text-center">Капитал</span>';
    html += '<span class="text-center">Привлечено</span>';
    html += '</div>';

    html += '<div class="space-y-1.5">';
    for (var s = 0; s < sorted.length; s++) {
        var p = sorted[s];
        var isMe = p.id === state.playerId;
        var medal = s === 0 ? '🥇 ' : s === 1 ? '🥈 ' : s === 2 ? '🥉 ' : '';

        html += '<div class="corp-card grid grid-cols-[2fr_1fr_1fr] px-5 py-3.5 items-center';
        if (isMe) html += ' border-accent-gold/20';
        html += ' scoreboard-row-enter" style="animation-delay: ' + (s * 0.08) + 's">';

        html += '<span class="font-bold text-sm text-corp-light">' + medal + escapeHtml(p.nickname);
        if (isMe) html += ' <span class="text-accent-blue text-xs">(Вы)</span>';
        html += '</span>';

        html += '<span class="text-center font-mono font-bold text-accent-green text-sm">' + p.capital + '</span>';
        html += '<span class="text-center font-mono font-bold text-accent-gold text-sm">' + p.attractedInvestments + '</span>';
        html += '</div>';
    }
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