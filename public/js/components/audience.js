// ═══════════════════════════════════════════
// ЗРИТЕЛЬНЫЙ ЗАЛ
//  • окно «Позвать в комнату» с QR-кодом (играть / смотреть), в т.ч. на весь экран — для проектора
//  • панель зала в колонке участников: сколько зрителей, Twitch-чат, идёт ли голосование
//  • «Выбор зрителей»: зал (и Twitch-чат цифрами) выбирает лучший питч / кого спас бы в «Бункере»
//  • карточки итогов голосования и приза зрительских симпатий
// ═══════════════════════════════════════════
import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';
import { showNotification } from './notification.js';
import { qrSvg } from './qr.js';

function viewers() {
    return (state.spectators || []).filter(function (s) { return !s.isHost && s.connected !== false; });
}
export function viewerCount() { return viewers().length; }

function twitchOn() { return !!(state.twitch && state.twitch.channel); }
function twitchLive() { return twitchOn() && state.twitch.status === 'connected'; }

function roomLink(watch) {
    return location.origin + '/?room=' + (state.roomCode || '') + (watch ? '&watch=1' : '');
}

function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

// ─────────── окно с QR ───────────

var inviteMode = 'play';

export function openInviteModal(mode) {
    var inGame = state.phase !== 'lobby';
    inviteMode = inGame ? 'watch' : (mode || 'play');
    closeInviteModal();
    var wrap = document.createElement('div');
    wrap.id = 'invite-modal';
    wrap.className = 'inv-modal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Пригласить в комнату');
    document.body.appendChild(wrap);
    renderInvite();
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeInviteModal(); });
    document.addEventListener('keydown', escClose);
}

function escClose(e) { if (e.key === 'Escape') closeInviteModal(); }

export function closeInviteModal() {
    var m = document.getElementById('invite-modal');
    if (m) m.remove();
    document.removeEventListener('keydown', escClose);
}

function renderInvite() {
    var wrap = document.getElementById('invite-modal');
    if (!wrap) return;
    var inGame = state.phase !== 'lobby';
    var watch = inviteMode === 'watch';
    var link = roomLink(watch);
    var seats = (state.settings && state.settings.maxPlayers) || 8;
    var taken = (state.players || []).length;
    var big = wrap.classList.contains('inv-modal-big');

    var html = '<div class="inv-card">';
    html += '<button class="inv-close" id="inv-close" aria-label="Закрыть">✕</button>';
    if (!inGame) {
        html += '<div class="inv-tabs">';
        html += '<button class="inv-tab' + (!watch ? ' inv-tab-on' : '') + '" data-inv-mode="play">🎮 Играть</button>';
        html += '<button class="inv-tab' + (watch ? ' inv-tab-on' : '') + '" data-inv-mode="watch">👀 Смотреть</button>';
        html += '</div>';
    } else {
        html += '<div class="inv-kicker">👀 Зрительный зал</div>';
    }
    html += '<div class="inv-title">' + (watch ? 'Наведите камеру — и смотрите игру' : 'Наведите камеру — и садитесь за стол') + '</div>';
    html += '<div class="inv-qr">' + qrSvg(link, { size: big ? 520 : 260 }) + '</div>';
    html += '<div class="inv-code">Код комнаты <b>' + escapeHtml(state.roomCode || '') + '</b></div>';
    html += '<div class="inv-sub">' + (watch
        ? 'Зрители ставят реакции и выбирают лучший питч — счёт игроков это не меняет'
        : (taken >= seats ? 'Мест за столом нет — новые гости попадут в зрительный зал' : 'Свободно мест: ' + (seats - taken) + ' из ' + seats)) + '</div>';
    html += '<div class="inv-stats"><span>👀 В зале: <b>' + viewerCount() + '</b></span>' + (twitchOn() ? '<span>📺 twitch.tv/' + escapeHtml(state.twitch.channel) + '</span>' : '') + '</div>';
    html += '<div class="inv-actions">';
    html += '<button class="inv-btn" id="inv-copy">🔗 Скопировать ссылку</button>';
    html += '<button class="inv-btn" id="inv-big">' + (big ? '↙ Свернуть' : '⛶ На весь экран') + '</button>';
    html += '</div>';
    html += '</div>';
    wrap.innerHTML = html;

    wrap.querySelector('#inv-close').addEventListener('click', closeInviteModal);
    wrap.querySelectorAll('[data-inv-mode]').forEach(function (b) {
        b.addEventListener('click', function () { inviteMode = b.getAttribute('data-inv-mode'); renderInvite(); });
    });
    wrap.querySelector('#inv-copy').addEventListener('click', function () {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link)
                .then(function () { showNotification('🔗 Ссылка скопирована', 'success'); })
                .catch(function () { showNotification(link, 'info'); });
        } else showNotification(link, 'info');
    });
    wrap.querySelector('#inv-big').addEventListener('click', function () {
        wrap.classList.toggle('inv-modal-big');
        renderInvite();
    });
}

