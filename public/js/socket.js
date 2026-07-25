import { state, setState, navigate, startTimer } from './app.js';
import { showNotification } from './components/notification.js';
import { playSound } from './components/sound.js';
import { updatePlayersList, updateStartButton, updateSettingsPanel } from './screens/lobby.js';
import { speakSequence, stopSpeaking } from './components/speech.js';
import { setPendingReveal } from './screens/bunker-game.js';

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
    // Сохраняем свои карты
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
    showNotification('Бункер начинается! У каждого 8 карт.', 'success');
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
    // Перерисовываем текущий экран
    if (state.phase === 'bunkerReveal') {
        var remainingTime = state.timerRemaining;
        navigate('bunkerReveal');
        if (remainingTime > 0) startTimer(remainingTime);
    } else if (state.phase === 'bunkerVote') {
        navigate('bunkerVote');
    }
    playSound('success');
}