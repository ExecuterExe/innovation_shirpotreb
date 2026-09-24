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
    cardInput: 'prep', preparation: 'prep',
    presentation: 'pitch',
    investing: 'invest', tied: 'invest', tiebreaker: 'invest', tiebreaker_voting: 'invest',
    results: 'results',
};

export var ROUND_PATH_PHASES = Object.keys(PHASE_STEP);

export function roundPathHtml(phase) {
    var active = PHASE_STEP[phase];
    if (!active) return '';
    var idx = 0;
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].key === active) idx = i;
    var tie = phase === 'tied' || phase === 'tiebreaker' || phase === 'tiebreaker_voting';
    var round = state.currentRound || 1;
    var total = state.totalRounds || round;
    var last = round >= total && total > 1;

    // На подготовке, питчах и инвестициях номер раунда уже есть в шапке экрана — не дублируем
    var hasHud = phase === 'preparation' || phase === 'presentation' || phase === 'investing';
    var html = '<nav class="round-path" aria-label="Этапы раунда">';
    if (!hasHud || last) {
        html += '<div class="round-path-round' + (last ? ' round-path-last' : '') + '">';
        html += last ? '🔥 Финальный раунд' : 'Раунд <b>' + round + '</b> из ' + total;
        html += '</div>';
    }
    html += '<ol class="round-path-steps">';
    for (var s = 0; s < STEPS.length; s++) {
        var cls = s < idx ? 'rp-done' : (s === idx ? 'rp-now' : 'rp-next');
        html += '<li class="rp-step ' + cls + '"' + (s === idx ? ' aria-current="step"' : '') + '>';
        html += '<span class="rp-dot">' + (s < idx ? '✓' : STEPS[s].emoji) + '</span>';
        html += '<span class="rp-label">' + STEPS[s].label + (tie && s === idx ? ' <em>⚔️ ничья</em>' : '') + '</span>';
        html += '</li>';
        if (s < STEPS.length - 1) html += '<li class="rp-line' + (s < idx ? ' rp-line-done' : '') + '" aria-hidden="true"></li>';
    }
    html += '</ol>';
    html += '</nav>';
    return html;
}
