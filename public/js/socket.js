import { state, setState, navigate, startTimer } from './app.js';
import { showNotification } from './components/notification.js';
import { playSound } from './components/sound.js';
import { updatePlayersList, updateStartButton, updateSettingsPanel, updateRoomHeader } from './screens/lobby.js';
import { speakSequence, stopSpeaking } from './components/speech.js';
import { appendChatMsg, renderBunkerChat, removeChatMsgFromDom } from './components/bunker-chat.js';
import { setPendingReveal } from './screens/bunker-game.js';
import { resetWelcomeButtons } from './screens/welcome.js';

var ws = null;
var reconnectAttempts = 0;

export function connectWS() {
    updateConnectionUI('connecting');

    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + location.host;

    console.log('[WS] Connecting to:', url);

    try {
        ws = new WebSocket(url);
    } catch (e) {
        console.error('[WS] Creation error:', e);
        updateConnectionUI('disconnected');
        setTimeout(connectWS, 3000);
        return;
    }

    ws.onopen = function () {
        console.log('[WS] Connected');
        reconnectAttempts = 0;
        setState({ connected: true });
        updateConnectionUI('connected');

        // Пробуем автоматически переподключиться к игре
        if (state.playerId && state.roomCode) {
            console.log('[WS] Auto-reconnecting to', state.roomCode);
            ws.send(JSON.stringify({ type: 'reconnect', playerId: state.playerId, roomCode: state.roomCode }));
        } else {
            // Фолбек: проверяем sessionStorage (если страница была перезагружена)
            try {
                var saved = sessionStorage.getItem('gameSession');
                if (saved) {
                    var sess = JSON.parse(saved);
                    if (sess.playerId && sess.roomCode) {
                        console.log('[WS] Session-storage reconnect to', sess.roomCode);
                        setState({ playerId: sess.playerId, roomCode: sess.roomCode });
                        ws.send(JSON.stringify({ type: 'reconnect', playerId: sess.playerId, roomCode: sess.roomCode }));
                    }
                }
            } catch (e) { /* ignore */ }
        }
    };

    ws.onmessage = function (event) {
        try {
            var msg = JSON.parse(event.data);
            handleMessage(msg);
        } catch (e) {
            console.error('[WS] Parse error:', e);
        }
    };

    ws.onclose = function () {
        console.log('[WS] Disconnected');
        ws = null;
        setState({ connected: false });
        updateConnectionUI('disconnected');
        reconnectAttempts++;
        var delay = Math.min(3000 * reconnectAttempts, 15000);
        setTimeout(connectWS, delay);
    };

    ws.onerror = function () {
        console.error('[WS] Error');
    };
}

export function leaveRoom() {
    sendMsg({ type: 'leaveRoom' });
    try { sessionStorage.removeItem('gameSession'); } catch (e) {}
    setState({ playerId: null, roomCode: null, isSpectator: false, spectators: [] });
    navigate('welcome');
}

export function sendMsg(msg) {
    console.log('[WS] Sending:', msg.type);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    } else {
        showNotification('Нет соединения с сервером', 'error');
    }
}

function updateConnectionUI(status) {
    var el = document.getElementById('conn-status');
    if (!el) return;
    var dot = el.querySelector('.conn-dot');
    var text = el.querySelector('.conn-text');
    if (!dot || !text) return;

    if (status === 'connected') {
        dot.className = 'conn-dot bg-accent-green';
        text.textContent = 'Подключено';
        text.className = 'conn-text text-xs font-semibold text-accent-green';
    } else if (status === 'disconnected') {
        dot.className = 'conn-dot bg-accent-red';
        text.textContent = 'Переподключение...';
        text.className = 'conn-text text-xs font-semibold text-accent-red';
    } else {
        dot.className = 'conn-dot bg-accent-gold';
        text.textContent = 'Подключение...';
        text.className = 'conn-text text-xs font-semibold text-accent-gold';
    }
}

// ─── Рендер списка открытых комнат ───
var TAG_COLORS = {
    bunker: 'rgba(245,158,11,0.15)', blackSwan: 'rgba(139,92,246,0.15)',
    events: 'rgba(0,180,255,0.12)', streamer: 'rgba(34,197,94,0.12)',
    pseudo: 'rgba(255,255,255,0.08)', absurdGen: 'rgba(255,100,60,0.12)',
    modifier: 'rgba(255,255,255,0.08)', review: 'rgba(255,255,255,0.06)',
    audience: 'rgba(255,255,255,0.06)', defects: 'rgba(255,80,80,0.08)',
    packaging: 'rgba(255,255,255,0.06)', chat: 'rgba(0,180,255,0.08)',
};
var TAG_TEXT = {
    bunker: '#f59e0b', blackSwan: '#a78bfa', events: '#60c8ff', streamer: '#4ade80',
    pseudo: 'rgba(255,255,255,0.5)', absurdGen: '#ff6464', modifier: 'rgba(255,255,255,0.5)',
    review: 'rgba(255,255,255,0.4)', audience: 'rgba(255,255,255,0.4)',
    defects: '#ff8080', packaging: 'rgba(255,255,255,0.4)', chat: '#60c8ff',
};

