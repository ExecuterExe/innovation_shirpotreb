// ═══════════════════════════════════════════
// ТЕМЫ КАРТ — выбор категорий слов в колодах
// Каталог отдаёт сервер (/api/card-categories): по каждой колоде — темы с числом карт и примерами.
// Выбор хранится как { колода: [id тем] } только для колод, где включены не все темы;
// {} — всё включено (так по умолчанию).
// Нужен и лобби (классика и «Бункер»), и одиночному режиму.
// ═══════════════════════════════════════════
import { escapeHtml } from '../app.js';

var catalog = null;
var loading = null;
var failed = false;
var openDecks = {};   // какие «Что внутри?» раскрыты — переживает перерисовку панели
var expanded = false; // блок развёрнут

export function loadCardCatalog() {
    if (catalog) return Promise.resolve(catalog);
    if (!loading) {
        loading = fetch('/api/card-categories')
            .then(function (r) { return r.json(); })
            .then(function (d) { catalog = d && d.decks ? d : null; failed = !catalog; return catalog; })
            .catch(function () { failed = true; return null; })
            .then(function (c) { loading = null; return c; });
    }
    return loading;
}

export function cardCatalog() { return catalog; }
export function cardCatalogFailed() { return failed; }

// Цвета — как у карт в игре
var DECK_LOOK = {
    items:           { emoji: '📱', color: '#22d3ee' },
    adjectives:      { emoji: '🎨', color: '#f87171' },
    features:        { emoji: '✨', color: '#c084fc' },
    additions:       { emoji: '📜', color: '#34d399' },
    reviews:         { emoji: '💬', color: '#fbbf24' },
    targetAudience:  { emoji: '🎯', color: '#60a5fa' },
    hiddenDefects:   { emoji: '⚠️', color: '#fb923c' },
    packaging:       { emoji: '📦', color: '#2dd4bf' },
    gifts:           { emoji: '🎁', color: '#f472b6' },
    historicalFacts: { emoji: '🏛', color: '#a3e635' },
};

// Быстрые наборы: один клик вместо выбора по колодам. Колоды, которых нет в наборе, играют целиком.
// Наборы собраны из тем каталога (card-categories.js); тема, которой нет, просто пропускается.
export var CARD_PRESETS = [
    { id: 'all', emoji: '🎲', label: 'Всё подряд', hint: 'Все темы — максимум неожиданных сочетаний', sel: {} },
    { id: 'lesson', emoji: '🎓', label: 'Для урока', hint: 'Без смерти, криминала и мистики — для школы, вуза и корпоратива', sel: {
        items: ['food', 'home', 'tech', 'clothes', 'tools', 'science', 'leisure'],
        adjectives: ['character', 'material', 'tech', 'food'],
        additions: ['feelings', 'society', 'fun', 'life', 'abstract'],
        reviews: ['praise', 'complaints'],
        targetAudience: ['character', 'jobs', 'family'],
        hiddenDefects: ['quality', 'hassle'],
        packaging: ['food', 'containers'],
        historicalFacts: ['origin', 'fame', 'heroic'],
    } },
    { id: 'everyday', emoji: '🏠', label: 'Быт и повседневность', hint: 'Еда, дом, одежда — продукты, которые легко представить', sel: {
        items: ['food', 'home', 'clothes'],
        adjectives: ['character', 'material', 'food'],
        features: ['wellbeing', 'life'],
        additions: ['feelings', 'life'],
        reviews: ['praise', 'complaints', 'drama'],
        targetAudience: ['family', 'character'],
        hiddenDefects: ['quality', 'hassle'],
        packaging: ['food', 'containers'],
        gifts: ['home', 'junk'],
        historicalFacts: ['origin', 'fame'],
    } },
    { id: 'tech', emoji: '🚀', label: 'Техно и наука', hint: 'Гаджеты, инструменты, наука — для IT, инженеров и хакатонов', sel: {
        items: ['tech', 'tools', 'science'],
        adjectives: ['tech', 'material'],
        features: ['gear', 'life'],
        additions: ['fun', 'abstract'],
        targetAudience: ['jobs', 'character'],
        hiddenDefects: ['quality', 'danger'],
        gifts: ['tools', 'fun'],
        historicalFacts: ['origin', 'heroic', 'fame'],
    } },
    { id: 'chaos', emoji: '🌀', label: 'Хаос и мистика', hint: 'Оружие, магия, катастрофы и странности — для тех, кто любит пожёстче', sel: {
        items: ['other', 'tools'],
        adjectives: ['other', 'tech'],
        features: ['weird', 'gear'],
        additions: ['elements', 'society'],
        reviews: ['creepy', 'drama'],
        targetAudience: ['trouble', 'other'],
        hiddenDefects: ['danger'],
        gifts: ['junk', 'other'],
        historicalFacts: ['dark', 'mystic'],
    } },
];

