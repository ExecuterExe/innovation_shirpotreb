import { state, escapeHtml } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';

export function renderGameOver(container) {
    var players = state.players || [];
    var bestInv = state.bestInvestor;
    var bestEnt = state.bestEntrepreneur;
    var isHost = state.isHost;

    var sorted = players.slice().sort(function (a, b) { return b.capital - a.capital; });

    var html = '';
    html += '<div class="max-w-3xl mx-auto px-4 py-8 min-h-screen text-center">';

    // Trophy
    html += '<div class="text-7xl mb-4 animate-float" style="filter: drop-shadow(0 0 30px rgba(255,215,0,0.3));">🏆</div>';
    html += '<h1 class="font-display text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-accent-gold via-yellow-300 to-accent-gold mb-2">ФИНАЛ</h1>';
    html += '<p class="text-sm text-corp-muted mb-10">Игра завершена! Вот наши победители:</p>';

    // Winner cards
    html += '<div class="flex flex-col md:flex-row gap-6 justify-center mb-10">';

    // Best Investor
    html += '<div class="corp-card-elevated flex-1 max-w-sm p-8 border-accent-green/20 hover:-translate-y-1 transition-transform">';
    html += '<div class="text-5xl mb-4">💼</div>';
    html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-1">Лучший инвестор</h3>';
    html += '<div class="text-[0.65rem] text-corp-dim mb-3">Больше всего личного капитала</div>';
    if (bestInv) {
        html += '<div class="text-2xl font-black text-accent-gold mb-1">' + escapeHtml(bestInv.nickname) + '</div>';
        html += '<div class="text-sm font-bold text-accent-green">💰 ' + bestInv.capital + ' жетонов</div>';
    } else {
        html += '<div class="text-corp-muted">—</div>';
    }
    html += '</div>';

    // Best Entrepreneur
    html += '<div class="corp-card-elevated flex-1 max-w-sm p-8 border-accent-gold/20 hover:-translate-y-1 transition-transform">';
    html += '<div class="text-5xl mb-4">🎤</div>';
    html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-1">Лучший предприниматель</h3>';
    html += '<div class="text-[0.65rem] text-corp-dim mb-3">Больше всего привлечённых инвестиций</div>';
    if (bestEnt) {
        html += '<div class="text-2xl font-black text-accent-gold mb-1">' + escapeHtml(bestEnt.nickname) + '</div>';
        html += '<div class="text-sm font-bold text-accent-gold">📈 ' + bestEnt.attracted + ' привлечённых</div>';
    } else {
        html += '<div class="text-corp-muted">—</div>';
    }
    html += '</div>';

    html += '</div>'; // end winner cards

    // Scoreboard
    html += '<div class="text-left mb-8">';
    html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-4 text-center">📊 Финальная таблица</h3>';

    html += '<div class="grid grid-cols-[2fr_1fr_1fr] px-5 py-2 text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">';
    html += '<span>Игрок</span>';
    html += '<span class="text-center">Капитал</span>';
    html += '<span class="text-center">Привлечено</span>';
    html += '</div>';

    html += '<div class="space-y-1.5">';
    for (var i = 0; i < sorted.length; i++) {
        var p = sorted[i];
        var isMe = p.id === state.playerId;
        var medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '';

        html += '<div class="corp-card grid grid-cols-[2fr_1fr_1fr] px-5 py-3.5 items-center';
        if (isMe) html += ' border-accent-gold/20';
        html += ' scoreboard-row-enter" style="animation-delay: ' + (i * 0.1) + 's">';

        html += '<span class="font-bold text-sm text-corp-light">' + medal + escapeHtml(p.nickname);
        if (isMe) html += ' <span class="text-accent-blue text-xs">(Вы)</span>';
        html += '</span>';

        html += '<span class="text-center font-mono font-bold text-accent-green text-sm">' + p.capital + '</span>';
        html += '<span class="text-center font-mono font-bold text-accent-gold text-sm">' + p.attractedInvestments + '</span>';
        html += '</div>';
    }
    html += '</div>';
    html += '</div>'; // end scoreboard

    // Controls
    html += '<div class="flex flex-col items-center gap-4">';
    if (isHost) {
        html += '<button id="btn-play-again" class="btn-neon-solid px-12 py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">';
        html += '🔄 ИГРАТЬ ЕЩЁ';
        html += '</button>';
    } else {
        html += '<div class="inline-flex items-center gap-3 text-sm text-corp-muted font-semibold">';
        html += '<div class="w-4 h-4 border-2 border-corp-muted border-t-accent-blue rounded-full animate-spin"></div>';
        html += 'Ожидание решения хоста...';
        html += '</div>';
    }
    html += '<button id="btn-exit-gameover" class="text-xs font-bold text-corp-muted hover:text-accent-red transition-colors cursor-pointer">✕ Выйти в главное меню</button>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    // Confetti
    launchConfetti();

    // Listener
    var btnPlayAgain = container.querySelector('#btn-play-again');
    if (btnPlayAgain) {
        btnPlayAgain.addEventListener('click', function () {
            console.log('[gameover] Play again clicked');
            sendMsg({ type: 'playAgain' });
        });
    }

    var btnExit = container.querySelector('#btn-exit-gameover');
    if (btnExit) {
        btnExit.addEventListener('click', function () {
            leaveRoom();
        });
    }
}

function launchConfetti() {
    var cont = document.getElementById('confetti-container');
    if (!cont) return;
    cont.innerHTML = '';

    var colors = ['#ff3b3b', '#ffd700', '#00b4ff', '#22d3ee', '#a29bfe', '#ff9ff3', '#22c55e'];

    for (var i = 0; i < 80; i++) {
        var piece = document.createElement('div');
        var size = Math.random() * 8 + 4;
        var duration = Math.random() * 3 + 2;
        var delay = Math.random() * 2;
        var left = Math.random() * 100;
        var color = colors[Math.floor(Math.random() * colors.length)];
        var radius = Math.random() > 0.5 ? '50%' : '2px';

        piece.style.cssText = 'position:fixed;width:' + size + 'px;height:' + size + 'px;background:' + color + ';left:' + left + 'vw;top:-10px;border-radius:' + radius + ';pointer-events:none;z-index:41;animation:confettiFall ' + duration + 's linear ' + delay + 's forwards;transform:rotate(' + (Math.random() * 360) + 'deg);';

        cont.appendChild(piece);
    }

    setTimeout(function () { cont.innerHTML = ''; }, 7000);
}