function buildRoomCard(room) {
    var stateBg = room.stateType === 'lobby' ? 'rgba(34,197,94,0.1)' : room.stateType === 'active' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)';
    var stateColor = room.stateType === 'lobby' ? '#4ade80' : room.stateType === 'active' ? '#f59e0b' : 'rgba(255,255,255,0.3)';
    var safeCode = escapeHtmlLocal(room.code);
    var html = '<div class="room-card" data-room-code="' + safeCode + '">';
    // Left: name/code + host
    html += '<div class="room-card-code">';
    if (room.roomName) {
        html += '<div class="room-card-name" title="' + escapeHtmlLocal(room.roomName) + '">' + escapeHtmlLocal(room.roomName) + '</div>';
        html += '<div class="font-mono font-black text-accent-blue" style="font-size:0.7rem;letter-spacing:0.05em">' + safeCode + '</div>';
    } else {
        html += '<div class="font-mono font-black text-accent-blue" style="font-size:1rem;letter-spacing:0.05em">' + safeCode + '</div>';
    }
    html += '<div style="font-size:0.55rem;color:rgba(255,255,255,0.35);margin-top:2px">хост: ' + escapeHtmlLocal(room.hostName) + '</div>';
    html += '</div>';
    // Middle: tags
    html += '<div class="room-card-tags">';
    if (room.tags && room.tags.length) {
        room.tags.forEach(function(t) {
            var bg = TAG_COLORS[t.key] || 'rgba(255,255,255,0.06)';
            var color = TAG_TEXT[t.key] || 'rgba(255,255,255,0.4)';
            html += '<span style="display:inline-flex;align-items:center;font-size:0.55rem;font-weight:700;padding:2px 7px;border-radius:5px;background:' + bg + ';color:' + color + ';white-space:nowrap">' + t.label + '</span>';
        });
    } else {
        html += '<span style="font-size:0.6rem;color:rgba(255,255,255,0.25)">Стандартная игра</span>';
    }
    html += '</div>';
    // Right: state + count + join
    html += '<div class="room-card-right">';
    html += '<div style="font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:6px;background:' + stateBg + ';color:' + stateColor + ';margin-bottom:4px;text-align:center">' + room.stateLabel + '</div>';
    var countLabel = room.playerCount + '/' + room.maxPlayers + (room.spectatorCount ? ' · 👀' + room.spectatorCount : '');
    html += '<div style="font-size:0.6rem;color:rgba(255,255,255,0.4);text-align:center;margin-bottom:6px">' + countLabel + '</div>';
    html += '<button class="room-join-btn" data-code="' + safeCode + '">Войти</button>';
    html += '</div>';
    html += '</div>';
    return html;
}

function renderRoomsBrowser(rooms) {
    var el = document.querySelector('#rooms-list');
    if (!el) return;
    if (!rooms || rooms.length === 0) {
        el.innerHTML = '<div style="text-align:center;font-size:0.7rem;color:rgba(255,255,255,0.25);padding:16px 0">Нет открытых комнат</div>';
        return;
    }
    el.innerHTML = rooms.map(buildRoomCard).join('');
    el.querySelectorAll('.room-join-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var code = btn.getAttribute('data-code');
            var codeInput = document.querySelector('#w-room-code');
            var pwWrap = document.querySelector('#w-password-wrap');
            if (codeInput) {
                codeInput.value = code;
                if (pwWrap) pwWrap.classList.remove('hidden');
            }
            var nickInput = document.querySelector('#w-nickname');
            if (nickInput && !nickInput.value.trim()) nickInput.focus();
            else if (codeInput) codeInput.focus();
        });
    });
}

// ═══════════════════════════════════════════
// ЭМОЦИИ
// ═══════════════════════════════════════════

var EMOTIONS = {
    laugh:     { emoji: '😂', label: 'Смеётся' },
    angry:     { emoji: '😡', label: 'Злится' },
    scared:    { emoji: '😱', label: 'Пугается' },
    love:      { emoji: '😍', label: 'Восхищается' },
    think:     { emoji: '🤔', label: 'Думает' },
    mindblown: { emoji: '🤯', label: 'Голова взрывается' },
};

function showEmotionBubble(playerId, emotion) {
    var em = EMOTIONS[emotion];
    if (!em) return;
    var card = document.querySelector('[data-player-id="' + playerId + '"]');
    if (!card) return;

    var existing = card.querySelector('.emotion-bubble');
    if (existing) existing.remove();

    var bubble = document.createElement('div');
    bubble.className = 'emotion-bubble';
    bubble.innerHTML = '<span class="emotion-bubble-emoji">' + em.emoji + '</span><span class="emotion-bubble-label">' + em.label + '</span>';
    card.style.position = 'relative';
    card.appendChild(bubble);

    requestAnimationFrame(function () {
        bubble.classList.add('emotion-bubble-in');
    });

    var fadeTimer = setTimeout(function () {
        bubble.classList.add('emotion-bubble-out');
        setTimeout(function () { if (bubble.parentNode) bubble.remove(); }, 400);
    }, 3000);
    bubble._fadeTimer = fadeTimer;
}

var emotionMenuEl = null;

function closeEmotionMenu() {
    if (emotionMenuEl) {
        emotionMenuEl.remove();
        emotionMenuEl = null;
    }
}

function openEmotionMenu(x, y) {
    closeEmotionMenu();
    var menu = document.createElement('div');
    menu.id = 'emotion-menu';
    menu.className = 'emotion-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    var title = document.createElement('div');
    title.className = 'emotion-menu-title';
    title.textContent = 'Эмоция';
    menu.appendChild(title);

    var grid = document.createElement('div');
    grid.className = 'emotion-menu-grid';

    Object.keys(EMOTIONS).forEach(function (key) {
        var em = EMOTIONS[key];
        var btn = document.createElement('button');
        btn.className = 'emotion-btn';
        btn.innerHTML = '<span class="emotion-btn-emoji">' + em.emoji + '</span><span class="emotion-btn-label">' + em.label + '</span>';
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            sendMsg({ type: 'playerEmotion', emotion: key });
            closeEmotionMenu();
        });
        grid.appendChild(btn);
    });

    menu.appendChild(grid);
    document.body.appendChild(menu);
    emotionMenuEl = menu;

    // position correction if out of viewport
    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
}