// Сравниваем выборы без учёта порядка колод
function sameSelection(a, b) {
    var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) return false;
    return ka.every(function (k) { return a[k].join() === b[k].join(); });
}

// Какой набор сейчас выбран (или null — свой выбор)
export function activePreset(sel) {
    if (!catalog) return null;
    var cur = cleanSelection(sel || {});
    for (var i = 0; i < CARD_PRESETS.length; i++) {
        if (sameSelection(cur, cleanSelection(CARD_PRESETS[i].sel))) return CARD_PRESETS[i];
    }
    return null;
}

// Колоды, из которых раздают карты при этих настройках
export function decksInPlay(s) {
    s = s || {};
    if (s.bunkerMode) return ['items', 'adjectives', 'additions', 'features', 'gifts', 'hiddenDefects', 'packaging', 'reviews', 'historicalFacts'];
    var d = ['items', 'adjectives'];
    if (s.pseudoMode) return d;
    d.push('features');
    if (s.modifier === 'addition') d.push('additions');
    if (s.useTargetAudience) d.push('targetAudience');
    if (s.useHiddenDefects) d.push('hiddenDefects');
    if (s.usePackaging) d.push('packaging');
    if (s.useReviews) d.push('reviews');
    return d;
}

function groupIds(deck) {
    return catalog.decks[deck].groups.map(function (g) { return g.id; });
}

function isOn(sel, deck, id) {
    return !sel || !sel[deck] || sel[deck].indexOf(id) !== -1;
}

// Сколько карт колоды в игре при выборе
function cardsInPlay(sel, deck) {
    var n = 0;
    catalog.decks[deck].groups.forEach(function (g) { if (isOn(sel, deck, g.id)) n += g.count; });
    return n;
}

// Выбор без мусора: только известные колоды и темы, «всё выбрано» не храним
export function cleanSelection(sel) {
    var out = {};
    if (!catalog || !sel || typeof sel !== 'object') return out;
    Object.keys(sel).forEach(function (deck) {
        if (!catalog.decks[deck] || !Array.isArray(sel[deck])) return;
        var ids = groupIds(deck);
        var picked = ids.filter(function (id) { return sel[deck].indexOf(id) !== -1; });
        if (picked.length && picked.length < ids.length) out[deck] = picked;
    });
    return out;
}

// Переключить тему; null — если это была последняя включённая (без карт играть нельзя)
function toggled(sel, deck, id, only) {
    var ids = groupIds(deck);
    var cur = sel && sel[deck] ? sel[deck].slice() : ids.slice();
    if (only) {
        cur = [id];
    } else {
        var i = cur.indexOf(id);
        if (i !== -1) {
            if (cur.length === 1) return null;
            cur.splice(i, 1);
        } else {
            cur.push(id);
        }
    }
    var next = Object.assign({}, sel || {});
    if (cur.length >= ids.length) delete next[deck];
    else next[deck] = ids.filter(function (x) { return cur.indexOf(x) !== -1; });
    return next;
}

function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

// Одна строка о текущем выборе — для свёрнутого блока и сводки
export function selectionSummary(sel, decks) {
    if (!catalog) return '';
    var parts = [];
    decks.forEach(function (deck) {
        if (!catalog.decks[deck] || !sel || !sel[deck]) return;
        var labels = catalog.decks[deck].groups.filter(function (g) { return isOn(sel, deck, g.id); })
            .map(function (g) { return g.label; });
        parts.push(catalog.decks[deck].label + ': ' + labels.join(', '));
    });
    return parts.join(' · ');
}

