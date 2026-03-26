import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';
import { renderCardGrid, CARD_TYPES } from './presentation.js';

export function renderPreparation(container) {
    var cards = state.myCards || {};
    var event = state.currentEvent;
    var order = state.presentationOrder || [];
    var isHost = state.isHost;
    var streamer = state.settings.streamerMode;

    var cardList = [];
    for (var t = 0; t < CARD_TYPES.length; t++) {
        var type = CARD_TYPES[t];
        var value = cards[type.key];
        if (value) {
            cardList.push({ label: type.label, value: value, gradient: type.gradient, shadow: type.shadow });
        }
    }

    var html = '';
    html += '<div class="max-w-5xl mx-auto px-4 py-6 min-h-screen">';

    // HUD
    html += '<div class="corp-card px-6 py-4 flex items-center justify-between flex-wrap gap-4 mb-8">';
    html += '  <div>';
    html += '    <div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">Раунд</div>';
    html += '    <div class="text-3xl font-black text-corp-white">' + state.currentRound;
    html += '      <span class="text-corp-muted text-2xl">/' + state.totalRounds + '</span></div>';
    html += '  </div>';
    html += '  <div class="flex-1 max-w-md mx-6">';
    html += '    <div class="flex justify-between text-xs font-bold text-corp-muted mb-1.5">';
    html += '      <span>ПОДГОТОВКА</span>';
    html += '      <span data-timer-text class="font-mono text-corp-light"></span>';
    html += '    </div>';
    html += '    <div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
    html += '  </div>';
    html += '  <div class="text-right">';
    html += '    <div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">Капитал</div>';
    html += '    <div class="text-3xl font-black text-accent-blue">' + state.myCapital + '</div>';
    html += '  </div>';
    html += '</div>';

    // Event
    if (event) {
        html += '<div class="corp-card border-accent-blue/30 bg-accent-blue-dim p-5 mb-8">';
        html += '  <div class="flex gap-4">';
        html += '    <span class="text-3xl flex-shrink-0">⚡</span>';
        html += '    <div>';
        html += '      <div class="text-[0.6rem] font-black text-accent-blue uppercase tracking-widest mb-1">Событие раунда</div>';
        html += '      <div class="text-corp-light leading-relaxed">' + escapeHtml(event) + '</div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }

    // Title
    html += '<div class="text-center mb-4">';
    html += '  <h2 class="text-2xl font-black text-corp-white mb-2">Ваши карты</h2>';
    html += '  <p class="text-corp-muted">Придумайте, как объединить эти понятия в один инновационный продукт</p>';
    html += '</div>';

    // Cards
    html += renderCardGrid(cardList, 'preparation');

    // Pitch section (streamer mode)
    if (streamer) {
        html += '<div class="max-w-2xl mx-auto mt-10 corp-card p-6">';
        html += '  <div class="flex items-center justify-between mb-3">';
        html += '    <h4 class="text-sm font-bold text-accent-blue">📝 Напишите текст питча</h4>';
        html += '  </div>';
        html += '  <p class="text-xs text-corp-muted mb-3">Напишите речь для инвесторов. Текст автоматически сохраняется.</p>';
        html += '  <textarea id="pitch-textarea" class="w-full h-40 p-5 bg-corp-black border border-corp-border rounded-2xl text-sm text-corp-light resize-y outline-none focus:border-accent-blue/40 transition-colors leading-relaxed" placeholder="Дамы и господа! Представляю вам революционный продукт..." maxlength="7000">';
        html += escapeHtml(state.pitchText || '');
        html += '</textarea>';
        html += '  <div class="flex items-center justify-between mt-3">';
        html += '    <div class="text-xs text-corp-muted"><span id="pitch-counter">' + (state.pitchText || '').length + '</span> / 7000</div>';
        html += '    <button id="btn-ready" class="btn-neon px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">✓ Готов</button>';
        html += '  </div>';
        html += '  <div id="ready-confirmed" class="hidden mt-3 text-center py-3 rounded-xl bg-accent-green-dim border border-accent-green/20">';
        html += '    <span class="text-accent-green text-sm font-bold">✓ Питч отправлен!</span>';
        html += '  </div>';
        html += '</div>';
    }

    // Ready progress (visible to all)
    html += '<div class="max-w-2xl mx-auto mt-6 text-center">';
    html += '  <div id="ready-progress" class="text-sm font-semibold text-corp-muted"></div>';
    html += '</div>';

    // Order
    html += '<div class="mt-8 text-center">';
    html += '  <div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-4">Порядок выступлений</div>';
    html += '  <div class="flex flex-wrap justify-center gap-3">';
    for (var i = 0; i < order.length; i++) {
        var p = order[i];
        var isYou = p.id === state.playerId;
        var cls = isYou ? 'bg-accent-blue text-white' : 'bg-corp-graphite text-corp-light border border-corp-border';
        html += '<span class="px-5 py-2.5 rounded-2xl text-sm font-bold ' + cls + '">';
        html += (i + 1) + '. ' + escapeHtml(p.nickname) + '</span>';
    }
    html += '  </div>';
    html += '</div>';

    // Host skip — ТОЛЬКО в обычном режиме (не стримерском)
    if (isHost && !streamer) {
        html += '<div class="text-center mt-10">';
        html += '  <button id="btn-skip-prep" class="btn-neon px-8 py-3.5 rounded-2xl text-sm font-bold uppercase tracking-wider cursor-pointer">';
        html += '    ⏭ Пропустить подготовку</button>';
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // ═══════ LISTENERS ═══════
    var textarea = container.querySelector('#pitch-textarea');
    var btnReady = container.querySelector('#btn-ready');
    var readyConfirmed = container.querySelector('#ready-confirmed');

    if (textarea) {
        var counter = container.querySelector('#pitch-counter');
        textarea.addEventListener('input', function () {
            state.pitchText = textarea.value;
            if (counter) counter.textContent = textarea.value.length;
            clearTimeout(window._pitchTimeout);
            window._pitchTimeout = setTimeout(function () {
                sendMsg({ type: 'updatePitchText', text: textarea.value });
            }, 800);
        });
    }

    if (btnReady) {
        btnReady.addEventListener('click', function () {
            if (textarea) {
                sendMsg({ type: 'updatePitchText', text: textarea.value });
            }
            sendMsg({ type: 'playerReady' });
            btnReady.textContent = '✓ Отправлено!';
            btnReady.disabled = true;
            btnReady.classList.add('opacity-50');
            if (readyConfirmed) readyConfirmed.classList.remove('hidden');
        });
    }

    // Skip (only in non-streamer mode)
    var btnSkip = container.querySelector('#btn-skip-prep');
    if (btnSkip) {
        btnSkip.addEventListener('click', function () {
            if (textarea) sendMsg({ type: 'updatePitchText', text: textarea.value });
            sendMsg({ type: 'skipTimer' });
        });
    }
}