document.addEventListener('contextmenu', function (e) {
    var anchor = e.target.closest('[data-emotion-self="1"]');
    if (anchor) {
        e.preventDefault();
        openEmotionMenu(e.clientX, e.clientY);
    } else {
        closeEmotionMenu();
    }
});

document.addEventListener('click', function () {
    closeEmotionMenu();
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeEmotionMenu();
});

function handleMessage(msg) {
    console.log('[MSG]', msg.type);

    switch (msg.type) {

        case 'roomsList':
            state.rooms = msg.rooms || [];
            renderRoomsBrowser(state.rooms);
            break;

        case 'roomCreated':
            setState({ playerId: msg.playerId, roomCode: msg.roomCode, isHost: true });
            try { sessionStorage.setItem('gameSession', JSON.stringify({ playerId: msg.playerId, roomCode: msg.roomCode })); } catch (e) {}
            navigate('lobby');
            showNotification('Комната создана: ' + msg.roomCode, 'success');
            playSound('success');
            break;

        case 'afkKick':
            showNotification(msg.message || 'Отключено из-за неактивности', 'error');
            playSound('warning');
            setTimeout(function () {
                window.location.reload();
            }, 3000);
            break;

        case 'roomJoined':
            setState({ playerId: msg.playerId, roomCode: msg.roomCode });
            try { sessionStorage.setItem('gameSession', JSON.stringify({ playerId: msg.playerId, roomCode: msg.roomCode })); } catch (e) {}
            if (!msg.rejoining) {
                navigate('lobby');
                showNotification('Вы вошли в комнату!', 'success');
                playSound('join');
            }
            // Если rejoining=true — ждём gameStateSync, не навигируем
            break;

        case 'lobbyUpdate':
            handleLobbyUpdate(msg);
            break;

        case 'gameStarted':
            showNotification('Игра начинается!', 'success');
            playSound('start');
            break;

        case 'playSpeech':
            stopSpeaking();
            if (msg.texts && msg.texts.length > 0) {
                speakSequence(msg.texts);
            }
            break;

        case 'roundStart':
            handleRoundStart(msg);
            break;

        case 'presentationPhase':
            handlePresentation(msg);
            break;

        case 'investingPhase':
            handleInvesting(msg);
            break;

        case 'investmentAccepted':
            setState({ investmentConfirmed: true, lastInvestmentTotal: msg.total || 0 });
            // Перерисовываем только если мы на экране инвестирования
            if (state.phase === 'investing') {
                navigate('investing');
            }
            showNotification('Инвестиции приняты! Вложено: ' + msg.total, 'success');
            playSound('success');
            break;

        case 'investmentProgress':
            var prog = document.querySelector('#invest-progress');
            if (prog) prog.textContent = 'Подтвердили: ' + msg.voted + ' / ' + msg.total;
            break;

        case 'roundResults':
            handleRoundResults(msg);
            break;

        case 'roundResultsTied':
            handleTied(msg);
            break;

        case 'tiebreakerStart':
            break;

        case 'tiebreakerPresentation':
            handleTiebreakerPresentation(msg);
            break;

        case 'tiebreakerVoting':
            handleTiebreakerVoting(msg);
            break;

        case 'tieInvestmentAccepted':
            showNotification('Голос принят!', 'success');
            playSound('success');
            break;

        case 'tieVoteProgress':
            break;

        case 'gameOver':
            handleGameOver(msg);
            break;

        case 'readyProgress':
            var readyEl = document.querySelector('#ready-progress');
            if (readyEl) {
                readyEl.innerHTML = '<div class="inline-flex items-center gap-2">'
                    + '<span class="text-accent-blue">✓</span> '
                    + 'Готовы: <span class="text-accent-blue font-black">' + msg.ready + '</span> / ' + msg.total
                    + '</div>';
            }
            break;

        case 'tiebreakerStart':
            // Обновляем state с информацией о стримерском режиме
            if (msg.streamerMode !== undefined) {
                setState({ settings: Object.assign({}, state.settings, { streamerMode: msg.streamerMode }) });
            }
            break;

        case 'timerStart':
            // Задержка чтобы DOM успел отрисоваться после navigate
            setTimeout(function () {
                startTimer(msg.duration);
            }, 50);
            break;

        case 'gameStateSync':
            handleGameStateSync(msg);
            break;

        case 'reconnectSuccess':
            showNotification('Вы переподключились к игре', 'success');
            playSound('join');
            break;

        case 'reconnectFailed':
            // Сессия устарела — очищаем и возвращаем на главную
            try { sessionStorage.removeItem('gameSession'); } catch (e) {}
            setState({ playerId: null, roomCode: null });
            navigate('welcome');
            break;

        case 'joinedAsSpectator':
            setState({ playerId: msg.playerId, roomCode: msg.roomCode, isSpectator: true });
            try { sessionStorage.removeItem('gameSession'); } catch (e) {} // зрители не восстанавливают сессию
            showNotification('👀 ' + (msg.message || 'Вы смотрите как зритель'), 'info');
            // gameStateSync придёт следующим и переведёт на нужный экран
            break;

        case 'playerDisconnected':
            if (msg.message) {
                showNotification(msg.message + ': ' + msg.nickname, 'error');
            } else {
                showNotification(msg.nickname + ' отключился', 'error');
            }
            if (msg.players) setState({ players: msg.players });
            refreshCurrentScreen();
            break;

        case 'playerLeft':
            showNotification(msg.nickname + ' вышел из игры', 'info');
            if (msg.players) setState({ players: msg.players });
            // setState сам ничего не перерисовывает — без этого ушедший игрок
            // так и остаётся в сетке участников до следующей смены экрана.
            refreshCurrentScreen();
            break;

        case 'roomClosed':
            showNotification(msg.message || 'Комната закрыта', 'error');
            playSound('warning');
            try { sessionStorage.removeItem('gameSession'); } catch (e) {}
            setState({ playerId: null, roomCode: null, isHost: false, isSpectator: false, spectators: [], players: [] });
            navigate('welcome');
            break;

        case 'spectatorsUpdate':
            setState({ spectators: msg.spectators || [] });
            break;

        case 'chatBroadcast':
            appendChatMsg(msg.msg);
            break;

        case 'chatMessageDeleted':
            removeChatMsgFromDom(msg.messageId);
            break;

        case 'playerEmotion':
            showEmotionBubble(msg.playerId, msg.emotion);
            break;

        case 'kicked':
            showNotification(msg.message || 'Вы исключены из комнаты', 'error');
            playSound('warning');
            setTimeout(function () {
                window.location.reload();
            }, 1200);
            break;

        case 'error':
            showNotification(msg.message, 'error');
            playSound('warning');
            resetWelcomeButtons();
            break;

        case 'tiebreakerReadyAccepted':
            // Уже обработано на клиенте через UI
            break;

        case 'tiebreakerReadyProgress':
            var tbProgEl = document.querySelector('#tb-ready-progress');
            if (tbProgEl) {
                tbProgEl.innerHTML = '<div class="inline-flex items-center gap-2">'
                    + '<span class="text-accent-red">⚔️</span> '
                    + 'Готовы: <span class="text-accent-red font-black">' + msg.ready + '</span> / ' + msg.total
                    + '</div>';
            }
            break;

        case 'playerEliminated':
            showNotification(msg.nickname + ' выбыл из раунда', 'error');
            playSound('warning');
            if (msg.players) setState({ players: msg.players });
            refreshCurrentScreen();
            break;

        case 'playerReconnected':
            showNotification(msg.nickname + ' вернулся!', 'success');
            playSound('join');
            if (msg.players) setState({ players: msg.players });
            refreshCurrentScreen();
            break;

        case 'cardInputPhase':
            setState({
                cardInputPhase: msg.cardType,
                currentRound: msg.round || state.currentRound,
                totalRounds: msg.totalRounds || state.totalRounds,
            });
            navigate('cardInput');
            playSound('start');
            break;

        case 'cardInputProgress':
            var progEl = document.querySelector('#card-input-progress');
            if (progEl) {
                progEl.innerHTML = '<div class="inline-flex items-center gap-2">'
                    + '<span class="text-accent-blue">✓</span> '
                    + 'Отправили: <span class="text-accent-blue font-black">' + msg.submitted + '</span> / ' + msg.total
                    + '</div>';
            }
            break;

        case 'cardSubmitAccepted':
            showNotification('Карта принята!', 'success');
            playSound('success');
            break;

        case 'readyProgress':
            var readyEl = document.querySelector('#ready-progress');
            if (readyEl) {
                if (msg.ready > 0) {
                    readyEl.innerHTML = '<div class="inline-flex items-center gap-2">'
                        + '<span class="text-accent-blue">✓</span> '
                        + 'Готовы: <span class="text-accent-blue font-black">' + msg.ready + '</span> / ' + msg.total
                        + '</div>';
                }
            }

        // ═══════ БУНКЕР ═══════

        case 'bunkerStart':
            handleBunkerStart(msg);
            break;

        case 'bunkerTurn':
            handleBunkerTurn(msg);
            break;

        case 'bunkerCardRevealed':
            handleBunkerCardRevealed(msg);
            break;

        case 'bunkerSkipVote':
            showNotification('⏭ ' + msg.reason, 'info');
            break;

        case 'bunkerVotePhase':
            handleBunkerVotePhase(msg);
            break;

        case 'bunkerVoteProgress':
            var bvp = document.querySelector('#bunker-vote-progress');
            if (bvp) bvp.textContent = 'Проголосовали: ' + msg.voted + ' / ' + msg.total;
            break;

        case 'bunkerVoteAccepted':
            showNotification('Голос принят!', 'success');
            break;

        case 'bunkerVoteResult':
            handleBunkerVoteResult(msg);
            break;

        case 'bunkerPlayerKicked':
            handleBunkerPlayerKicked(msg);
            break;

        case 'bunkerTieVotePhase':
            handleBunkerTieVotePhase(msg);
            break;

        case 'bunkerTieVoteProgress':
            var btvp = document.querySelector('#bunker-vote-progress');
            if (btvp) btvp.textContent = 'Проголосовали: ' + msg.voted + ' / ' + msg.total;
            break;

        case 'bunkerTieVoteAccepted':
            showNotification('Голос принят!', 'success');
            break;

        case 'bunkerPauseState':
            setState({ bunker: Object.assign({}, state.bunker, { paused: msg.paused }) });
            if (state.phase === 'bunkerVote') navigate('bunkerVote');
            else if (state.phase === 'bunkerTieVote') navigate('bunkerTieVote');
            showNotification(msg.paused ? 'Пауза' : 'Таймер запущен', 'info');
            break;

        case 'bunkerGameOver':
            handleBunkerGameOver(msg);
            break;

        case 'bunkerActionCardPlayed':
            handleBunkerActionCardPlayed(msg);
            break;

        case 'bunkerActionCardUpdate':
            handleBunkerActionCardUpdate(msg);
            break;
    }
}