// ── Разметка ──
// opts.decks — какие колоды показать; opts.readonly — только посмотреть (игроки в лобби)
export function cardCategoriesHtml(sel, opts) {
    opts = opts || {};
    var decks = (opts.decks || []).filter(function (d) { return catalog && catalog.decks[d]; });
    if (!catalog) {
        return '<div class="cc cc-loading">' + (failed ? '🗂 Темы карт сейчас недоступны — играем всеми картами' : '🗂 Загружаем темы карт…') + '</div>';
    }
    if (!decks.length) return '';

    var custom = decks.filter(function (d) { return sel && sel[d]; });
    var preset = activePreset(sel);
    var html = '<div class="cc' + (expanded ? ' cc-open' : '') + '" data-cc>';
    html += '<div class="cc-head">';
    html += '  <div class="cc-head-text"><b>🗂 Темы карт</b>';
    if (preset && preset.id !== 'all') {
        html += '<span class="cc-head-sub cc-head-custom">Набор «' + escapeHtml(preset.label) + '»: ' + escapeHtml(preset.hint.charAt(0).toLowerCase() + preset.hint.slice(1)) + '</span>';
    } else if (custom.length) {
        html += '<span class="cc-head-sub cc-head-custom">Свой набор: ' + escapeHtml(selectionSummary(sel, decks)) + '</span>';
    } else {
        html += '<span class="cc-head-sub">Все темы включены. Выберите готовый набор или настройте колоды сами</span>';
    }
    html += '  </div>';
    html += '  <button type="button" class="cc-expand" data-cc-expand>' + (expanded ? 'Свернуть' : 'Настроить') + '</button>';
    html += '</div>';
    // Быстрые наборы — видны и в свёрнутом блоке
    if (!opts.readonly) {
        html += '<div class="cc-presets" role="group" aria-label="Быстрые наборы тем">';
        CARD_PRESETS.forEach(function (p) {
            var on = preset ? preset.id === p.id : false;
            html += '<button type="button" class="cc-preset' + (on ? ' cc-preset-on' : '') + '" data-cc-preset="' + p.id + '" title="' + escapeHtml(p.hint) + '" aria-pressed="' + (on ? 'true' : 'false') + '">'
                + '<span>' + p.emoji + '</span>' + escapeHtml(p.label) + '</button>';
        });
        if (!preset) html += '<span class="cc-preset cc-preset-on cc-preset-custom">✏️ Свой набор</span>';
        html += '</div>';
    }

    if (expanded) {
        html += '<div class="cc-note">Карты раздаются только из включённых тем. Тема становится отдельной, когда в ней набирается ' + catalog.min + ' карт, — пока меньше, её слова лежат в «Остальном». Двойной клик (или двойное касание) по теме — оставить только её.</div>';
        decks.forEach(function (deck) {
            var d = catalog.decks[deck];
            var look = DECK_LOOK[deck] || { emoji: '🃏', color: '#ffc72c' };
            var n = cardsInPlay(sel, deck);
            var partial = !!(sel && sel[deck]);
            html += '<div class="cc-deck' + (partial ? ' cc-deck-partial' : '') + '" style="--c:' + look.color + '">';
            html += '<div class="cc-deck-head">';
            html += '  <span class="cc-deck-name">' + look.emoji + ' ' + escapeHtml(d.label) + '</span>';
            html += '  <span class="cc-deck-count">' + (partial ? '<b>' + n + '</b> из ' : '') + d.total + ' ' + plural(d.total, 'карта', 'карты', 'карт') + '</span>';
            if (partial && !opts.readonly) html += '  <button type="button" class="cc-all" data-cc-all="' + deck + '">Вернуть все</button>';
            html += '</div>';
            html += '<div class="cc-chips">';
            d.groups.forEach(function (g) {
                var on = isOn(sel, deck, g.id);
                var tip = g.id === 'other' && g.includes
                    ? 'Внутри: ' + g.includes.map(function (x) { return x.label + ' (' + x.count + ')'; }).join(', ')
                    : 'Например: ' + (g.examples || []).join(', ');
                html += '<button type="button" class="cc-chip' + (on ? ' cc-chip-on' : '') + (g.id === 'other' ? ' cc-chip-other' : '') + '"'
                    + ' data-cc-deck="' + deck + '" data-cc-id="' + escapeHtml(g.id) + '" title="' + escapeHtml(tip) + '"'
                    + (opts.readonly ? ' disabled' : '') + ' aria-pressed="' + (on ? 'true' : 'false') + '">'
                    + '<span class="cc-chip-check">' + (on ? '✓' : '') + '</span>'
                    + (g.emoji ? '<span>' + g.emoji + '</span>' : '')
                    + '<span class="cc-chip-label">' + escapeHtml(g.label) + '</span>'
                    + '<i>' + g.count + '</i></button>';
            });
            html += '</div>';
            // Что внутри: примеры слов по темам
            html += '<details class="cc-more" data-cc-more="' + deck + '"' + (openDecks[deck] ? ' open' : '') + '><summary>Что внутри?</summary><div class="cc-more-list">';
            d.groups.forEach(function (g) {
                html += '<div class="cc-more-row"><b>' + (g.emoji ? g.emoji + ' ' : '') + escapeHtml(g.label) + '</b> ';
                if (g.id === 'other' && g.includes) {
                    html += '<span class="cc-more-inc">сюда входят темы меньше ' + catalog.min + ' карт: ' + g.includes.map(function (x) {
                        return escapeHtml(x.label) + ' — ' + x.count;
                    }).join(', ') + '.</span> ';
                }
                html += '<span>' + (g.examples || []).map(function (w) { return escapeHtml(shorten(w)); }).join(' · ') + '…</span></div>';
            });
            html += '</div></details>';
            html += '</div>';
        });
    }
    html += '</div>';
    return html;
}

