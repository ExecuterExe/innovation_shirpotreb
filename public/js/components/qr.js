// ═══════════════════════════════════════════
// QR-КОД — собственный генератор без зависимостей
// Байтовый режим (UTF-8), уровень коррекции M, версии 1–10 (до ~200 байт — ссылке на комнату хватает с запасом).
// Алгоритм по стандарту ISO/IEC 18004; маска выбирается по штрафным баллам, как в эталонных реализациях.
// qrSvg(text, { size, dark, light }) → строка <svg>.
// ═══════════════════════════════════════════

// Уровень M: [число EC-кодовых слов на блок, [блоков, данных в блоке], [блоков, данных в блоке]?]
var M_BLOCKS = [
    null,
    [10, [1, 16]],
    [16, [1, 28]],
    [26, [1, 44]],
    [18, [2, 32]],
    [24, [2, 43]],
    [16, [4, 27]],
    [18, [4, 31]],
    [22, [2, 38], [2, 39]],
    [22, [3, 36], [2, 37]],
    [26, [4, 43], [1, 44]],
];
var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

function dataCapacity(ver) {
    var b = M_BLOCKS[ver], n = b[1][0] * b[1][1];
    if (b[2]) n += b[2][0] * b[2][1];
    return n;
}

// ── Поле Галуа GF(256), многочлен 0x11D ──
function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11D);
        z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
}
function rsDivisor(degree) {
    var res = [];
    for (var i = 0; i < degree - 1; i++) res.push(0);
    res.push(1);
    var root = 1;
    for (var d = 0; d < degree; d++) {
        for (var j = 0; j < res.length; j++) {
            res[j] = gfMul(res[j], root);
            if (j + 1 < res.length) res[j] ^= res[j + 1];
        }
        root = gfMul(root, 0x02);
    }
    return res;
}
function rsRemainder(data, divisor) {
    var res = divisor.map(function () { return 0; });
    data.forEach(function (b) {
        var factor = b ^ res.shift();
        res.push(0);
        divisor.forEach(function (coef, i) { res[i] ^= gfMul(coef, factor); });
    });
    return res;
}

function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
    var out = [], s = unescape(encodeURIComponent(text));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
}

// ── Кодирование данных в кодовые слова (с коррекцией и перемежением) ──
function encodeCodewords(bytes, ver) {
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(0x4, 4);                                  // байтовый режим
    put(bytes.length, ver < 10 ? 8 : 16);         // длина
    bytes.forEach(function (b) { put(b, 8); });
    var capBits = dataCapacity(ver) * 8;
    put(0, Math.min(4, capBits - bits.length));   // терминатор
    while (bits.length % 8) bits.push(0);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
        var v = 0;
        for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
        data.push(v);
    }
    for (var pad = 0xEC; data.length < dataCapacity(ver); pad ^= 0xEC ^ 0x11) data.push(pad);

    // Блоки и коррекция ошибок
    var spec = M_BLOCKS[ver], ecLen = spec[0], blocks = [], pos = 0;
    [spec[1], spec[2]].forEach(function (g) {
        if (!g) return;
        for (var n = 0; n < g[0]; n++) {
            var d = data.slice(pos, pos + g[1]);
            pos += g[1];
            blocks.push({ d: d, e: rsRemainder(d, rsDivisor(ecLen)) });
        }
    });
    // Перемежение: сначала данные всех блоков по столбцам, затем коррекция
    var out = [], maxD = 0;
    blocks.forEach(function (b) { maxD = Math.max(maxD, b.d.length); });
    for (var c = 0; c < maxD; c++) blocks.forEach(function (b) { if (c < b.d.length) out.push(b.d[c]); });
    for (var e = 0; e < ecLen; e++) blocks.forEach(function (b) { out.push(b.e[e]); });
    return out;
}