function handleLobbyUpdate(msg) {
    var wasHost = state.isHost;
    var amIHost = false;
    for (var i = 0; i < msg.players.length; i++) {
        if (msg.players[i].id === state.playerId && msg.players[i].isHost) {
            amIHost = true;
            break;
        }
    }

    setState({ players: msg.players, spectators: msg.spectators || [], settings: msg.settings, isHost: amIHost });

    // Если статус хоста только что изменился (например, старый хост вышел и права
    // перешли к другому игроку) — нужен полный рендер: у "нового" хоста в DOM ещё
    // нет #settings-panel вообще (она не рендерилась, пока он не был хостом), поэтому
    // частичное обновление (updateSettingsPanel ищет уже существующий элемент) молча
    // ничего не делает, и панель настроек просто не появляется.
    var hostStatusChanged = amIHost !== wasHost;

    if (state.phase === 'lobby' && !hostStatusChanged) {
        // Частичное обновление без полной перерисовки
        var currentScreen = document.querySelector('#app > div');
        if (currentScreen) {
            try {
                updatePlayersList(currentScreen);
                updateStartButton(currentScreen);
                updateRoomHeader(currentScreen);
                if (amIHost) updateSettingsPanel(currentScreen);
            } catch (e) {
                console.error('[socket] Partial update failed, doing full render:', e);
                navigate('lobby');
            }
            return;
        }
    }

    navigate('lobby');
}

