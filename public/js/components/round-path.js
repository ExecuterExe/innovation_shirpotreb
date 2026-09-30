// ═══════════════════════════════════════════
// ЛЕНТА РАУНДА — классическая игра
// Подготовка → Питчи → Инвестиции → Итоги: где мы сейчас и что будет дальше.
// Вставляется сверху на каждом экране раунда (app.js → navigate).
// ═══════════════════════════════════════════
import { state } from '../app.js';

var STEPS = [
    { key: 'prep', emoji: '🧠', label: 'Подготовка' },
    { key: 'pitch', emoji: '🎤', label: 'Питчи' },
    { key: 'invest', emoji: '💼', label: 'Инвестиции' },
    { key: 'results', emoji: '🏆', label: 'Итоги' },
];

var PHASE_STEP = {
    cardInput: 'prep', productDraft: 'prep',  preparation: 'prep',
    presentation: 'pitch', gallery: 'pitch',
    investing: 'invest', tied: 'invest', tiebreaker: 'invest', tiebreaker_voting: 'invest',
    results: 'results',
};

export var ROUND_PATH_PHASES = Object.keys(PHASE_STEP);

export function roundPathHtml(phase) {
    var active = PHASE_STEP[phase];
    if (!active) return '';
    // Галерея «Испорченного прототипа»: вместо подготовки — рисование, вместо питчей — показ, вложений нет
    var gallery = !!(state.settings && state.settings.drawMode && !state.settings.bunkerMode && state.settings.protoFinale !== 'pitch');
    var steps = gallery ? STEPS.filter(function (st) { return st.key !== 'invest'; }) : STEPS;
    var label = function (st) {
        if (!gallery) return st.label;
        return { prep: 'Рисуем', pitch: 'Галерея' }[st.key] || st.label;
    };
    var emoji = function (st) {
        if (!gallery) return st.emoji;
        return { prep: '🎨', pitch: '🖼️' }[st.key] || st.emoji;
    };
    var idx = 0;
    for (var i = 0; i < steps.length; i++) if (steps[i].key === active) idx = i;
    var tie = phase === 'tied' || phase === 'tiebreaker' || phase === 'tiebreaker_voting';
    var round = state.currentRound || 1;
    var total = state.totalRounds || round;
    var last = round >= total && total > 1;

    // На подготовке, питчах и инвестициях номер раунда уже есть в шапке экрана — не дублируем
    var hasHud = phase === 'productDraft' || phase === 'drawing' || phase === 'naming' || phase === 'slogan' || phase === 'preparation' || phase === 'presentation' || phase === 'investing';
    var html = '<nav class="round-path" aria-label="Этапы раунда">';
    if (!hasHud || last) {
        html += '<div class="round-path-round' + (last ? ' round-path-last' : '') + '">';
        html += last ? '🔥 Финальный раунд' : 'Раунд <b>' + round + '</b> из ' + total;
        html += '</div>';
    }
    html += '<ol class="round-path-steps">';
    for (var s = 0; s < steps.length; s++) {
        var cls = s < idx ? 'rp-done' : (s === idx ? 'rp-now' : 'rp-next');
        html += '<li class="rp-step ' + cls + '"' + (s === idx ? ' aria-current="step"' : '') + '>';
        html += '<span class="rp-dot">' + (s < idx ? '✓' : emoji(steps[s])) + '</span>';
        html += '<span class="rp-label">' + label(steps[s]) + (tie && s === idx ? ' <em>⚔️ ничья</em>' : '') + '</span>';
        html += '</li>';
        if (s < steps.length - 1) html += '<li class="rp-line' + (s < idx ? ' rp-line-done' : '') + '" aria-hidden="true"></li>';
    }
    html += '</ol>';
    html += '</nav>';
    return html;
}
