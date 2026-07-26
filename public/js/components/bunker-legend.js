// ═══════════════════════════════════════════
// ПАМЯТКА ПО ТИПАМ КАРТ (бункер)
// ═══════════════════════════════════════════

var LEGEND_COLLAPSED = false; // по умолчанию открыта — особенно полезно в первой игре

var LEGEND_ITEMS = [
    { emoji: '🎨', label: 'Прилагательное', desc: 'Это свойство продукта.' },
    { emoji: '📦', label: 'Предмет', desc: 'Это сам продукт — основа вашего изобретения.' },
    {
        emoji: '📜', label: 'Модификатор', desc: 'Одно слово, которое приклеивается к предмету и усиливает образ.',
        example: 'Предмет «Утюг» + модификатор «СПРАВЕДЛИВОСТИ» → «Утюг СПРАВЕДЛИВОСТИ»',
        highlight: true,
    },
    { emoji: '✨', label: 'Особенность', desc: 'Что продукт умеет или чем он необычен.' },
    { emoji: '🎁', label: 'Бонус к продукту', desc: 'Мелочь, которая идёт в комплекте — просто приятный довесок.' },
    { emoji: '⚠️', label: 'Скрытый дефект', desc: 'Недостаток продукта.' },
    { emoji: '📦', label: 'Упаковка', desc: 'В чём продукт принесён.' },
    {
        emoji: '💬', label: 'Первый отзыв', desc: 'Цитата от первого покупателя — не факт о товаре, а именно чужие слова о нём.',
        example: 'Например: «После использования от меня ушла жена. Спасибо!» — это отзыв, а не характеристика',
        highlight: true,
    },
    { emoji: '📜', label: 'Исторический факт', desc: 'Деталь из прошлого продукта или его автора.' },
];

export function renderBunkerLegend(container) {
    var existing = container.querySelector('#bunker-legend-panel');
    if (existing) return; // уже отрисована

    var isCollapsed = LEGEND_COLLAPSED;

    var html = '';
    html += '<div id="bunker-legend-panel" class="bunker-legend-panel' + (isCollapsed ? ' bunker-legend-collapsed' : '') + '">';

    html += '  <div class="bunker-legend-header">';
    html += '    <span class="text-xs font-black text-corp-dim uppercase tracking-widest">📖 Памятка по картам</span>';
    html += '    <button id="btn-legend-toggle" class="chat-icon-btn text-corp-muted hover:text-corp-light">' + (isCollapsed ? '＋' : '－') + '</button>';
    html += '  </div>';

    if (!isCollapsed) {
        html += '  <div class="bunker-legend-body">';
        for (var i = 0; i < LEGEND_ITEMS.length; i++) {
            var item = LEGEND_ITEMS[i];
            html += '<div class="bunker-legend-item' + (item.highlight ? ' bunker-legend-item-highlight' : '') + '">';
            html += '  <div class="bunker-legend-item-head">';
            html += '    <span class="bunker-legend-emoji">' + item.emoji + '</span>';
            html += '    <span class="bunker-legend-label">' + item.label + '</span>';
            if (item.highlight) html += '<span class="bunker-legend-star" title="Часто путают">★</span>';
            html += '  </div>';
            html += '  <div class="bunker-legend-desc">' + item.desc + '</div>';
            if (item.example) {
                html += '  <div class="bunker-legend-example">' + item.example + '</div>';
            }
            html += '</div>';
        }
        html += '  </div>';
    }

    html += '</div>';

    var layout = container.querySelector('.bunker-layout');
    if (layout) {
        layout.insertAdjacentHTML('beforeend', html);
    } else {
        container.insertAdjacentHTML('beforeend', html);
    }

    var toggleBtn = container.querySelector('#btn-legend-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            LEGEND_COLLAPSED = !LEGEND_COLLAPSED;
            var panel = container.querySelector('#bunker-legend-panel');
            if (panel) panel.remove();
            renderBunkerLegend(container);
        });
    }
}