function handleRoundStart(msg) {
    var capital = state.myCapital;
    for (var i = 0; i < msg.players.length; i++) {
        if (msg.players[i].id === state.playerId) {
            capital = msg.players[i].capital;
            break;
        }
    }

    setState({
        currentRound: msg.round,
        totalRounds: msg.totalRounds,
        myCards: msg.yourCards,
        currentEvent: msg.event,
        myCapital: capital,
        presentationOrder: msg.presentationOrder,
        pitchText: '',
        investmentConfirmed: false
    });

    navigate('preparation');
    playSound('start');
}

function handlePresentation(msg) {
    setState({
        currentPresenter: msg.currentPresenter,
        presenterIndex: msg.presenterIndex,
        totalPresenters: msg.totalPresenters,
        previousPresentations: msg.previousPresentations || [],
        currentEvent: msg.event || state.currentEvent,
        currentRound: msg.round || state.currentRound,
        totalRounds: msg.totalRounds || state.totalRounds,
        blackSwan: msg.blackSwan || null,
    });

    navigate('presentation');

    if (msg.blackSwan) {
        playSound('warning');
    } else if (msg.currentPresenter.id === state.playerId) {
        playSound('start');
    } else {
        playSound('join');
    }
}

function handleInvesting(msg) {
    var capital = state.myCapital;
    var myCapLimit = capital;
    for (var i = 0; i < msg.players.length; i++) {
        if (msg.players[i].id === state.playerId) {
            capital = msg.players[i].capital;
            break;
        }
    }
    if (msg.investmentCaps && msg.investmentCaps[state.playerId] !== undefined) {
        myCapLimit = parseInt(msg.investmentCaps[state.playerId]) || capital;
    } else {
        myCapLimit = capital;
    }

    setState({
        myCapital: capital,
        myInvestmentCap: Math.min(capital, myCapLimit),
        presentations: msg.presentations,
        players: msg.players,
        investmentConfirmed: false,
        lastInvestmentTotal: 0,
        currentRound: msg.round || state.currentRound,
        totalRounds: msg.totalRounds || state.totalRounds
    });

    navigate('investing');
    playSound('invest');
}

function handleRoundResults(msg) {
    var capital = state.myCapital;
    for (var i = 0; i < msg.players.length; i++) {
        if (msg.players[i].id === state.playerId) {
            capital = msg.players[i].capital;
            break;
        }
    }

    setState({
        myCapital: capital,
        players: msg.players,
        roundWinners: msg.roundWinners,
        investmentDetails: msg.investmentDetails,
        luckyInvestors: msg.luckyInvestors,
        roundBestInvestor: msg.roundBestInvestor || null,
        isLastRound: msg.isLastRound,
        currentRound: msg.round
    });

    navigate('results');
    playSound(msg.roundWinners.length > 0 ? 'fanfare' : 'warning');
}

function handleTied(msg) {
    setState({
        tiedPlayers: msg.tiedPlayers,
        investmentDetails: msg.investmentDetails,
        players: msg.players
    });

    navigate('tied');
    playSound('warning');
}

function handleTiebreakerPresentation(msg) {
    setState({
        currentPresenter: msg.currentPresenter,
        presenterIndex: msg.presenterIndex,
        totalPresenters: msg.totalPresenters
    });

    navigate('tiebreaker');
    playSound('start');
}

function handleTiebreakerVoting(msg) {
    setState({
        tiedPlayers: msg.tiedPlayers,
        players: msg.players
    });

    navigate('tiebreaker_voting');
    playSound('invest');
}

function handleGameOver(msg) {
    setState({
        players: msg.players,
        bestInvestor: msg.bestInvestor,
        bestEntrepreneur: msg.bestEntrepreneur
    });

    navigate('gameOver');
    playSound('fanfare');
}

// ═══════════════════════════════════════════
// BUNKER HANDLERS
// ═══════════════════════════════════════════

