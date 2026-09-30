import { state, escapeHtml } from '../app.js';
import { sendMsg, leaveRoom } from '../socket.js';
import { CARD_TYPES } from './presentation.js';
import { countUp, burst } from '../components/fx.js';
import { reactionEmoji } from '../components/reactions.js';
import { audienceResultHtml } from '../components/audience.js';
import { askConfirm } from '../components/confirm.js';
import { roastByHtml } from '../components/roast.js';

export function renderResults(container) {
    var winners = state.roundWinners || [];
    var details = state.investmentDetails || [];
    var lucky = state.luckyInvestors || [];
    var bestInvestor = state.roundBestInvestor;
    var players = state.players || [];
    var isHost = state.isHost;
    var isLast = state.isLastRound;
    var roast = !!state.roastRound;
    var gal = state.roundGallery;   // галерея «Испорченного прототипа»: побеждает кадр

    var byCapital = players.slice().sort(function (a, b) { return b.capital - a.capital; });
    var byAttracted = players.slice().sort(function (a, b) { return b.attractedInvestments - a.attractedInvestments; });

    var html = '';
    html += '<div class="max-w-5xl mx-auto px-4 py-8 min-h-screen res-page">';

    html += '<div class="flex items-start justify-between mb-8 gap-3 res-head">';
    html += '  <div class="w-0 flex-shrink-0 sm:w-[70px]"></div>';
    html += '  <h2 class="text-2xl font-black text-corp-white text-center flex-1">' + (roast ? '🔥 Итоги прожарки' : gal ? '🖼️ Итоги галереи' : 'Результаты раунда ' + state.currentRound) + '</h2>';
    html += '  <button id="btn-exit-game" class="flex-shrink-0 px-2.5 py-1.5 rounded-lg border border-corp-border text-corp-muted hover:text-accent-red hover:border-accent-red/30 transition-colors text-xs font-bold cursor-pointer">✕</button>';
    html += '</div>';

    // На широком экране — две колонки: слева кто победил, справа цифры и топы
    html += '<div class="res-grid"><div class="res-col res-col-main">';

    if (winners.length > 0 && !gal) {
        var mvp = winners[0];
        html += '<div class="corp-card ' + (roast ? 'roast-mvp ' : '') + 'border-accent-gold/35 bg-gradient-to-r from-accent-gold-dim to-accent-blue-dim p-6 mb-8 mvp-reveal">';
        html += '<div class="flex items-center justify-between gap-4 flex-wrap">';
        html += '<div>';
        html += '<div class="text-[0.65rem] font-black uppercase tracking-[0.12em] text-corp-muted mb-1">' + (roast ? 'Главный прожарщик' : gal ? 'Автор лучшего кадра' : 'MVP раунда') + '</div>';
        html += '<div class="text-2xl font-black text-accent-gold"><span class="crown-drop">' + (roast ? '🔥' : '👑') + '</span> ' + escapeHtml(mvp.nickname) + '</div>';
        if (roast) html += roastByHtml(mvp.roast, 'разнёс');
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
    // В галерее жетонов нет — вместо инвест-итогов любимый продукт и лучший кадр по реакциям
    html += '<div class="grid md:grid-cols-2 gap-4 mb-8 res-awards' + (gal ? ' hidden' : '') + '">';
    html += '<div class="corp-card border-accent-gold/30 bg-accent-gold-dim p-6 text-center">';
    if (winners.length > 0) {
        var winnerNames = [];
        for (var w = 0; w < winners.length; w++) winnerNames.push(escapeHtml(winners[w].nickname));
        html += '<div class="text-4xl mb-3">' + (roast ? '🔥' : '🏆') + '</div>';
        html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-2">' + (roast ? 'Самая разгромная прожарка' : gal ? 'Лучший кадр раунда' : 'Лучший предприниматель раунда') + '</div>';
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

    if (!gal) html += crowdFavoriteHtml(state.roundCrowdFavorite, 'раунда');
    html += audienceResultHtml(state.roundAudience);

    // ═══════ ГАЛЕРЕЯ: лучший кадр и кто что сделал ═══════
    if (gal) html += galleryResultsHtml(gal);

    // ═══════ WINNER RECAP ═══════
    if (winners.length > 0 && !gal) {
        html += '<div class="mb-8">';
        html += '<h3 class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-4">' + (roast ? '🔥 Что разнёс победитель' : '🎤 Что представил победитель') + '</h3>';
        html += '<div class="space-y-4">';
        for (var wr = 0; wr < winners.length; wr++) {
            var win = winners[wr];
            html += '<div class="corp-card p-5 border-accent-gold/20">';
            html += '<div class="flex items-center justify-between gap-4 flex-wrap mb-3">';
            html += '<div class="text-lg font-black text-accent-gold">' + escapeHtml(win.nickname) + '</div>';
            if (roast) html += roastByHtml(win.roast, 'разнёс');
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

    html += '</div><div class="res-col res-col-side">';

    // ═══════ INVESTMENT DETAILS ═══════
    html += '<div class="mb-8">';
    html += '<button id="btn-toggle-details" class="results-fold">💸 Кто и куда инвестировал' + (details.length ? ' <span>(' + details.length + ')</span>' : '') + ' <i id="details-arrow">▼</i></button>';
    html += '<div id="details-body" class="hidden mt-3">';
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
    html += '</div>'; // details-body
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
    html += '</div></div>'; // res-col-side, res-grid
    html += '</div>';

    // ═══════ CONTROLS ═══════
    if (isHost) {
        html += '<div class="results-dock">';
        if (isLast) {
            html += '<button id="btn-show-final" class="btn-neon-solid px-12 py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">';
            html += '🏆 Финальные результаты';
            html += '</button>';
        } else {
            html += '<button id="btn-next-round" class="btn-neon-solid px-12 py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">';
            // Дальше — финальная прожарка: пусть все это почувствуют заранее
            var roastNext = !!(state.settings && state.settings.roastFinal && !state.settings.bunkerMode && state.currentRound + 1 === state.totalRounds);
            html += roastNext ? '🔥 К финальной прожарке' : '⏭ Следующий раунд';
            html += '</button>';
        }
        html += '</div>';
    } else {
        html += '<div class="results-dock">';
        html += '<div class="results-dock-wait">';
        html += '<div class="w-4 h-4 border-2 border-corp-muted border-t-accent-blue rounded-full animate-spin"></div>';
        html += isLast ? 'Ведущий сейчас откроет финал…' : 'Ведущий запустит раунд ' + ((state.currentRound || 1) + 1) + ' из ' + (state.totalRounds || '?') + '…';
        html += '</div>';
        html += '</div>';
    }

    html += '</div>';

    container.innerHTML = html;
    // Цифры в топах набегают, вокруг MVP — конфетти, когда корона уже упала
    countUp(container);
    var mvpCard = container.querySelector('.mvp-reveal');
    if (mvpCard) setTimeout(function () { burst(mvpCard, { count: 22, spread: 220, lift: 60 }); }, 900);

    // ═══════ LISTENERS ═══════
    var btnExitGame = container.querySelector('#btn-exit-game');
    if (btnExitGame) btnExitGame.addEventListener('click', async function () {
        if (await askConfirm('Выйти из игры в главное меню?')) leaveRoom();
    });

    var btnDetails = container.querySelector('#btn-toggle-details');
    if (btnDetails) btnDetails.addEventListener('click', function () {
        var body = container.querySelector('#details-body');
        var arrow = container.querySelector('#details-arrow');
        if (!body) return;
        body.classList.toggle('hidden');
        if (arrow) arrow.style.transform = body.classList.contains('hidden') ? '' : 'rotate(180deg)';
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
        html += '<div class="font-mono font-black text-sm ' + valueClass + '" data-countup="' + (p[field] || 0) + '">' + (p[field] || 0) + '</div>';
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    return html;
}

// «Любимец зала» — кто собрал больше всего реакций во время своего выступления
export function crowdFavoriteHtml(fav, scope) {
    if (!fav) return '';
    var chips = '';
    var entries = Object.keys(fav.byEmotion || {}).filter(function (k) { return k !== 'tomato'; })
        .map(function (k) { return [k, fav.byEmotion[k]]; })
        .sort(function (a, b) { return b[1] - a[1]; });
    for (var i = 0; i < Math.min(entries.length, 4); i++) {
        chips += '<span class="crowd-meter-chip">' + reactionEmoji(entries[i][0]) + '<b>' + entries[i][1] + '</b></span>';
    }
    var html = '';
    html += '<div class="crowd-fav-card mb-8">';
    html += '  <div class="crowd-fav-emoji">' + (reactionEmoji(fav.topEmotion) || '🎭') + '</div>';
    html += '  <div class="flex-1 min-w-0">';
    html += '    <div class="text-[0.65rem] font-black uppercase tracking-[0.14em] text-corp-muted mb-1">🎭 Любимец зала ' + scope + '</div>';
    html += '    <div class="text-xl font-black text-corp-white truncate">' + escapeHtml(fav.nickname) + '</div>';
    html += '    <div class="text-xs text-corp-dim mt-0.5">' + fav.count + ' ' + pluralReactions(fav.count) + ' от зала во время выступления</div>';
    html += '  </div>';
    html += '  <div class="flex flex-wrap gap-1.5 justify-end">' + chips + '</div>';
    html += '</div>';
    return html;
}

function pluralReactions(n) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'реакция';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'реакции';
    return 'реакций';
}

function isWinnerTarget(targetId, winners) {
    for (var i = 0; i < winners.length; i++) {
        if (winners[i].id === targetId) return true;
    }
    return false;
}

// Галерея: любимый продукт зала, лучший кадр по реакциям и раскрытие авторов всех кадров
var EMO = { laugh: '😂', fire: '🔥', clap: '👏', mindblown: '🤯', scared: '😱', think: '🤔', money: '💸', tomato: '🍅', love: '❤️' };

function reactionsWord(n) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'реакция';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'реакции';
    return 'реакций';
}

function galleryResultsHtml(gal) {
    var html = '';
    var items = gal.items || [];
    var credit = {};
    (gal.credits || []).forEach(function (c) { credit[c.id] = c; });
    var drawingOf = function (it) { var f = it && it.frames.find(function (x) { return x.stage === 'drawing'; }); return f && f.image; };

    if (!gal.favorite && !(gal.winners && gal.winners.length)) {
        html += '<div class="corp-card p-6 mb-8 text-center"><div class="text-4xl mb-2">🤫</div><div class="text-sm font-bold text-corp-dim">Зал молчал — реакций не было. В следующий раз жмите эмодзи во время показа!</div></div>';
    }

    html += '<div class="gr-awards">';
    if (gal.favorite) {
        var fav = gal.favorite;
        var it = items[fav.index];
        html += '<div class="gr-best-card gr-fav">';
        html += '<div class="gr-award-kick">❤️ Любимый продукт зала</div>';
        html += '<img class="gr-best-art" src="' + (drawingOf(it) || '') + '" alt="">';
        html += '<div class="gr-best-meta"><b>' + (fav.name ? '«' + escapeHtml(fav.name) + '»' : 'Без названия') + '</b>';
        html += '<span>' + (EMO[fav.topEmotion] || '❤️') + ' ' + fav.likes + ' ' + reactionsWord(fav.likes) + ' · делали: ' + (fav.authors || []).map(function (a) { return a.emoji + ' <em>' + escapeHtml(a.author) + '</em>'; }).join(', ') + '</span></div>';
        html += '</div>';
    }
    (gal.winners || []).forEach(function (w) {
        html += '<div class="gr-best-card">';
        html += '<div class="gr-award-kick">🏆 Лучший кадр</div>';
        if (w.kind === 'draw') html += '<img class="gr-best-art" src="' + (w.image || '') + '" alt="' + escapeHtml(w.label) + '">';
        else html += '<div class="gr-best-text">«' + escapeHtml(w.text || '') + '»</div>';
        html += '<div class="gr-best-meta"><b>' + w.emoji + ' ' + escapeHtml(w.label) + (w.card ? ': ' + escapeHtml(w.card) : '') + '</b>';
        html += '<span>' + (w.productName ? '«' + escapeHtml(w.productName) + '» · ' : '') + 'автор <em>' + escapeHtml(w.author || '—') + '</em> · ' + (EMO[w.topEmotion] || '❤️') + ' ' + w.likes + '</span></div>';
        html += '</div>';
    });
    html += '</div>';

    // Кто собрал больше реакций за раунд
    if (gal.board && gal.board.length) {
        html += '<div class="gr-board mb-8">';
        gal.board.forEach(function (b, i) {
            html += '<span class="gr-board-row' + (b.id === state.playerId ? ' gr-board-me' : '') + '">' + (i === 0 && b.likes > 0 ? '👑 ' : '') + escapeHtml(b.nickname) + ' <b>❤️ ' + b.likes + '</b></span>';
        });
        html += '</div>';
    }

    if (items.length) {
        html += '<details class="gr-credits mb-8" open>';
        html += '<summary>🕵️ Кто что сделал — раскрываем авторов</summary>';
        items.forEach(function (it) {
            var name = (it.frames.find(function (f) { return f.stage === 'naming'; }) || {}).text || '';
            html += '<div class="gr-credits-product"><div class="gr-credits-name">' + (name ? '«' + escapeHtml(name) + '»' : '<i>Без названия</i>') + '</div><div class="gr-credits-frames">';
            it.frames.forEach(function (f) {
                var c = credit[f.id] || {};
                html += '<div class="gr-credit' + (c.likes ? ' gr-credit-hit' : '') + '">';
                if (f.kind === 'draw') html += '<img src="' + (f.image || '') + '" alt="">';
                else html += '<div class="gr-credit-text">' + (f.text ? '«' + escapeHtml(f.text) + '»' : '—') + '</div>';
                html += '<span>' + f.emoji + ' ' + escapeHtml(c.author || '—') + (c.likes ? ' · ❤️ ' + c.likes : '') + '</span>';
                html += '</div>';
            });
            html += '</div>';
            html += '<div class="gr-credits-truth">🃏 ' + ['adjective', 'item', 'modifier', 'feature', 'targetAudience', 'packaging'].map(function (k) { return it.cards && it.cards[k]; }).filter(Boolean).map(escapeHtml).join(' · ') + '</div>';
            html += '</div>';
        });
        html += '</details>';
    }
    return html;
}