// Счётчик зала в открытом окне обновляется вместе с залом
function refreshInvite() { if (document.getElementById('invite-modal')) renderInvite(); }

// ─────────── QR комнаты в колонке участников ───────────
// Висит всю партию под реакциями: зритель стрима или человек в зале сканирует его сам.
// Ведёт «смотреть» — по нему не сядут за стол в следующей партии. Ведущий выключает его
// настройкой «QR-код комнаты на экране»; тогда здесь остаётся только кнопка с окном QR.
// Строки под QR — сколько зрителей, Twitch-чат и идёт ли голосование зала.

export function audiencePanelHtml() {
    return '<div class="rail-panel rail-audience" id="rail-audience">' + audiencePanelInner() + '</div>';
}

function qrOnScreen() {
    return !!state.roomCode && !(state.settings && state.settings.qrOnScreen === false) && !state.codeHidden;
}

function audiencePanelInner() {
    var n = viewerCount();
    var a = state.audience;
    var qr = qrOnScreen();
    var html = '<div class="rail-head"><span>' + (qr ? '📱 Смотреть игру' : '👀 Зрительный зал') + '</span>'
        + '<span class="rail-count" title="Зрителей в зале">👀 ' + n + '</span></div>';
    if (qr) {
        html += '<button type="button" class="rail-qr-img" id="btn-aud-invite" title="Наведите камеру телефона — и смотрите игру. Нажмите, чтобы увеличить">'
            + qrSvg(roomLink(true), { size: 150 }) + '</button>';
        html += '<div class="rail-qr-code">Код <b>' + escapeHtml(state.roomCode || '') + '</b></div>';
    }
    if (twitchOn()) {
        var st = state.twitch.status;
        var label = st === 'connected' ? 'чат подключён' : st === 'not-found' ? 'канал не найден' : 'подключаемся…';
        html += '<div class="aud-twitch aud-twitch-' + escapeHtml(st) + '">📺 ' + escapeHtml(state.twitch.channel) + ' · ' + label + '</div>';
    }
    if (a && a.open) {
        html += '<div class="aud-live"><span class="aud-live-dot"></span>' + (a.kind === 'save' ? 'Зал выбирает, кого спасти' : 'Зал выбирает лучший питч') + ': <b>' + (a.count || 0) + '</b></div>';
        if (twitchLive()) {
            html += '<div class="aud-chat-hint">Чат: напишите номер</div><ol class="aud-chat-list">';
            (a.candidates || []).forEach(function (c, i) { html += '<li><b>' + (i + 1) + '</b> ' + escapeHtml(c.nickname) + '</li>'; });
            html += '</ol>';
        }
    }
    if (!qr) html += '<button class="aud-invite-btn" id="btn-aud-invite">📱 Позвать зрителей</button>';
    return html;
}

export function bindAudiencePanel(root) {
    var btn = (root || document).querySelector('#btn-aud-invite');
    if (btn) btn.addEventListener('click', function () { openInviteModal('watch'); });
}

// ─────────── «Выбор зрителей» — блок для зрителя ───────────

function canVote() {
    return !!state.isSpectator && !state.isHost;
}

export function audienceVoteHtml() {
    if (!canVote()) return '';
    return '<div id="audience-vote">' + audienceVoteInner() + '</div>';
}

