import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';
import { showNotification } from '../components/notification.js';

var submitted = false;

var PHASE_CONFIG = {
    adjective: {
        emoji: '🎨',
        title: 'ПРИДУМАЙТЕ ПРИЛАГАТЕЛЬНОЕ',
        subtitle: 'Какое свойство будет у чьего-то продукта?',
        placeholder: 'Например: Летающий, Съедобный, Проклятый...',
        hint: 'Одно слово — прилагательное в мужском роде',
        color: 'accent-red',
        maxLength: 40,
    },
    item: {
        emoji: '📦',
        title: 'ПРИДУМАЙТЕ ПРЕДМЕТ',
        subtitle: 'Что станет основой чьего-то бизнеса?',
        placeholder: 'Например: Утюг, Кактус, Бутерброд...',
        hint: 'Одно существительное в именительном падеже',
        color: 'accent-blue',
        maxLength: 40,
    },
    feature: {
        emoji: '✨',
        title: 'ПРИДУМАЙТЕ ОСОБЕННОСТЬ',
        subtitle: 'Какая безумная фишка будет у продукта?',
        placeholder: 'Например: Который работает от мысли человека',
        hint: 'Начните с "Который..." — опишите уникальное свойство',
        color: 'accent-purple',
        maxLength: 120,
    },
    review: {
        emoji: '💬',
        title: 'ПРИДУМАЙТЕ ОТЗЫВ',
        subtitle: 'Какой первый отзыв получит чей-то продукт?',
        placeholder: 'Например: После использования от меня ушла жена!',
        hint: 'Напишите смешной/абсурдный отзыв от лица покупателя',
        color: 'accent-gold',
        maxLength: 150,
    },
    targetAudience: {
        emoji: '🎯',
        title: 'ПРИДУМАЙТЕ ЦЕЛЕВУЮ АУДИТОРИЮ',
        subtitle: 'Для кого будет чей-то продукт?',
        placeholder: 'Например: Для геймеров, Для бабушек, Для инопланетян...',
        hint: 'Начните с "Для..." — опишите группу людей',
        color: 'accent-pink',
        maxLength: 80,
    },
    hiddenDefect: {
        emoji: '⚠️',
        title: 'ПРИДУМАЙТЕ СКРЫТЫЙ ДЕФЕКТ',
        subtitle: 'Какой тайный недостаток будет у продукта?',
        placeholder: 'Например: Разряжается за 1 час, Может взорваться...',
        hint: 'Опишите скрытую проблему продукта',
        color: 'accent-orange',
        maxLength: 100,
    },
    packaging: {
        emoji: '📦',
        title: 'ПРИДУМАЙТЕ УПАКОВКУ',
        subtitle: 'В чём будет упакован чей-то продукт?',
        placeholder: 'Например: Мусорный мешок, Бронированный кейс...',
        hint: 'Опишите абсурдную упаковку',
        color: 'accent-teal',
        maxLength: 80,
    },
};

export function renderCardInput(container) {
    var phase = state.cardInputPhase || 'adjective';
    var config = PHASE_CONFIG[phase];
    if (!config) return;

    submitted = false;

    var phaseNames = ['adjective', 'item', 'feature', 'review'];
    var phaseIndex = phaseNames.indexOf(phase) + 1;
    var totalPhases = phaseNames.filter(function (name) { return PHASE_CONFIG[name]; }).length;

    var html = '';
    html += '<div class="max-w-2xl mx-auto px-4 py-8 min-h-screen flex flex-col items-center justify-center">';

    // Header
    html += '<div class="text-center mb-8">';
    html += '<div class="text-5xl mb-4">' + config.emoji + '</div>';
    html += '<div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest mb-2">Фаза ' + phaseIndex + ' из ' + totalPhases + '</div>';
    html += '<h2 class="font-display text-2xl md:text-3xl font-black text-corp-white mb-2">' + config.title + '</h2>';
    html += '<p class="text-sm text-corp-muted">' + config.subtitle + '</p>';
    html += '</div>';

    // Timer
    html += '<div class="text-center mb-6">';
    html += '<div data-timer-text class="font-mono text-5xl font-black text-corp-white"></div>';
    html += '<div class="max-w-xs mx-auto mt-3">';
    html += '<div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
    html += '</div>';
    html += '</div>';

    // Disclaimer
    html += '<div class="corp-card border-accent-gold/20 bg-accent-gold-dim px-5 py-3 mb-6 w-full max-w-md">';
    html += '<div class="flex items-center gap-3">';
    html += '<span class="text-lg">🔀</span>';
    html += '<div class="text-xs text-corp-light leading-relaxed">';
    html += 'Ваш текст будет <span class="text-accent-gold font-bold">перемешан</span> и достанется случайному игроку!';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Input card
    html += '<div class="corp-card-elevated w-full max-w-md p-6 space-y-4">';

    // Hint
    html += '<div class="flex items-center gap-2 text-xs text-corp-dim">';
    html += '<span>💡</span>';
    html += '<span>' + config.hint + '</span>';
    html += '</div>';

    // Input
    html += '<input type="text" id="card-input" class="input-corp text-center text-lg font-bold" ';
    html += 'placeholder="' + config.placeholder + '" ';
    html += 'maxlength="' + config.maxLength + '" autocomplete="off">';

    // Character counter
    html += '<div class="text-right text-xs text-corp-muted">';
    html += '<span id="char-count">0</span> / ' + config.maxLength;
    html += '</div>';

    // Submit button
    html += '<button id="btn-submit-card" class="btn-neon-solid w-full py-4 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">';
    html += '✓ ОТПРАВИТЬ';
    html += '</button>';

    html += '</div>';

    // Confirmed banner (hidden)
    html += '<div id="card-confirmed" class="hidden w-full max-w-md mt-4">';
    html += '<div class="corp-card border-accent-green/20 bg-accent-green-dim px-6 py-4 text-center">';
    html += '<span class="text-accent-green text-sm font-bold">✓ Отправлено! Ожидание остальных...</span>';
    html += '</div>';
    html += '</div>';

    // Progress
    html += '<div class="mt-4">';
    html += '<div id="card-input-progress" class="text-sm font-semibold text-corp-muted"></div>';
    html += '</div>';

    // Declension warning
    html += '<div class="mt-6 text-center">';
    html += '<div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-corp-card border border-corp-border">';
    html += '<span class="text-xs">⚠️</span>';
    html += '<span class="text-[0.65rem] text-corp-dim">В этом режиме автоматические склонения не работают</span>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    // ═══════ LISTENERS ═══════
    var input = container.querySelector('#card-input');
    var btnSubmit = container.querySelector('#btn-submit-card');
    var charCount = container.querySelector('#char-count');
    var confirmed = container.querySelector('#card-confirmed');

    if (input) {
        input.focus();

        input.addEventListener('input', function () {
            if (charCount) charCount.textContent = input.value.length;
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') doSubmitCard(input, btnSubmit, confirmed);
        });
    }

    if (btnSubmit) {
        btnSubmit.addEventListener('click', function () {
            doSubmitCard(input, btnSubmit, confirmed);
        });
    }
}

function doSubmitCard(input, btn, confirmed) {
    if (submitted) return;

    var text = input ? input.value.trim() : '';

    submitted = true;

    sendMsg({
        type: 'submitCustomCard',
        text: text.toUpperCase(),
    });

    if (input) {
        input.disabled = true;
        input.classList.add('opacity-50');
    }
    if (btn) {
        btn.textContent = '✓ Отправлено!';
        btn.disabled = true;
        btn.classList.add('opacity-50');
    }
    if (confirmed) {
        confirmed.classList.remove('hidden');
    }
}