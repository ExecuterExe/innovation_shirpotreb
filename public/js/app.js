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
import { mountRail } from './components/players-rail.js';
import { syncReactionFab } from './components/reactions.js';
import { renderBunkerReveal, renderBunkerVoteResult } from './screens/bunker-game.js';
import { renderBunkerVote, renderBunkerTieVote, renderBunkerGameOver } from './screens/bunker-vote.js';
import { renderSoloSettings, renderSoloCards } from './screens/solo.js';

// ==================== GLOBAL STATE ====================

export var state = {
    connected: false,
    playerId: null,
    roomCode: null,
    isHost: false,
    isSpectator: false,
    phase: 'welcome',
    players: [],
    spectators: [],
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
    myActionCards: [],
    myExtraCards: {},
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
        playedActionCards: {},
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

    // Экраны партии — в оболочке с колонкой участников слева.
    // Колонка не участвует в анимации смены экрана: меняется только основная часть.
    var rail = null;
    var outer = wrapper;
    if (GAME_SHELL_PHASES.indexOf(phase) !== -1) {
        outer = document.createElement('div');
        outer.className = 'game-shell';
        rail = document.createElement('aside');
        rail.className = 'game-rail';
        rail.id = 'game-rail';
        wrapper.className = 'game-main screen-enter min-h-screen';
        outer.appendChild(rail);
        outer.appendChild(wrapper);
        // Колонку ставим до экрана: экрану «Бункера» нужно место под памятку (#rail-extra)
        app.appendChild(outer);
        mountRail(rail);
    }

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

    if (!rail) app.appendChild(outer);
    syncReactionFab();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

var GAME_SHELL_PHASES = [
    'cardInput', 'preparation', 'presentation', 'investing', 'results',
    'tied', 'tiebreaker', 'tiebreaker_voting', 'gameOver',
    'bunkerReveal', 'bunkerVote', 'bunkerTieVote', 'bunkerVoteResult', 'bunkerGameOver',
];

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
    document.body.classList.remove('timer-critical');
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

    // Последние секунды — края экрана пульсируют красным (только если таймер виден на экране)
    var timerVisible = document.querySelector('[data-timer-text], [data-timer-bar]');
    document.body.classList.toggle('timer-critical', !!timerVisible && isCritical && remaining > 0);

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

// ==================== НАБЛЮДАТЕЛЬ ====================
// Ведущий без карт или зритель: смотрит партию, но не играет.

// Плашка в шапке экрана вместо капитала
export function observerHudHtml() {
    var host = state.isHost;
    return '<div class="text-right">'
        + '<div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">Роль</div>'
        + '<div class="text-base font-black mt-1 ' + (host ? 'text-accent-gold' : 'text-corp-light') + '">' + (host ? '🎙 Ведущий' : '👀 Зритель') + '</div>'
        + '</div>';
}

// Пояснение вместо игровых действий: что сейчас делают игроки
export function observerNoticeHtml(text) {
    var host = state.isHost;
    return '<div class="corp-card px-6 py-5 mb-8 flex items-center gap-4' + (host ? ' border-accent-gold/30 bg-accent-gold-dim' : '') + '">'
        + '<div class="text-3xl flex-shrink-0">' + (host ? '🎙' : '👀') + '</div>'
        + '<div class="text-left">'
        + '<div class="text-xs font-black uppercase tracking-widest mb-1 ' + (host ? 'text-accent-gold' : 'text-corp-light') + '">' + (host ? 'Вы ведёте игру' : 'Вы зритель') + '</div>'
        + '<div class="text-sm text-corp-dim leading-relaxed">' + text + '</div>'
        + '</div>'
        + '</div>';
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

    console.log('🚀 ВПАРИТЬ v3.0');
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