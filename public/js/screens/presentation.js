import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';

// ═══════════════════════════════════════════
// Конфиг типов карт — легко расширяется
// Добавляешь новый тип — просто добавь объект
// ═══════════════════════════════════════════
var CARD_TYPES = [
    { key: 'adjective', label: 'Прилагательное', gradient: 'card-adjective-gradient', shadow: 'shadow-red-950/40' },
    { key: 'item', label: 'Предмет', gradient: 'card-item-gradient', shadow: 'shadow-cyan-950/40' },
    { key: 'modifier', label: 'Модификатор', gradient: 'card-modifier-gradient', shadow: 'shadow-emerald-950/40' },
    { key: 'feature', label: 'Особенность', gradient: 'card-feature-gradient', shadow: 'shadow-purple-950/40' },
    // Будущие карты:
    // { key: 'modifier',  label: 'Модификатор',    gradient: 'card-modifier-gradient',  shadow: 'shadow-amber-950/40' },
    // { key: 'audience',  label: 'Аудитория',      gradient: 'card-audience-gradient',   shadow: 'shadow-green-950/40' },
    { key: 'review', label: 'Первый отзыв', gradient: 'card-review-gradient', shadow: 'shadow-amber-950/40' },

];

export function renderPresentation(container) {
    var pres = state.currentPresenter;
    if (!pres) return;

    var isMe = pres.id === state.playerId;
    var isHost = state.isHost;
    var event = state.currentEvent;
    var prevs = state.previousPresentations || [];
    var streamer = state.settings && state.settings.streamerMode;

    // Отправляем текст при переходе из подготовки
    if (isMe && state.pitchText) {
        sendMsg({ type: 'updatePitchText', text: state.pitchText });
    }

    // Собираем карты в массив для универсального рендера
    var cards = [];
    for (var t = 0; t < CARD_TYPES.length; t++) {
        var type = CARD_TYPES[t];
        var value = pres.cards[type.key];
        if (value) {
            cards.push({ label: type.label, value: value, gradient: type.gradient, shadow: type.shadow });
        }
    }

    var presCards = [];
    for (var pt = 0; pt < CARD_TYPES.length; pt++) {
        var ptype = CARD_TYPES[pt];
        if (pres.cards[ptype.key]) {
            presCards.push({ label: ptype.label, value: pres.cards[ptype.key], gradient: ptype.gradient, shadow: ptype.shadow });
        }
    }

    var html = '';
    html += '<div class="max-w-5xl mx-auto px-4 py-6 min-h-screen">';

    // ═══════ HUD ═══════
    html += '<div class="corp-card px-6 py-4 flex items-center justify-between flex-wrap gap-4 mb-6">';
    html += '  <div>';
    html += '    <div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">Раунд</div>';
    html += '    <div class="text-2xl font-black text-corp-white">' + state.currentRound;
    html += '      <span class="text-corp-muted text-lg">/' + state.totalRounds + '</span>';
    html += '    </div>';
    html += '  </div>';

    html += '  <div class="flex-1 max-w-md mx-6">';
    html += '    <div class="flex justify-between text-xs font-bold text-corp-muted mb-1.5">';
    html += '      <span>ПИТЧ ' + (state.presenterIndex + 1) + ' / ' + state.totalPresenters + '</span>';
    html += '      <span data-timer-text class="font-mono text-corp-light"></span>';
    html += '    </div>';
    html += '    <div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
    html += '  </div>';

    html += '  <div class="text-right">';
    html += '    <div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">Капитал</div>';
    html += '    <div class="text-2xl font-black text-accent-blue">' + state.myCapital + '</div>';
    html += '  </div>';
    html += '</div>';

    // ═══════ EVENT ═══════
    if (event) {
        html += '<div class="corp-card border-accent-gold/20 bg-accent-gold-dim p-5 mb-6">';
        html += '  <div class="flex gap-4">';
        html += '    <span class="text-2xl flex-shrink-0">⚡</span>';
        html += '    <div>';
        html += '      <div class="text-[0.6rem] font-black text-accent-gold uppercase tracking-widest mb-1">Событие раунда</div>';
        html += '      <div class="text-sm text-corp-light leading-relaxed">' + escapeHtml(event) + '</div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }

    // ═══════ BLACK SWAN ALERT ═══════
    var blackSwan = state.blackSwan;
    if (blackSwan && blackSwan.cardKey) {
        html += '<div class="corp-card border-accent-red/30 bg-accent-red-dim p-5 mb-6 animate-card-deal" style="animation-duration: 0.6s;">';
        html += '  <div class="flex gap-4">';
        html += '    <span class="text-3xl flex-shrink-0">🦢</span>';
        html += '    <div>';
        html += '      <div class="text-[0.6rem] font-black text-accent-red uppercase tracking-widest mb-1">Чёрный лебедь!</div>';
        html += '      <div class="text-sm text-corp-light leading-relaxed">';
        html += '        <span class="font-bold">' + escapeHtml(blackSwan.label) + '</span> изменилось! ';
        html += '        <span class="line-through text-corp-muted">' + escapeHtml(blackSwan.oldValue) + '</span>';
        html += '        → <span class="text-accent-red font-black">' + escapeHtml(blackSwan.newValue) + '</span>';
        html += '      </div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }

    // ═══════ SPOTLIGHT STAGE ═══════
    var stageExtra = isMe ? ' spotlight-glow border-accent-blue/30' : '';
    html += '<div class="corp-card-elevated p-8 md:p-10 text-center mb-6' + stageExtra + '">';

    // Presenter name
    html += '  <div class="text-xs text-corp-muted font-bold uppercase tracking-[0.15em] mb-2">Сейчас выступает</div>';
    html += '  <h2 class="font-display text-4xl md:text-5xl font-black text-accent-gold mb-6" style="text-shadow: 0 0 40px rgba(255,215,0,0.15);">';
    html += escapeHtml(pres.nickname);
    html += '  </h2>';

    // "It's you!" badge
    if (isMe) {
        html += '<div class="inline-flex items-center gap-2.5 bg-accent-blue text-white px-6 py-2.5 rounded-full text-sm font-black uppercase tracking-wider mb-8 animate-glow-pulse">';
        html += '  <span class="w-2.5 h-2.5 rounded-full bg-white/80 animate-ping"></span>';
        html += '  🎤 ЭТО ВЫ! ВЫСТУПАЙТЕ!';
        html += '</div>';
    }

    // ═══════ PITCH TEXT (streamer) ═══════
    if (streamer && pres.pitchText && pres.pitchText.trim()) {
        html += '<div class="text-left mb-8 max-w-2xl mx-auto">';
        html += '  <div class="flex items-center gap-2 text-xs font-bold text-accent-gold uppercase tracking-widest mb-3">';
        html += '    <span>📝</span> Текст питча';
        html += '  </div>';
        html += '  <div class="bg-corp-black/60 rounded-2xl p-6 border-l-3 border-accent-gold/40 text-sm text-corp-light leading-[1.8] whitespace-pre-wrap break-words">';
        html += escapeHtml(pres.pitchText);
        html += '  </div>';
        html += '</div>';
    } else if (streamer) {
        html += '<div class="mb-6 text-sm text-corp-muted italic">(текст не написан — выступление голосом)</div>';
    }

    // ═══════ CARDS — адаптивная сетка ═══════
    html += renderCardGrid(presCards, 'presentation');

    html += '</div>'; // end stage

    // ═══════ PREVIOUS PRESENTATIONS ═══════
    if (prevs.length > 0) {
        html += '<div class="mt-6 mb-6">';
        html += '  <button id="btn-toggle-prev" class="flex items-center justify-center gap-2 w-full py-3 text-xs font-bold text-corp-muted uppercase tracking-widest hover:text-corp-light transition-colors cursor-pointer">';
        html += '    <span>📋 Предыдущие питчи (' + prevs.length + ')</span>';
        html += '    <span id="prev-arrow" class="transition-transform text-[0.7rem]">▼</span>';
        html += '  </button>';
        html += '  <div id="prev-list" class="hidden space-y-3 mt-3">';

        for (var i = 0; i < prevs.length; i++) {
            var pp = prevs[i];
            html += '<div class="corp-card px-5 py-4">';
            html += '  <div class="text-sm font-bold text-accent-gold mb-3">' + escapeHtml(pp.nickname) + '</div>';

            // Карточки предыдущего выступающего — компактные тэги
            html += '  <div class="flex flex-wrap gap-2">';
            for (var ct = 0; ct < CARD_TYPES.length; ct++) {
                var ctype = CARD_TYPES[ct];
                var cval = pp.cards[ctype.key];
                if (cval) {
                    var tagColor = ct === 0 ? 'bg-red-900/30 text-red-400' : ct === 1 ? 'bg-cyan-900/30 text-cyan-400' : 'bg-purple-900/30 text-purple-400';
                    html += '<span class="text-xs font-bold px-2.5 py-1 rounded-lg ' + tagColor + '">' + escapeHtml(cval) + '</span>';
                }
            }
            html += '  </div>';

            // Pitch text
            if (streamer && pp.pitchText && pp.pitchText.trim()) {
                html += '<div class="mt-3 text-xs text-corp-dim leading-relaxed bg-corp-black/30 rounded-xl p-4 border-l-2 border-accent-gold/20 whitespace-pre-wrap break-words">';
                html += escapeHtml(pp.pitchText);
                html += '</div>';
            }

            html += '</div>';
        }

        html += '  </div>';
        html += '</div>';
    }

    // ═══════ CONTROLS ═══════
    // Controls — только хост
    if (isHost) {
        html += '<div class="text-center mt-8">';
        html += '  <button id="btn-next-pres" class="btn-neon-solid px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-wider cursor-pointer">';
        html += '    ⏭ Следующий выступающий';
        html += '  </button>';
        html += '</div>';
    }

    html += '</div>'; // end main container

    container.innerHTML = html;

    // ═══════ EVENT LISTENERS ═══════
    container.querySelector('#btn-toggle-prev')?.addEventListener('click', function () {
        var list = container.querySelector('#prev-list');
        var arrow = container.querySelector('#prev-arrow');
        if (list && arrow) {
            list.classList.toggle('hidden');
            arrow.style.transform = list.classList.contains('hidden') ? '' : 'rotate(180deg)';
        }
    });

    container.querySelector('#btn-next-pres')?.addEventListener('click', function () {
        console.log('[presentation] Next presenter clicked');
        sendMsg({ type: 'nextPresenter' });
    });
}


// ═══════════════════════════════════════════════════════
// УНИВЕРСАЛЬНЫЙ РЕНДЕР КАРТ
// Работает с любым количеством карт (3, 5, 7...)
// mode: 'presentation' (средние) | 'preparation' (крупные)
// ═══════════════════════════════════════════════════════

function renderCardGrid(cards, mode) {
    if (!cards || cards.length === 0) return '';

    // Адаптивные размеры в зависимости от количества карт
    var sizeClass, heightClass, textClass;

    if (cards.length <= 3) {
        // 3 карты — крупные
        sizeClass = 'w-full max-w-[240px]';
        heightClass = 'h-[280px]';
        textClass = 'text-2xl font-black';
    } else if (cards.length <= 5) {
        // 4-5 карт — средние
        sizeClass = 'w-full max-w-[200px]';
        heightClass = 'h-[240px]';
        textClass = 'text-xl font-black';
    } else {
        // 6+ карт — компактные
        sizeClass = 'w-full max-w-[170px]';
        heightClass = 'h-[200px]';
        textClass = 'text-lg font-bold';
    }

    // Если mode === 'preparation' — делаем ещё крупнее
    if (mode === 'preparation') {
        if (cards.length <= 3) {
            sizeClass = 'w-full max-w-[300px]';
            heightClass = 'h-[360px]';
            textClass = 'text-3xl font-black';
        } else if (cards.length <= 5) {
            sizeClass = 'w-full max-w-[240px]';
            heightClass = 'h-[300px]';
            textClass = 'text-2xl font-black';
        }
    }

    var html = '';
    html += '<div class="flex flex-wrap items-center justify-center gap-4 lg:gap-6 mt-6">';

    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var delay = (i * 100) + 'ms';

        // Для особенности — чуть меньший шрифт если текст длинный
        var finalTextClass = textClass;
        if (card.label === 'Особенность' && card.value && card.value.length > 30) {
            finalTextClass = finalTextClass.replace('text-3xl', 'text-xl').replace('text-2xl', 'text-lg').replace('text-xl', 'text-base');
        }

        html += '<div class="game-card-container ' + sizeClass + '">';
        html += '  <div class="animate-card-deal" style="animation-delay: ' + delay + '; animation-fill-mode: backwards;">';
        html += '    <div class="relative ' + heightClass + ' rounded-3xl overflow-hidden ' + card.gradient + ' shadow-2xl ' + card.shadow + ' transition-transform duration-300 hover:scale-[1.03] hover:-translate-y-1">';

        // Badge bar
        html += '      <div class="absolute top-0 left-0 right-0 h-12 bg-black/25 flex items-center px-5">';
        html += '        <span class="text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/70">' + card.label + '</span>';
        html += '      </div>';

        // Text
        html += '      <div class="absolute inset-0 flex items-center justify-center px-6 text-center">';
        html += '        <span class="' + finalTextClass + ' leading-tight text-white drop-shadow-lg">' + escapeHtml(card.value) + '</span>';
        html += '      </div>';

        // Shimmer
        html += '      <div class="card-shimmer"></div>';

        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }

    html += '</div>';
    return html;
}

// Экспортируем для использования в других экранах
export { renderCardGrid, CARD_TYPES };