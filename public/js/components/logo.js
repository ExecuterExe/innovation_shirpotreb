// ═══════════════════════════════════════════
// Логотип ВПАРИТЬ: мегафон «выкрикивает» карты.
// Нарисован в SVG по частям, чтобы оживлять их по отдельности:
// .lg-mega — мегафон, .lg-ray — лучи звука, .lg-card-N — вылетающие карты.
// Анимации — в style.css (раздел «ЛОГОТИП»).
// ═══════════════════════════════════════════

var BLUE = '#1b2fe8';

// Звезда с центром в (0,0)
function star(r) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
        var rad = (Math.PI / 5) * i - Math.PI / 2;
        var rr = i % 2 === 0 ? r : r * 0.45;
        pts.push((Math.cos(rad) * rr).toFixed(1) + ',' + (Math.sin(rad) * rr).toFixed(1));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="#0a0a0a"/>';
}

// Карта: w×h с центром в (0,0)
function card(w, h, fill, inner) {
    return '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="6" fill="' + fill + '"/>' + inner;
}

/**
 * @param {object} opts
 *   size     — ширина в px (высота пропорциональна)
 *   animated — оживить (вылет карт, лучи, «крик»)
 *   className — дополнительные классы
 */
export function logoSvg(opts) {
    opts = opts || {};
    var size = opts.size || 160;
    var cls = 'vp-logo' + (opts.animated ? ' vp-logo-animated' : '') + (opts.className ? ' ' + opts.className : '');

    var svg = '';
    svg += '<svg class="' + cls + '" width="' + size + '" height="' + Math.round(size * 0.84) + '" viewBox="0 0 250 210" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ВПАРИТЬ">';

    // Лучи звука
    svg += '<g class="lg-ray lg-ray-1"><path d="M135 58 L160 24 L166 30 Z" fill="' + BLUE + '"/></g>';
    svg += '<g class="lg-ray lg-ray-2"><path d="M198 108 L236 94 L238 103 Z" fill="' + BLUE + '"/></g>';
    svg += '<g class="lg-ray lg-ray-3"><path d="M146 150 L180 164 L175 171 Z" fill="' + BLUE + '"/></g>';

    // Мегафон, повёрнут раструбом вправо-вверх
    svg += '<g class="lg-mega"><g transform="translate(4 62) rotate(-20 70 60)">';
    // ручка
    svg += '<g transform="rotate(-22 40 96)"><rect x="32" y="92" width="18" height="46" rx="4" fill="#fff"/><rect x="39" y="102" width="4" height="26" rx="2" fill="#0a0a0a"/></g>';
    // задняя часть
    svg += '<rect x="0" y="40" width="30" height="42" rx="13" fill="#fff"/>';
    svg += '<rect x="24" y="37" width="14" height="48" rx="4" fill="#fff" stroke="#0a0a0a" stroke-width="3"/>';
    // раструб
    svg += '<path d="M37 40 C 66 32, 92 16, 118 0 L118 122 C 92 108, 66 92, 37 82 Z" fill="#fff" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round"/>';
    // горловина: белый обод и синяя глубина
    svg += '<ellipse cx="121" cy="61" rx="21" ry="64" fill="#fff" stroke="#0a0a0a" stroke-width="4"/>';
    svg += '<ellipse cx="124" cy="61" rx="14" ry="54" fill="' + BLUE + '"/>';
    svg += '<path d="M112 50 C 124 48, 130 56, 128 66 C 126 72, 120 74, 114 76 Z" fill="#0a0a0a"/>';
    svg += '</g></g>';

    // Карты: внешняя группа — анимация, внутренняя — положение и наклон
    svg += '<g class="lg-card lg-card-1"><g transform="translate(171 103) rotate(-20)">'
        + card(46, 56, BLUE, '<g transform="translate(0 1)">' + star(15) + '</g>') + '</g></g>';
    svg += '<g class="lg-card lg-card-2"><g transform="translate(205 54) rotate(22)">'
        + card(40, 52, '#fff', '<text x="0" y="11" text-anchor="middle" font-family="Montserrat, Inter, sans-serif" font-weight="900" font-size="32" fill="#0a0a0a">?</text>') + '</g></g>';
    svg += '<g class="lg-card lg-card-3"><g transform="translate(211 150) rotate(26)">'
        + card(40, 50, '#fff', '<path d="M-11 8 L-12 -8 L-5 -1 L0 -10 L5 -1 L12 -8 L11 8 Z" fill="#0a0a0a"/>') + '</g></g>';

    svg += '</svg>';
    return svg;
}

// Статичная версия для фавикона и мест без движения
export function logoMarkSvg(size) {
    return logoSvg({ size: size || 40 });
}
