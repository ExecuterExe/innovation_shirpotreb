// ═══════════════════════════════════════════
// ГОЛОС ИГРЫ — что произносится и на каком устройстве
//  • вышел новый выступающий — продукт по картам (в текстовых питчах — и сам текст питча);
//  • «Чёрный лебедь» — какая карта сменилась;
//  • сообщения чата с !питч (настройка «Озвучка команды !питч»).
// Где звучит — настройка комнаты speechWhere:
//   'host'    — только у ведущего (по умолчанию: это экран, проектор или стрим);
//   'screens' — у ведущего и у зрителей (например, ноутбук у проектора в режиме «Смотреть»);
//   'all'     — у всех, для игры по видеосвязи из разных мест.
// Когда все в одной комнате, голос с каждого телефона — это эхо и каша, поэтому не 'all' по умолчанию.
// На своём устройстве голос можно выключить (setVoiceMuted в speech.js).
// ═══════════════════════════════════════════
import { state } from '../app.js';
import { speak, speakSequence, stopSpeaking, isVoiceMuted } from './speech.js';

var lastAnnounced = null;   // «раунд:выступающий» — чтобы перерисовка экрана не повторяла объявление

export function voiceWhere() {
    var w = state.settings && state.settings.speechWhere;
    return w === 'screens' || w === 'all' ? w : 'host';
}

// Звучит ли голос на этом устройстве
export function isVoiceDevice() {
    var w = voiceWhere();
    if (w === 'all' || state.isHost) return true;
    return w === 'screens' && !!state.isSpectator;
}

function lower(v) { return String(v || '').toLowerCase(); }

// Что сказать про выступающего. Имени нет — его и так видно, а при шифровке участников оно тайна.
export function presentationTexts(pres, presenterIndex, streamerMode, blackSwan) {
    var texts = [];
    var cards = (pres && pres.cards) || {};
    texts.push(presenterIndex === 0 ? 'Начинаем питчи! Первый стартап.' : 'Следующий стартап.');
    if (blackSwan && blackSwan.label) {
        texts.push('Чёрный лебедь! ' + blackSwan.label + ' меняется: было «' + lower(blackSwan.oldValue) + '», стало «' + lower(blackSwan.newValue) + '».');
    }
    var name = [cards.adjective, cards.item, cards.modifier].filter(Boolean).map(lower).join(' ');
    if (name) texts.push('Продукт: ' + name + (cards.feature ? ', ' + lower(cards.feature) : '') + '.');
    if (cards.targetAudience) texts.push('Целевая аудитория: ' + lower(cards.targetAudience) + '.');
    if (cards.hiddenDefect) texts.push('Скрытый дефект: ' + lower(cards.hiddenDefect) + '.');
    if (cards.packaging) texts.push('Упаковка: ' + lower(cards.packaging) + '.');
    if (cards.review) texts.push('Первый отзыв покупателя: ' + cards.review);
    if (streamerMode && pres.pitchText && pres.pitchText.trim()) {
        texts.push('Питч.');
        texts.push(pres.pitchText.trim());
    }
    return texts;
}

// Объявить текущего выступающего. force — повтор по кнопке ведущего.
export function announcePresentation(opts) {
    opts = opts || {};
    var done = opts.onDone || null;
    if (!state.settings || !state.settings.useSpeech) { if (done) done(); return; }
    var pres = state.currentPresenter;
    if (!pres || !pres.cards || state.presentationStage === 'questions') { if (done) done(); return; }
    var key = state.currentRound + ':' + state.presenterIndex;
    if (!opts.force && key === lastAnnounced) return;
    lastAnnounced = key;
    if (!isVoiceDevice() || isVoiceMuted()) { if (done) done(); return; }
    var texts = presentationTexts(pres, state.presenterIndex, !!state.settings.streamerMode, opts.force ? null : state.blackSwan);
    speakSequence(texts, done, { interrupt: true });
}

// Сообщение чата с !питч — в очередь, не перебивая то, что уже звучит
export function announceChatPitch(msg) {
    if (!state.settings || !state.settings.chatTTS || !msg || !msg.text) return;
    if (!isVoiceDevice()) return;
    var text = String(msg.text).slice(0, 300);
    speak((msg.nickname ? msg.nickname + ' пишет: ' : '') + text);
}

// Выступление закончилось (вопросы, инвестиции, другой экран) — голос замолкает
export function silenceAnnouncer() {
    stopSpeaking();
}