function shorten(w) {
    w = String(w || '');
    return w.length > 48 ? w.slice(0, 46).replace(/\s+\S*$/, '') + '…' : w;
}

// onChange(nextSelection) — сохранить и перерисовать; rerender() — только перерисовать;
// onEmpty() — попытка выключить последнюю тему
export function bindCardCategories(root, getSel, onChange, rerender, onEmpty) {
    root.querySelectorAll('[data-cc]').forEach(function (box) { bindBox(box, getSel, onChange, rerender, onEmpty); });
}

function bindBox(box, getSel, onChange, rerender, onEmpty) {
    var exp = box.querySelector('[data-cc-expand]');
    if (exp) exp.addEventListener('click', function () { expanded = !expanded; rerender(); });
    box.querySelectorAll('[data-cc-preset]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-cc-preset');
            var p = CARD_PRESETS.filter(function (x) { return x.id === id; })[0];
            if (p) onChange(cleanSelection(p.sel));
        });
    });
    box.querySelectorAll('[data-cc-all]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var next = Object.assign({}, getSel() || {});
            delete next[btn.getAttribute('data-cc-all')];
            onChange(next);
        });
    });
    box.querySelectorAll('.cc-chip[data-cc-id]').forEach(function (chip) {
        var deck = chip.getAttribute('data-cc-deck');
        var id = chip.getAttribute('data-cc-id');
        // Клик переключает тему сразу. Двойной клик — это два переключения (тема вернулась
        // как была) и dblclick поверх: оставляем только эту тему
        chip.addEventListener('click', function () {
            var next = toggled(getSel(), deck, id, false);
            if (!next) { if (onEmpty) onEmpty(); return; }
            onChange(next);
        });
    });
    // dblclick ловим на блоке: после первого клика чип уже перерисован
    box.addEventListener('dblclick', function (e) {
        var chip = e.target.closest && e.target.closest('.cc-chip[data-cc-id]');
        if (!chip || chip.disabled) return;
        onChange(toggled(getSel(), chip.getAttribute('data-cc-deck'), chip.getAttribute('data-cc-id'), true));
    });
    box.querySelectorAll('[data-cc-more]').forEach(function (det) {
        det.addEventListener('toggle', function () { openDecks[det.getAttribute('data-cc-more')] = det.open; });
    });
}