function handleBunkerStart(msg) {
    if (msg.chatEnabled !== false) {
        setState({ chatMessages: msg.chatHistory || [] });
    }
    setState({
        myCards: msg.yourCards,
        myActionCards: msg.yourActionCards || [],
        myExtraCards: {},
        players: msg.players,
        bunker: {
            globalProblem: msg.globalProblem,
            revealOrder: msg.revealOrder,
            currentPlayerId: msg.revealOrder.length > 0 ? (msg.revealOrder[0].id || msg.revealOrder[0]) : null,
            currentTurnIndex: 0,
            totalTurns: msg.revealOrder.length,
            currentRound: 1,
            revealedCards: msg.revealedCards,
            revealedCardValues: {},
            eliminatedPlayers: msg.eliminatedPlayers || [],
            survivorsCount: msg.survivorsCount,
            totalPlayers: msg.totalPlayers,
            activePlayers: [],
            tiedPlayers: [],
            remainingKicks: 0,
            voteResult: null,
            survivors: [],
            eliminated: [],
            paused: false,
            playedActionCards: {},
            hostMode: !!msg.hostMode,
        },
    });

    navigate('bunkerReveal');
    playSound('start');
    showNotification('Бункер начинается! У каждого 9 карт.', 'success');
}

function handleBunkerTurn(msg) {
    var bunker = Object.assign({}, state.bunker);
    bunker.currentPlayerId = msg.currentPlayerId;
    bunker.currentTurnIndex = msg.currentTurnIndex;
    bunker.totalTurns = msg.totalTurns;
    bunker.currentRound = msg.currentRound;
    bunker.revealedCards = msg.revealedCards;
    bunker.eliminatedPlayers = msg.eliminatedPlayers || bunker.eliminatedPlayers;
    bunker.hasRevealedThisTurn = false; // Сброс при новом ходе
    setState({
        bunker: bunker,
        players: msg.players || state.players,
    });

    // НЕ навигируем если мы уже на этом экране и просто обновляем
    // (navigate пересоздаёт DOM и убивает таймер)
    navigate('bunkerReveal');

    // Таймер перезапустится автоматически через timerStart от сервера
    // НО нам нужно убедиться что DOM уже на месте

    if (msg.currentPlayerId === state.playerId) {
        playSound('start');
        showNotification('Ваш ход! Выберите карту для раскрытия.', 'info');
    } else {
        playSound('join');
    }
}

function handleBunkerCardRevealed(msg) {
    var bunker = Object.assign({}, state.bunker);
    bunker.revealedCards = msg.revealedCards;

    if (!bunker.revealedCardValues) bunker.revealedCardValues = {};
    if (!bunker.revealedCardValues[msg.playerId]) bunker.revealedCardValues[msg.playerId] = {};
    bunker.revealedCardValues[msg.playerId][msg.cardKey] = msg.cardValue;

    if (msg.playerId === state.playerId) {
        bunker.hasRevealedThisTurn = true;
    }
    setState({ bunker: bunker });

    setPendingReveal({
        playerId: msg.playerId,
        nickname: msg.nickname,
        cardKey: msg.cardKey,
        cardValue: msg.cardValue,
        isAuto: msg.isAuto,
    });

    if (state.phase === 'bunkerReveal') {
        // ═══════ FIX: сохраняем таймер до navigate ═══════
        var remainingTime = state.timerRemaining;
        var totalDuration = state.timerDuration;

        navigate('bunkerReveal');

        // ═══════ FIX: восстанавливаем таймер после navigate ═══════
        if (remainingTime > 0) {
            startTimer(remainingTime);
        }
    }

    if (msg.isAuto) {
        showNotification(msg.nickname + ': авто-раскрытие', 'info');
    } else {
        playSound('success');
    }
}

function handleBunkerVotePhase(msg) {
    var bunker = Object.assign({}, state.bunker);
    bunker.activePlayers = msg.activePlayers;
    bunker.eliminatedPlayers = msg.eliminatedPlayers;
    bunker.survivorsCount = msg.survivorsCount;
    bunker.remainingKicks = msg.remainingKicks;
    bunker.revealedCards = msg.revealedCards;
    bunker.currentRound = msg.round || bunker.currentRound;

    setState({
        bunker: bunker,
        players: msg.players || state.players,
    });

    navigate('bunkerVote');
    playSound('invest');
}

function handleBunkerVoteResult(msg) {
    var bunker = Object.assign({}, state.bunker);
    bunker.voteResult = msg;
    bunker.revealedCards = msg.revealedCards || bunker.revealedCards;
    bunker.eliminatedPlayers = msg.eliminatedPlayers || bunker.eliminatedPlayers;

    // Если карты кикнутого раскрыты — сохраняем значения
    if (msg.eliminatedCards && msg.eliminatedId) {
        if (!bunker.revealedCardValues) bunker.revealedCardValues = {};
        bunker.revealedCardValues[msg.eliminatedId] = msg.eliminatedCards;
    }

    setState({
        bunker: bunker,
        players: msg.players || state.players,
    });

    navigate('bunkerVoteResult');

    if (msg.result === 'eliminated') {
        playSound('warning');
    } else {
        playSound('join');
    }
}

// Экраны со списком участников, которые можно безболезненно перерисовать:
// пользовательского ввода, который бы затёрся, на них нет.
var REFRESHABLE_PHASES = ['bunkerReveal', 'bunkerVote', 'bunkerTieVote'];

// setState() ничего не рендерит сам, поэтому изменения состава игроков
// нужно явным образом «докатить» до текущего экрана.
function refreshCurrentScreen() {
    if (REFRESHABLE_PHASES.indexOf(state.phase) === -1) return;
    var remainingTime = state.timerRemaining;
    navigate(state.phase);
    if (remainingTime > 0) startTimer(remainingTime);
}