function audienceVoteInner() {
    var a = state.audience;
    if (!a || !a.open) return '';
    var save = a.kind === 'save';
    var html = '<div class="aud-vote' + (save ? ' aud-vote-save' : '') + '">';
    html += '<div class="aud-vote-kicker">' + (save ? '💚 Голос зала' : '🎟 Выбор зрителей') + '</div>';
    html += '<div class="aud-vote-title">' + (save ? 'Кого бы вы оставили в бункере?' : 'Чей продукт понравился вам больше всех?') + '</div>';
    html += '<div class="aud-vote-sub">Счёт игроков это не меняет — у зала свой приз. Передумать можно до конца этапа.</div>';
    html += '<div class="aud-vote-grid">';
    (a.candidates || []).forEach(function (c, i) {
        var on = a.myVote === c.id;
        html += '<button class="aud-vote-opt' + (on ? ' aud-vote-on' : '') + '" data-aud-vote="' + escapeHtml(c.id) + '">';
        html += '<span class="aud-vote-num">' + (on ? '✓' : (i + 1)) + '</span><span class="aud-vote-name">' + escapeHtml(c.nickname) + '</span></button>';
    });
    html += '</div>';
    html += '<div class="aud-vote-count" id="aud-vote-count">' + countText(a) + '</div>';
    html += '</div>';
    return html;
}

function countText(a) {
    var n = a.count || 0;
    return 'Голосов зала: <b>' + n + '</b>' + (a.twitch ? ' · из них из Twitch-чата: ' + a.twitch : '');
}

export function bindAudienceVote(root) {
    (root || document).querySelectorAll('[data-aud-vote]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-aud-vote');
            if (!state.audience || !state.audience.open) return;
            state.audience.myVote = id;
            sendMsg({ type: 'audienceVote', targetId: id });
            refreshAudience();
        });
    });
}

// Обновить голосование и панель зала на месте (без перерисовки экрана)
export function refreshAudience(countOnly) {
    var vote = document.getElementById('audience-vote');
    if (vote) {
        var cnt = document.getElementById('aud-vote-count');
        if (countOnly && cnt && state.audience) cnt.innerHTML = countText(state.audience);
        else { vote.innerHTML = audienceVoteInner(); bindAudienceVote(vote); }
    }
    var panel = document.getElementById('rail-audience');
    if (panel) { panel.innerHTML = audiencePanelInner(); bindAudiencePanel(panel); }
    refreshInvite();
}

// ─────────── итоги ───────────

function namesHtml(list) {
    return list.map(function (c) { return '<b>' + escapeHtml(c.nickname || c) + '</b>'; }).join(' и ');
}

// Итог голосования зала за раунд (классика — лучший питч, «Бункер» — кого спас бы)
export function audienceResultHtml(res) {
    if (!res || !res.leaders || !res.leaders.length) return '';
    var save = res.kind === 'save';
    var tie = res.leaders.length > 1;
    var votes = res.leaders[0].votes;
    var html = '<div class="aud-result' + (save ? ' aud-result-save' : '') + '">';
    html += '<div class="aud-result-icon">' + (save ? '💚' : '🎟') + '</div>';
    html += '<div class="aud-result-body">';
    html += '<div class="aud-result-kicker">' + (save ? 'Зал спас бы' : 'Выбор зрителей') + (tie ? ' · ничья' : '') + '</div>';
    html += '<div class="aud-result-name">' + namesHtml(res.leaders) + '</div>';
    html += '<div class="aud-result-sub">' + votes + ' ' + plural(votes, 'голос', 'голоса', 'голосов') + (tie ? ' у каждого' : '') + ' из ' + res.total
        + (res.twitch ? ' · 📺 из чата: ' + res.twitch : '') + '</div>';
    html += '</div></div>';
    return html;
}

// Приз зрительских симпатий за партию
export function audiencePrizeHtml(prize) {
    if (!prize || !prize.nicknames || !prize.nicknames.length) return '';
    var html = '<div class="aud-result aud-prize">';
    html += '<div class="aud-result-icon">🎟</div>';
    html += '<div class="aud-result-body">';
    html += '<div class="aud-result-kicker">Приз зрительских симпатий</div>';
    html += '<div class="aud-result-name">' + namesHtml(prize.nicknames) + '</div>';
    html += '<div class="aud-result-sub">' + prize.votes + ' ' + plural(prize.votes, 'голос', 'голоса', 'голосов') + ' зала за игру</div>';
    html += '</div></div>';
    return html;
}
