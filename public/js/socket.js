import { state, setState, navigate, startTimer } from './app.js';
import { showNotification } from './components/notification.js';
import { playSound } from './components/sound.js';
import { updatePlayersList, updateStartButton, updateSettingsPanel } from './screens/lobby.js';
import { speakSequence, stopSpeaking } from './components/speech.js';

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

function handleMessage(msg) {
    console.log('[MSG]', msg.type);

    switch (msg.type) {

        case 'roomCreated':
            setState({ playerId: msg.playerId, roomCode: msg.roomCode, isHost: true });
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
            navigate('lobby');
            showNotification('Вы вошли в комнату!', 'success');
            playSound('join');
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
            setState({ investmentConfirmed: true });
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
            startTimer(msg.duration);
            break;

        case 'playerDisconnected':
            showNotification(msg.nickname + ' отключился', 'error');
            break;

        case 'error':
            showNotification(msg.message, 'error');
            playSound('warning');
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
            break;

        case 'playerReconnected':
            showNotification(msg.nickname + ' вернулся!', 'success');
            playSound('join');
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
            break;
    }
}

function handleLobbyUpdate(msg) {
    var amIHost = false;
    for (var i = 0; i < msg.players.length; i++) {
        if (msg.players[i].id === state.playerId && msg.players[i].isHost) {
            amIHost = true;
            break;
        }
    }

    setState({ players: msg.players, settings: msg.settings, isHost: amIHost });

    if (state.phase === 'lobby') {
        // Частичное обновление без полной перерисовки
        var currentScreen = document.querySelector('#app > div');
        if (currentScreen) {
            try {
                updatePlayersList(currentScreen);
                updateStartButton(currentScreen);
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
    for (var i = 0; i < msg.players.length; i++) {
        if (msg.players[i].id === state.playerId) {
            capital = msg.players[i].capital;
            break;
        }
    }

    setState({
        myCapital: capital,
        presentations: msg.presentations,
        players: msg.players,
        investmentConfirmed: false,
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