function handleBunkerPlayerKicked(msg) {
    var bunker = Object.assign({}, state.bunker);
    bunker.eliminatedPlayers = msg.eliminatedPlayers || bunker.eliminatedPlayers;
    bunker.revealedCards = msg.revealedCards || bunker.revealedCards;

    setState({
        bunker: bunker,
        players: msg.players || state.players,
    });

    if (msg.reason === 'disconnect') {
        showNotification('📴 «' + msg.nickname + '» не вернулся и выбыл из бункера', 'warning');
    } else if (msg.reason === 'leave') {
        showNotification('🚪 «' + msg.nickname + '» покинул бункер', 'warning');
    } else {
        showNotification('🚫 Ведущий исключил «' + msg.nickname + '» из бункера', 'warning');
    }
    playSound('warning');

    // Возможные последующие сообщения (bunkerTurn / bunkerVoteResult / bunkerGameOver)
    // сами перерисуют экран корректно; здесь просто обновляем то, что видно сейчас.
    refreshCurrentScreen();
}

function handleBunkerTieVotePhase(msg) {
    var bunker = Object.assign({}, state.bunker);
    bunker.tiedPlayers = msg.tiedPlayers;

    setState({
        bunker: bunker,
        players: msg.players || state.players,
    });

    navigate('bunkerTieVote');
    playSound('warning');
}

function handleBunkerGameOver(msg) {
    var bunker = Object.assign({}, state.bunker);
    bunker.survivors = msg.survivors;
    bunker.eliminated = msg.eliminated;
    bunker.globalProblem = msg.globalProblem;

    setState({
        bunker: bunker,
        players: msg.players || state.players,
    });

    navigate('bunkerGameOver');
    playSound('fanfare');
}

function handleBunkerActionCardPlayed(msg) {
    showNotification(msg.emoji + ' ' + msg.effect, 'info');
    playSound('start');

    // Сохраняем сыгранную карту в историю этого игрока
    var pid = msg.playerId;
    if (pid) {
        var bunker = state.bunker || {};
        var played = bunker.playedActionCards || {};
        if (!played[pid]) played[pid] = [];
        played[pid] = played[pid].concat([{ name: msg.cardName, emoji: msg.emoji, effect: msg.effect }]);
        setState({ bunker: Object.assign({}, bunker, { playedActionCards: played }) });
    }

    // Обновляем DOM если он есть (рука карт)
    var handEl = document.getElementById('bunker-action-hand');
    if (handEl && typeof window.renderBunkerActionHand === 'function') {
        window.renderBunkerActionHand();
    }

    // Сам эффект запускаем на следующем чистом кадре: если параллельно прилетел
    // bunkerActionCardUpdate с полной перерисовкой всего экрана, анимация не должна
    // стартовать в тот же такт вёрстки — иначе первые кадры проседают и она смотрится рвано.
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            playActionCardFX(msg.emoji, msg.cardName, msg.nickname);
        });
    });
}

function handleGameStateSync(msg) {
    var rs = msg.roomState;
    var isSpectator = state.isSpectator || false;

    if (rs === 'bunkerReveal' || rs === 'bunkerVote' || rs === 'bunkerTieVote') {
        setState({
            myCards: isSpectator ? {} : (msg.yourCards || {}),
            myActionCards: isSpectator ? [] : (msg.yourActionCards || []),
            myExtraCards: isSpectator ? {} : (msg.extraCards || {}),
            players: msg.players,
            bunker: {
                globalProblem: msg.globalProblem,
                revealOrder: msg.revealOrder || [],
                currentPlayerId: msg.currentPlayerId,
                currentTurnIndex: msg.currentTurnIndex || 0,
                totalTurns: msg.totalTurns || 0,
                currentRound: msg.currentRound || 0,
                revealedCards: msg.revealedCards || {},
                revealedCardValues: msg.revealedCardValues || {},
                eliminatedPlayers: msg.eliminatedPlayers || [],
                survivorsCount: msg.survivorsCount,
                totalPlayers: msg.totalPlayers,
                activePlayers: msg.activePlayers || [],
                tiedPlayers: msg.tiedPlayers || [],
                remainingKicks: msg.remainingKicks || 0,
                voteResult: null,
                survivors: [],
                eliminated: [],
                paused: !!msg.paused,
                playedActionCards: (state.bunker && state.bunker.playedActionCards) || {},
                hostMode: !!msg.hostMode,
                hasRevealedThisTurn: false,
            },
        });
        if (msg.chatEnabled !== false && msg.chatHistory) {
            setState({ chatMessages: msg.chatHistory });
        }
        if (rs === 'bunkerReveal') navigate('bunkerReveal');
        else if (rs === 'bunkerVote') navigate('bunkerVote');
        else if (rs === 'bunkerTieVote') navigate('bunkerTieVote');
        showNotification('Вы переподключились к игре', 'success');
        playSound('join');
    } else if (rs === 'preparation') {
        setState({
            currentRound: msg.round,
            totalRounds: msg.totalRounds,
            myCards: msg.yourCards,
            currentEvent: msg.event,
            players: msg.players || state.players,
            presentationOrder: msg.presentationOrder || [],
            pitchText: '',
        });
        navigate('preparation');
        showNotification('Вы переподключились к игре', 'success');
        playSound('join');
    } else if (rs === 'presentation') {
        if (msg.currentPresenter) {
            setState({
                currentPresenter: msg.currentPresenter,
                presenterIndex: msg.presenterIndex || 0,
                totalPresenters: msg.totalPresenters || 0,
                previousPresentations: msg.previousPresentations || [],
                currentEvent: msg.event || state.currentEvent,
                currentRound: msg.round || state.currentRound,
                totalRounds: msg.totalRounds || state.totalRounds,
            });
            navigate('presentation');
        }
        showNotification('Вы переподключились к игре', 'success');
        playSound('join');
    } else {
        showNotification('Вы переподключились к игре', 'success');
        playSound('join');
    }
}