// ── Матрица ──
function buildMatrix(codewords, ver, mask) {
    var size = ver * 4 + 17;
    var mod = [], fn = [];
    for (var y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(x, y, dark) { mod[y][x] = dark; fn[y][x] = true; }

    // Синхронизирующие линии
    for (var i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    // Поисковые узоры
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
        for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
            var dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
            if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, dist !== 2 && dist !== 4);
        }
    });
    // Выравнивающие узоры
    var al = ALIGN[ver], last = al.length - 1;
    for (var a = 0; a < al.length; a++) for (var b = 0; b < al.length; b++) {
        if ((a === 0 && b === 0) || (a === 0 && b === last) || (a === last && b === 0)) continue;
        for (var ay = -2; ay <= 2; ay++) for (var ax = -2; ax <= 2; ax++) {
            setF(al[a] + ax, al[b] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
        }
    }
    // Формат (пока резервируем) и версия
    drawFormat(0);
    if (ver >= 7) {
        var rem = ver;
        for (var r = 0; r < 12; r++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
        var vbits = (ver << 12) | rem;
        for (var vi = 0; vi < 18; vi++) {
            var bit = ((vbits >>> vi) & 1) === 1, p = size - 11 + (vi % 3), q = Math.floor(vi / 3);
            setF(p, q, bit); setF(q, p, bit);
        }
    }

    function drawFormat(m) {
        var data = (0 << 3) | m;                // уровень M = 00
        var rem = data;
        for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        var bits = ((data << 10) | rem) ^ 0x5412;
        function g(i) { return ((bits >>> i) & 1) === 1; }
        for (var i = 0; i <= 5; i++) setF(8, i, g(i));
        setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
        for (var j = 9; j < 15; j++) setF(14 - j, 8, g(j));
        for (var s = 0; s < 8; s++) setF(size - 1 - s, 8, g(s));
        for (var t = 8; t < 15; t++) setF(8, size - 15 + t, g(t));
        setF(8, size - 8, true);                  // тёмный модуль
    }

    // Данные змейкой снизу справа
    var idx = 0, total = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (var vert = 0; vert < size; vert++) {
            for (var jj = 0; jj < 2; jj++) {
                var x = right - jj, upward = ((right + 1) & 2) === 0, yy2 = upward ? size - 1 - vert : vert;
                if (!fn[yy2][x] && idx < total) {
                    mod[yy2][x] = ((codewords[idx >>> 3] >>> (7 - (idx & 7))) & 1) === 1;
                    idx++;
                }
            }
        }
    }
    // Маска
    for (var my = 0; my < size; my++) for (var mx = 0; mx < size; mx++) {
        if (fn[my][mx]) continue;
        var inv;
        switch (mask) {
            case 0: inv = (mx + my) % 2 === 0; break;
            case 1: inv = my % 2 === 0; break;
            case 2: inv = mx % 3 === 0; break;
            case 3: inv = (mx + my) % 3 === 0; break;
            case 4: inv = (Math.floor(mx / 3) + Math.floor(my / 2)) % 2 === 0; break;
            case 5: inv = (mx * my) % 2 + (mx * my) % 3 === 0; break;
            case 6: inv = ((mx * my) % 2 + (mx * my) % 3) % 2 === 0; break;
            default: inv = ((mx + my) % 2 + (mx * my) % 3) % 2 === 0;
        }
        if (inv) mod[my][mx] = !mod[my][mx];
    }
    drawFormat(mask);
    return mod;
}

// Штраф маски (правила 1–4 стандарта): чем меньше, тем легче сканировать
function penalty(m) {
    var size = m.length, score = 0, dark = 0;
    function runs(get) {
        for (var a = 0; a < size; a++) {
            var run = 1;
            for (var b = 1; b < size; b++) {
                if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
                else run = 1;
            }
        }
    }
    runs(function (y, x) { return m[y][x]; });
    runs(function (x, y) { return m[y][x]; });
    for (var y = 0; y < size - 1; y++) for (var x = 0; x < size - 1; x++) {
        var c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
    }
    var pat = [true, false, true, true, true, false, true];
    function finderLike(get) {
        for (var a = 0; a < size; a++) for (var b = 0; b + 7 <= size; b++) {
            var ok = true;
            for (var k = 0; k < 7 && ok; k++) if (get(a, b + k) !== pat[k]) ok = false;
            if (!ok) continue;
            var before = true, after = true;
            for (var q = 1; q <= 4; q++) {
                if (b - q >= 0 && get(a, b - q)) before = false;
                if (b + 6 + q < size && get(a, b + 6 + q)) after = false;
            }
            if (before || after) score += 40;
        }
    }
    finderLike(function (y, x) { return m[y][x]; });
    finderLike(function (x, y) { return m[y][x]; });
    for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) if (m[yy][xx]) dark++;
    var total = size * size;
    score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
    return score;
}

export function qrMatrix(text) {
    var bytes = utf8Bytes(String(text));
    var ver = 1;
    while (ver <= 10 && dataCapacity(ver) < bytes.length + (ver < 10 ? 2 : 3)) ver++;
    if (ver > 10) throw new Error('QR: слишком длинный текст');
    var cw = encodeCodewords(bytes, ver);
    var best = null, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
        var m = buildMatrix(cw, ver, mask), s = penalty(m);
        if (s < bestScore) { bestScore = s; best = m; }
    }
    return best;
}

// SVG с «тихой зоной» в 4 модуля (без неё телефоны сканируют хуже)
export function qrSvg(text, opts) {
    opts = opts || {};
    var m = qrMatrix(text), n = m.length, q = 4, full = n + q * 2;
    var path = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) path += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z';
    var size = opts.size || 200;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + full + ' ' + full + '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges" role="img" aria-label="QR-код">'
        + '<rect width="' + full + '" height="' + full + '" fill="' + (opts.light || '#ffffff') + '"/>'
        + '<path d="' + path + '" fill="' + (opts.dark || '#000000') + '"/></svg>';
}
