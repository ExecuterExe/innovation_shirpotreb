import { connectWS, sendMsg } from './socket.js';
import { initParticles } from './components/particles.js';
import { showNotification } from './components/notification.js';
import { playSound, initAudio } from './components/sound.js';
import { renderWelcome } from './screens/welcome.js';
import { renderLobby } from './screens/lobby.js';
import { renderPreparation } from './screens/preparation.js';
import { renderPresentation } from './screens/presentation.js';
import { renderInvesting } from './screens/investing.js';
import { renderResults } from './screens/results.js';
import { renderGameOver } from './screens/gameover.js';
import { renderCardInput } from './screens/card-input.js';
import { renderTied, renderTiebreaker, renderTiebreakerVoting } from './screens/tiebreaker.js';
import { initSpeech } from './components/speech.js';
import { renderBunkerReveal, renderBunkerVoteResult } from './screens/bunker-game.js';
import { renderBunkerVote, renderBunkerTieVote, renderBunkerGameOver } from './screens/bunker-vote.js';
import { renderSoloSettings, renderSoloCards } from './screens/solo.js';

// ==================== GLOBAL STATE ====================

export var state = {
    connected: false,
    playerId: null,
    roomCode: null,
    isHost: false,
    phase: 'welcome',
    players: [],
    settings: {
        rounds: 3,
        startCapital: 10,
        useEvents: false,
        streamerMode: false,
        anonymizeParticipants: false,
        prepTime: 60,
        presentTime: 120,
        investTime: 60,
    },
    currentRound: 0,
    totalRounds: 3,
    myCards: null,
    currentEvent: null,
    presentationOrder: [],
    currentPresenter: null,
    presenterIndex: 0,
    totalPresenters: 0,
    previousPresentations: [],
    myCapital: 10,
    myInvestmentCap: 10,
    presentations: [],
    investmentConfirmed: false,
    lastInvestmentTotal: 0,
    roundWinners: [],
    investmentDetails: [],
    luckyInvestors: [],
    roundBestInvestor: null,
    isLastRound: false,
    tiedPlayers: [],
    timerDuration: 0,
    timerRemaining: 0,
    timerInterval: null,
    pitchText: '',
    cardInputPhase: null,
    bestInvestor: null,
    bestEntrepreneur: null,
    blackSwan: null,
    soloCards: null,
    soloEvent: null,
    // Бункер
    bunker: {
        globalProblem: null,
        revealOrder: [],
        currentPlayerId: null,
        currentTurnIndex: 0,
        totalTurns: 0,
        currentRound: 1,
        revealedCards: {},
        revealedCardValues: {},
        eliminatedPlayers: [],
        survivorsCount: 0,
        totalPlayers: 0,
        activePlayers: [],
        tiedPlayers: [],
        remainingKicks: 0,
        voteResult: null,
        survivors: [],
        eliminated: [],
        paused: false,
    },
};

// ==================== STATE UPDATE ====================

export function setState(updates) {
    var keys = Object.keys(updates);
    for (var i = 0; i < keys.length; i++) {
        state[keys[i]] = updates[keys[i]];
    }
}

export function navigate(phase) {
    // При смене экранов останавливаем предыдущий таймер, чтобы не было "поздних" тиков/звуков.
    stopTimer();
    var prevPhase = state.phase;
    state.phase = phase;

    var app = document.getElementById('app');
    if (!app) return;

    // Clear and render
    app.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.className = 'screen-enter min-h-screen';

    switch (phase) {
        case 'welcome': renderWelcome(wrapper); break;
        case 'lobby': renderLobby(wrapper, true); break;
        case 'cardInput': renderCardInput(wrapper); break;
        case 'preparation': renderPreparation(wrapper); break;
        case 'presentation': renderPresentation(wrapper); break;
        case 'investing': renderInvesting(wrapper); break;
        case 'results': renderResults(wrapper); break;
        case 'tied': renderTied(wrapper); break;
        case 'tiebreaker': renderTiebreaker(wrapper); break;
        case 'tiebreaker_voting': renderTiebreakerVoting(wrapper); break;
        case 'gameOver': renderGameOver(wrapper); break;
        case 'bunkerReveal': renderBunkerReveal(wrapper); break;
        case 'bunkerVote': renderBunkerVote(wrapper); break;
        case 'bunkerTieVote': renderBunkerTieVote(wrapper); break;
        case 'bunkerVoteResult': renderBunkerVoteResult(wrapper); break;
        case 'bunkerGameOver': renderBunkerGameOver(wrapper); break;
        case 'soloSettings': renderSoloSettings(wrapper); break;
        case 'soloCards': renderSoloCards(wrapper); break;
        default: renderWelcome(wrapper);
    }

    app.appendChild(wrapper);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== TIMER ====================

export function startTimer(duration) {
    stopTimer();
    state.timerDuration = duration;
    state.timerRemaining = duration;

    state.timerInterval = setInterval(function () {
        state.timerRemaining--;

        if (state.timerRemaining <= 0) {
            state.timerRemaining = 0;
            stopTimer();
        }

        updateTimerUI();

        if (state.timerRemaining === 10) playSound('warning');
        if (state.timerRemaining <= 5 && state.timerRemaining > 0) playSound('tick');
    }, 1000);

    updateTimerUI();
}

export function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

function updateTimerUI() {
    var remaining = state.timerRemaining;
    var total = state.timerDuration;
    var fraction = total > 0 ? remaining / total : 0;
    var min = Math.floor(remaining / 60);
    var sec = remaining % 60;
    var text = min + ':' + (sec < 10 ? '0' : '') + sec;

    var isWarning = remaining <= 15 && remaining > 5;
    var isCritical = remaining <= 5;

    var bars = document.querySelectorAll('[data-timer-bar]');
    for (var i = 0; i < bars.length; i++) {
        bars[i].style.width = (fraction * 100) + '%';
        bars[i].classList.remove('warning', 'critical');
        if (isCritical) bars[i].classList.add('critical');
        else if (isWarning) bars[i].classList.add('warning');
    }

    var texts = document.querySelectorAll('[data-timer-text]');
    for (var j = 0; j < texts.length; j++) {
        texts[j].textContent = text;
        texts[j].classList.remove('text-accent-gold', 'text-accent-red');
        if (isCritical) texts[j].classList.add('text-accent-red');
        else if (isWarning) texts[j].classList.add('text-accent-gold');
    }
}

// ==================== UTILS ====================

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ==================== INIT ====================

function init() {
    initParticles();
    initSpeech();
    connectWS();
    navigate('welcome');

    document.addEventListener('click', function () {
        initAudio();
    }, { once: true });

    window.addEventListener('beforeunload', function (e) {
        if (state.phase !== 'welcome' && state.phase !== 'lobby') {
            e.preventDefault();
            e.returnValue = 'Игра в процессе!';
        }
    });

    console.log('🚀 Инновационный Ширпотреб v3.0');
    // Клиентский AFK — пинг при активности
    var activityEvents = ['click', 'keydown', 'touchstart', 'mousemove'];
    var lastActivity = Date.now();

    function onActivity() {
        lastActivity = Date.now();
    }

    for (var i = 0; i < activityEvents.length; i++) {
        document.addEventListener(activityEvents[i], onActivity, { passive: true });
    }
}

init();