function handleBunkerActionCardUpdate(msg) {
    if (msg.updatedCards) {
        setState({ myCards: msg.updatedCards });
    }
    if (msg.myActionCards !== undefined) {
        setState({ myActionCards: msg.myActionCards });
    }
    if (msg.extraCards !== undefined) {
        setState({ myExtraCards: msg.extraCards });
    }
    // Сохраняем что подсветить после re-render
    if (msg.changedCards && msg.changedCards.length) {
        window._bunkerHighlightSlots = msg.changedCards.slice();
    }
    if (msg.extraSlot) {
        window._bunkerHighlightExtra = msg.extraSlot;
    }
    // Перерисовываем текущий экран
    if (state.phase === 'bunkerReveal') {
        var remainingTime = state.timerRemaining;
        navigate('bunkerReveal');
        if (remainingTime > 0) startTimer(remainingTime);
    } else if (state.phase === 'bunkerVote') {
        navigate('bunkerVote');
    }
    playSound('success');

    // Показываем богатое уведомление для владельца/затронутого
    if (msg.ownerEffect) showActionResultToast(msg);
}

function getActionToastContainer() {
    var c = document.getElementById('action-toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'action-toast-container';
        document.body.appendChild(c);
    }
    return c;
}

function showActionResultToast(msg) {
    // Рендерим в следующем тике — после того как navigate() перерисовал экран
    setTimeout(function () { buildActionResultToast(msg); }, 0);
}

function buildActionResultToast(msg) {
    var container = getActionToastContainer();
    var prev = container.querySelector('.action-result-toast');
    if (prev) prev.remove();

    var toast = document.createElement('div');
    toast.className = 'action-result-toast';

    var html = '';
    html += '<div class="action-result-glow"></div>';
    html += '<div class="action-result-header">';
    html += '  <div class="action-result-emoji">' + (msg.emoji || '⚡') + '</div>';
    html += '  <div class="action-result-name">' + escapeHtmlLocal(msg.cardName || 'Карта действия') + '</div>';
    if (msg.fromPlayer) {
        html += '  <div class="action-result-from">от <b>' + escapeHtmlLocal(msg.fromPlayer) + '</b></div>';
    }
    html += '  <button class="action-result-close" aria-label="Закрыть">✕</button>';
    html += '</div>';
    html += '<div class="action-result-body">' + escapeHtmlLocal(msg.ownerEffect) + '</div>';
    toast.innerHTML = html;
    container.appendChild(toast);

    // Форсируем reflow, чтобы transition сыграл даже если rAF не успеет тикнуть
    void toast.offsetWidth;
    toast.classList.add('action-result-toast-in');

    var timer = setTimeout(function () { closeActionResultToast(toast); }, 7000);

    var closeBtn = toast.querySelector('.action-result-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
        clearTimeout(timer);
        closeActionResultToast(toast);
    });
}
function closeActionResultToast(toast) {
    toast.classList.add('action-result-toast-out');
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 350);
}
function escapeHtmlLocal(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
        return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
    });
}

// ═══════════════════════════════════════════
// ЭФФЕКТ РОЗЫГРЫША КАРТЫ ДЕЙСТВИЯ — видно всей комнате
// ═══════════════════════════════════════════

function getActionFxContainer() {
    var c = document.getElementById('action-fx-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'action-fx-container';
        document.body.appendChild(c);
    }
    return c;
}

function buildActionFxSparks(count, spread) {
    var html = '';
    for (var i = 0; i < count; i++) {
        var angle = (Math.PI * 2 * i) / count + (Math.random() * 0.35 - 0.175);
        var dist = spread * (0.6 + Math.random() * 0.55);
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist;
        var delay = Math.random() * 0.16;
        var size = 5 + Math.random() * 7;
        html += '<span class="bunker-fx-spark" style="--dx:' + dx.toFixed(1) + 'px;--dy:' + dy.toFixed(1) + 'px;--delay:' + delay.toFixed(2) + 's;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;"></span>';
    }
    return html;
}

function playActionCardFX(emoji, cardName, nickname) {
    var container = getActionFxContainer();
    container.innerHTML = ''; // предыдущий эффект (если ещё не успел исчезнуть) не должен мешать новому

    var fx = document.createElement('div');
    fx.className = 'bunker-fx-overlay';

    var html = '';
    html += '<div class="bunker-fx-ring"></div>';
    html += '<div class="bunker-fx-ring2"></div>';
    html += buildActionFxSparks(16, 150);
    html += '<div class="bunker-fx-emoji">' + escapeHtmlLocal(emoji || '⚡') + '</div>';
    html += '<div class="bunker-fx-name">' + escapeHtmlLocal(cardName || 'Карта действия') + '</div>';
    if (nickname) {
        html += '<div class="bunker-fx-player">разыграл(а) ' + escapeHtmlLocal(nickname) + '</div>';
    }
    fx.innerHTML = html;
    container.appendChild(fx);

    setTimeout(function () {
        fx.classList.add('bunker-fx-overlay-out');
        setTimeout(function () { if (fx.parentNode) fx.remove(); }, 380);
    }, 1350);
}