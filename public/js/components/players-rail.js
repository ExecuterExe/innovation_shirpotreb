// ═══════════════════════════════════════════
// КОЛОНКА УЧАСТНИКОВ — слева на всех экранах игры
// Строка на игрока: аватар, имя, что он сейчас делает, капитал.
// Сюда же всплывают реакции (components/reactions.js), внизу — панель реакций.
// На узких экранах колонка становится лентой сверху (см. style.css, «КОЛОНКА УЧАСТНИКОВ»).
// ═══════════════════════════════════════════
import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';
import { buildReactionBarHtml, bindReactionButtons } from './reactions.js';
import { audiencePanelHtml, bindAudiencePanel } from './audience.js';
import { BUNKER_CARD_TYPES, openBunkerPlayerDetail, getBunkerRevealedValue } from '../screens/bunker-game.js';

var BUNKER_PHASES = ['bunkerDraft', 'bunkerReveal', 'bunkerVote', 'bunkerTieVote', 'bunkerVoteResult', 'bunkerGameOver'];

// Цвет аватара стабилен для игрока на всю партию
function hueFor(id) {
    var h = 0;
    var s = String(id || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
}

// В режиме стримера с шифровкой участников на сцене — псевдонимы. Колонка обязана
// показывать их же, иначе строка «🎤 выступает» выдаёт, кто скрыт за псевдонимом.
function isAnonymized() {
    var s = state.settings || {};
    return !!(s.streamerMode && s.anonymizeParticipants);
}

// Имя из порядка выступлений: сервер уже подставил туда псевдоним, если шифровка включена
function displayName(p) {
    // В «Бункере» шифровки нет, а порядок выступлений мог остаться от прошлой партии
    if (BUNKER_PHASES.indexOf(state.phase) !== -1) return p.nickname;
    var order = state.presentationOrder || [];
    for (var i = 0; i < order.length; i++) {
        if (order[i] && order[i].id === p.id && order[i].nickname) return order[i].nickname;
    }
    return isAnonymized() ? 'Игрок' : p.nickname;
}

function avatarHtml(p) {
    var hue = hueFor(p.id);
    var letter = (displayName(p) || '?').trim().charAt(0).toUpperCase() || '?';
    return '<span class="rail-avatar" style="background:linear-gradient(135deg,hsl(' + hue + ',55%,32%),hsl(' + ((hue + 40) % 360) + ',55%,22%));color:hsl(' + hue + ',85%,82%)">' + escapeHtml(letter) + '</span>';
}

function idsOf(list) {
    return (list || []).map(function (x) { return typeof x === 'object' ? x.id : x; });
}

// Порядок строк: как выступают/ходят, в итогах — по капиталу
function orderedPlayers() {
    var players = (state.players || []).slice();
    var phase = state.phase;
    if (phase === 'results' || phase === 'gameOver') {
        return players.sort(function (a, b) { return (b.capital || 0) - (a.capital || 0); });
    }
    var order = BUNKER_PHASES.indexOf(phase) !== -1
        ? idsOf(state.bunker && state.bunker.revealOrder)
        : idsOf(state.presentationOrder);
    if (!order.length) return players;
    return players.sort(function (a, b) {
        var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
}

// Что игрок делает прямо сейчас: { icon, text, tone }
function classicStatus(p) {
    var phase = state.phase;
    if (p.connected === false) return { icon: '📴', text: 'не в сети', tone: 'muted' };
    if (phase === 'preparation') {
        return (state.readyIds || []).indexOf(p.id) !== -1
            ? { icon: '✓', text: 'готов к питчу', tone: 'green' }
            : { icon: '✍️', text: 'готовит питч', tone: 'dim' };
    }
    if (phase === 'cardInput') return { icon: '✍️', text: 'придумывает карту', tone: 'dim' };
    if (phase === 'presentation') {
        var order = idsOf(state.presentationOrder);
        var idx = order.indexOf(p.id);
        var cur = state.presenterIndex || 0;
        if (state.currentPresenter && state.currentPresenter.id === p.id) {
            return state.presentationStage === 'questions'
                ? { icon: '🙋', text: 'отвечает на вопросы', tone: 'gold' }
                : { icon: '🎤', text: 'выступает', tone: 'gold' };
        }
        if (idx !== -1 && idx < cur) return { icon: '✓', text: 'выступил', tone: 'green' };
        if (idx !== -1) return { icon: '⏳', text: (idx - cur === 1 ? 'следующий' : 'в очереди · ' + (idx + 1)), tone: 'dim' };
        return { icon: '👂', text: 'слушает', tone: 'dim' };
    }
    if (phase === 'investing') {
        return (state.votedIds || []).indexOf(p.id) !== -1
            ? { icon: '✓', text: 'вложился', tone: 'green' }
            : { icon: '💼', text: 'выбирает проекты', tone: 'dim' };
    }
    if (phase === 'tied' || phase === 'tiebreaker' || phase === 'tiebreaker_voting') {
        var tied = idsOf(state.tiedPlayers);
        if (tied.indexOf(p.id) !== -1) return { icon: '⚔️', text: 'в ничьей', tone: 'red' };
        return { icon: '🗳', text: 'судит', tone: 'dim' };
    }
    if (phase === 'results' || phase === 'gameOver') {
        var winners = idsOf(state.roundWinners);
        if (phase === 'results' && winners.indexOf(p.id) !== -1) return { icon: '👑', text: 'MVP раунда', tone: 'gold' };
        return { icon: '📈', text: 'привлёк ' + (p.attractedInvestments || 0), tone: 'dim' };
    }
    return { icon: '•', text: '', tone: 'dim' };
}

function bunkerStatus(p) {
    var b = state.bunker || {};
    if (state.phase === 'bunkerDraft') {
        if (p.connected === false) return { icon: '📴', text: 'не в сети', tone: 'muted' };
        var done = ((state.bunkerDraft && state.bunkerDraft.doneIds) || []).indexOf(p.id) !== -1;
        return done ? { icon: '✓', text: 'собрал продукт', tone: 'green' } : { icon: '🃏', text: 'выбирает карты', tone: 'dim' };
    }
    if ((b.eliminatedPlayers || []).indexOf(p.id) !== -1) return { icon: '💀', text: 'выбыл', tone: 'red' };
    if (p.connected === false) return { icon: '📴', text: 'не в сети', tone: 'muted' };
    if (b.currentPlayerId === p.id && state.phase === 'bunkerReveal') return { icon: '🎤', text: 'ходит', tone: 'gold' };
    return { icon: '🏠', text: 'в бункере', tone: 'dim' };
}

function bunkerRevealedChips(p) {
    var revealed = ((state.bunker && state.bunker.revealedCards) || {})[p.id] || {};
    // В строке — не больше трёх карт, остальное по клику (иначе строка растягивается на пол-экрана)
    var html = '';
    var count = 0;
    for (var i = 0; i < BUNKER_CARD_TYPES.length; i++) {
        var ct = BUNKER_CARD_TYPES[i];
        if (!revealed[ct.key]) continue;
        count++;
        if (count > 3) continue;
        var val = p.id === state.playerId ? ((state.myCards || {})[ct.key] || '???') : getBunkerRevealedValue(p.id, ct.key);
        html += '<span class="rail-chip ' + ct.color + '" title="' + escapeHtml(ct.label + ': ' + val) + '">' + ct.emoji + ' ' + escapeHtml(val) + '</span>';
    }
    if (count > 3) html += '<span class="rail-chip rail-chip-more">+' + (count - 3) + '</span>';
    return { html: html, count: count };
}

function rowHtml(p, isBunker) {
    var isMe = p.id === state.playerId;
    var st = isBunker ? bunkerStatus(p) : classicStatus(p);
    var cls = 'rail-row';
    if (isMe) cls += ' rail-row-me';
    if (st.tone === 'gold') cls += ' rail-row-live';
    if (st.icon === '💀' || st.tone === 'muted') cls += ' rail-row-out';
    var clickable = isBunker && !isMe && state.phase !== 'bunkerDraft';
    if (clickable) cls += ' rail-row-click';

    var html = '<div class="' + cls + '" data-rail-player="' + p.id + '"' + (clickable ? ' data-rail-detail="' + p.id + '"' : '') + '>';
    html += avatarHtml(p);
    html += '<div class="rail-row-body">';
    html += '  <div class="rail-row-name"><span class="truncate">' + escapeHtml(displayName(p)) + '</span>' + (isMe ? '<span class="rail-you">вы</span>' : '') + '</div>';
    html += '  <div class="rail-row-status rail-tone-' + st.tone + '">' + st.icon + ' ' + escapeHtml(st.text) + '</div>';
    if (isBunker && st.icon !== '💀' && state.phase !== 'bunkerDraft') {
        var chips = bunkerRevealedChips(p);
        if (chips.count) html += '  <div class="rail-chips">' + chips.html + '</div>';
    }
    html += '</div>';
    if (isBunker && state.phase === 'bunkerDraft') {
        // на сборке продукта карт ещё нет — ни счётчика, ни кика
    } else if (isBunker) {
        var rc = bunkerRevealedChips(p).count;
        html += '<span class="rail-metric" title="Раскрыто карт">' + rc + '<small>/9</small></span>';
        var eliminated = ((state.bunker && state.bunker.eliminatedPlayers) || []).indexOf(p.id) !== -1;
        if (state.isHost && !isMe && !eliminated) {
            html += '<button class="rail-kick" data-rail-kick="' + p.id + '" data-rail-kick-name="' + escapeHtml(displayName(p)) + '" title="Исключить из бункера">🚫</button>';
        }
    } else {
        html += '<span class="rail-metric" title="Капитал">' + (p.capital !== undefined ? p.capital : '') + '<small>💰</small></span>';
    }
    html += '</div>';
    return html;
}

function rowsHtml() {
    var isBunker = BUNKER_PHASES.indexOf(state.phase) !== -1;
    var players = orderedPlayers();
    var html = '';
    // Ведущий без карт — отдельной строкой сверху
    var hostObserver = null;
    (state.spectators || []).forEach(function (s) { if (s.isHost) hostObserver = s; });
    if (state.isSpectator && state.isHost) hostObserver = { id: state.playerId, nickname: 'Вы' };
    if (hostObserver) {
        html += '<div class="rail-row rail-row-host" data-rail-player="' + hostObserver.id + '">';
        html += '<span class="rail-avatar rail-avatar-host">🎙</span>';
        html += '<div class="rail-row-body"><div class="rail-row-name"><span class="truncate">' + escapeHtml(hostObserver.nickname) + '</span></div>';
        html += '<div class="rail-row-status rail-tone-gold">ведёт игру</div></div>';
        html += '</div>';
    }
    for (var i = 0; i < players.length; i++) html += rowHtml(players[i], isBunker);
    return html;
}

export function mountRail(aside) {
    if (!aside) return;
    var count = (state.players || []).length;
    var html = '';
    html += '<div class="rail-panel rail-players">';
    html += '  <div class="rail-head"><span>👥 Участники</span><span class="rail-count">' + count + '</span></div>';
    html += '  <div class="rail-rows" id="rail-rows">' + rowsHtml() + '</div>';
    html += '</div>';
    html += '<div class="rail-panel rail-react">';
    html += '  <div class="rail-head"><span>Реакции</span><span class="rail-hint">клавиши 1–8</span></div>';
    html += buildReactionBarHtml();
    html += '</div>';
    html += audiencePanelHtml();
    html += '<div id="rail-extra"></div>';
    aside.innerHTML = html;
    bindReactionButtons(aside);
    bindAudiencePanel(aside);
    bindRows(aside);
}

// Обновить только строки (прогресс готовности/вложений), не трогая панель реакций
export function updateRail() {
    var rows = document.getElementById('rail-rows');
    if (!rows) return;
    rows.innerHTML = rowsHtml();
    bindRows(rows.parentNode);
}

function bindRows(root) {
    root.querySelectorAll('[data-rail-detail]').forEach(function (row) {
        row.addEventListener('click', function () {
            openBunkerPlayerDetail(row.getAttribute('data-rail-detail'));
        });
    });
    root.querySelectorAll('[data-rail-kick]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var name = btn.getAttribute('data-rail-kick-name') || 'игрока';
            if (!window.confirm('Исключить «' + name + '» из бункера? Это действие необратимо для текущей игры.')) return;
            sendMsg({ type: 'bunkerHostKick', targetPlayerId: btn.getAttribute('data-rail-kick') });
        });
    });
}
