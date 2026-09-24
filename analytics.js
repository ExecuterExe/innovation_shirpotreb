// =====================================================================
// АНАЛИТИКА — без БД, на файлах
// =====================================================================
// Зачем: сейчас игра работает «вслепую» — неизвестно ни сколько людей зашло,
// ни сколько игр доиграли до конца. Этот модуль пишет три вещи:
//   1. counters.json  — агрегаты (всего и по дням) для быстрого отчёта
//   2. events.jsonl   — поток событий, если захочется копнуть глубже
//   3. games/*.json   — полный результат каждой сыгранной партии
// Плюс собирает лиды с fake-door кнопки и ответы мини-опроса.
//
// Всё пишется буферизованно (раз в FLUSH_INTERVAL), чтобы не дёргать диск
// на каждое действие игрока. Персональных данных не пишем: только никнеймы,
// которые игрок придумал сам, без IP и без чего-либо, что связывает с личностью.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const GAMES_DIR = path.join(DATA_DIR, 'games');
const COUNTERS_FILE = path.join(DATA_DIR, 'counters.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');
const SURVEY_FILE = path.join(DATA_DIR, 'survey.jsonl');

const FLUSH_INTERVAL = 10 * 1000;
const MAX_GAME_FILES = 2000; // защита от бесконечного роста папки

let counters = { total: {}, byDay: {} };
let dirty = false;
let eventBuffer = [];

// ── Инициализация ──────────────────────────────────────────────────────
function init() {
    try {
        fs.mkdirSync(GAMES_DIR, { recursive: true });
    } catch (e) {
        console.error('[analytics] не удалось создать папку данных:', e.message);
    }
    try {
        if (fs.existsSync(COUNTERS_FILE)) {
            const raw = JSON.parse(fs.readFileSync(COUNTERS_FILE, 'utf8'));
            if (raw && typeof raw === 'object') {
                counters.total = raw.total || {};
                counters.byDay = raw.byDay || {};
            }
        }
    } catch (e) {
        console.error('[analytics] counters.json повреждён, начинаем с нуля:', e.message);
    }
    setInterval(flush, FLUSH_INTERVAL).unref();
    // При штатной остановке сервера не теряем последние 10 секунд
    process.on('SIGINT', function () { flush(); process.exit(0); });
    process.on('SIGTERM', function () { flush(); process.exit(0); });
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

// ── Основной API ───────────────────────────────────────────────────────

// Увеличить счётчик. Вызывать из любого места, дёшево.
function bump(key, delta) {
    const n = delta || 1;
    const day = today();
    counters.total[key] = (counters.total[key] || 0) + n;
    if (!counters.byDay[day]) counters.byDay[day] = {};
    counters.byDay[day][key] = (counters.byDay[day][key] || 0) + n;
    dirty = true;
}

// Записать событие в лог (и заодно увеличить одноимённый счётчик).
function track(event, props) {
    bump(event);
    const row = Object.assign({ t: new Date().toISOString(), e: event }, props || {});
    eventBuffer.push(JSON.stringify(row));
    if (eventBuffer.length > 200) flush();
}

function flush() {
    if (dirty) {
        try {
            fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2));
            dirty = false;
        } catch (e) {
            console.error('[analytics] не смог записать counters.json:', e.message);
        }
    }
    if (eventBuffer.length) {
        const chunk = eventBuffer.join('\n') + '\n';
        eventBuffer = [];
        try {
            fs.appendFileSync(EVENTS_FILE, chunk);
        } catch (e) {
            console.error('[analytics] не смог дописать events.jsonl:', e.message);
        }
    }
}

// Сохранить результат партии целиком — это самое ценное, что есть:
// из этих файлов потом собирается прогресс игрока и отчёт для преподавателя.
function saveGame(result) {
    try {
        const files = fs.readdirSync(GAMES_DIR);
        if (files.length >= MAX_GAME_FILES) return;
        const name = Date.now() + '-' + (result.code || 'XXXXX') + '.json';
        fs.writeFileSync(path.join(GAMES_DIR, name), JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('[analytics] не смог сохранить партию:', e.message);
    }
}

function appendLine(file, obj) {
    try {
        fs.appendFileSync(file, JSON.stringify(Object.assign({ t: new Date().toISOString() }, obj)) + '\n');
    } catch (e) {
        console.error('[analytics] не смог дописать', path.basename(file), e.message);
    }
}

function saveLead(lead) {
    appendLine(LEADS_FILE, lead);
    bump('lead_submitted');
}

function saveSurvey(answer) {
    appendLine(SURVEY_FILE, answer);
    bump('survey_submitted');
}

// ── Сводка для /api/stats ──────────────────────────────────────────────
function getStats() {
    flush();

    const t = counters.total;
    const started = (t.game_started || 0);
    const finished = (t.game_finished || 0);

    // Средняя оценка из мини-опроса — прямой замер гипотезы «игра придаёт уверенности»
    const survey = readSurveySummary();

    return {
        generatedAt: new Date().toISOString(),
        total: t,
        byDay: counters.byDay,
        derived: {
            // Доходимость: сколько начатых партий доигрывают до финала.
            // Низкая цифра = игра затянута или люди теряют интерес — это повод резать раунды.
            completionRate: started ? Math.round((finished / started) * 100) + '%' : 'нет данных',
            // Сколько людей в среднем приводит один хост — экономика привлечения.
            playersPerRoom: (t.rooms_created && t.player_joined)
                ? ((t.player_joined / t.rooms_created).toFixed(1))
                : 'нет данных',
            // Конверсия визита в создание комнаты — насколько понятна главная страница.
            visitToRoom: (t.visit && t.rooms_created)
                ? (Math.round((t.rooms_created / t.visit) * 1000) / 10) + '%'
                : 'нет данных',
            // Главная цифра для разговора о деньгах: сколько людей нажали
            // на платную функцию и сколько из них оставили почту.
            fakeDoorClickToLead: (t.fakedoor_click && t.lead_submitted)
                ? (Math.round((t.lead_submitted / t.fakedoor_click) * 1000) / 10) + '%'
                : 'нет данных',
        },
        survey,
        leads: readLeads(),
    };
}

function readSurveySummary() {
    try {
        if (!fs.existsSync(SURVEY_FILE)) return { count: 0 };
        const lines = fs.readFileSync(SURVEY_FILE, 'utf8').trim().split('\n').filter(Boolean);
        let sumConfidence = 0, nConfidence = 0;
        let scary = 0, nScary = 0;
        lines.forEach(function (line) {
            try {
                const r = JSON.parse(line);
                if (typeof r.confidence === 'number') { sumConfidence += r.confidence; nConfidence++; }
                if (typeof r.wasScary === 'boolean') { nScary++; if (r.wasScary) scary++; }
            } catch (e) { /* битая строка — пропускаем */ }
        });
        return {
            count: lines.length,
            avgConfidence: nConfidence ? Math.round((sumConfidence / nConfidence) * 10) / 10 : null,
            scaryShare: nScary ? Math.round((scary / nScary) * 100) + '%' : null,
        };
    } catch (e) {
        return { count: 0, error: e.message };
    }
}

function readLeads() {
    try {
        if (!fs.existsSync(LEADS_FILE)) return [];
        return fs.readFileSync(LEADS_FILE, 'utf8').trim().split('\n').filter(Boolean)
            .map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } })
            .filter(Boolean);
    } catch (e) {
        return [];
    }
}

module.exports = { init, bump, track, saveGame, saveLead, saveSurvey, getStats, flush };
