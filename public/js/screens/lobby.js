import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';
import { showNotification } from '../components/notification.js';

// ═══════════════════════════════════════════
// Экспортируемые функции для частичного обновления
// (вызываются из socket.js при lobbyUpdate)
// ═══════════════════════════════════════════

export function updatePlayersList(container) {
    var list = container.querySelector('#players-list');
    if (!list) return;
    var players = state.players || [];

    var countEl = container.querySelector('#players-count');
    if (countEl) countEl.textContent = players.length;

    var html = '';
    for (var i = 0; i < players.length; i++) {
        var p = players[i];
        var isMe = p.id === state.playerId;
        var hue1 = i * 45 + 120;
        var hue2 = i * 45 + 160;
        var hue3 = i * 45 + 140;

        html += '<div class="corp-card px-5 py-4 flex items-center gap-4';
        if (isMe) html += ' border-accent-blue/20';
        html += '">';
        html += '<div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black" style="background: linear-gradient(135deg, hsl(' + hue1 + ',40%,20%), hsl(' + hue2 + ',40%,15%)); color: hsl(' + hue3 + ',60%,65%);">';
        html += (i + 1);
        html += '</div>';
        html += '<span class="font-bold text-corp-light flex-1">' + escapeHtml(p.nickname) + '</span>';
        html += '<div class="flex gap-2">';
        if (p.isHost) {
            html += '<span class="text-[0.65rem] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-accent-gold-dim text-accent-gold border border-accent-gold/20">ХОСТ</span>';
        }
        if (isMe) {
            html += '<span class="text-[0.65rem] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-accent-blue-dim text-accent-blue border border-accent-blue/20">ВЫ</span>';
        }
        html += '</div>';
        html += '</div>';
    }
    list.innerHTML = html;
}

export function updateStartButton(container) {
    var area = container.querySelector('#start-button-area');
    if (!area) return;

    var isHost = state.isHost;
    var canStart = (state.players || []).length >= 3;

    var html = '';
    if (isHost && canStart) {
        html = '<button id="btn-start" class="btn-neon-solid w-full py-5 rounded-2xl text-lg font-black uppercase tracking-wider cursor-pointer">НАЧАТЬ ПИТЧИНГ</button>';
    } else if (isHost) {
        html = '<div class="text-center text-corp-muted text-sm font-semibold py-4">Ожидание игроков... (' + (state.players || []).length + '/3)</div>';
    } else if (canStart) {
        html = '<div class="text-center text-corp-muted text-sm font-semibold py-4">Ожидание хоста...</div>';
    } else {
        html = '<div class="text-center text-corp-muted text-sm font-semibold py-4">Ожидание игроков... (' + (state.players || []).length + '/3)</div>';
    }
    area.innerHTML = html;

    // Re-attach start button listener
    var btnStart = container.querySelector('#btn-start');
    if (btnStart) {
        btnStart.addEventListener('click', function () {
            console.log('[lobby] Start clicked');
            sendMsg({ type: 'startGame' });
        });
    }
}

export function updateSettingsPanel(container) {
    var panel = container.querySelector('#settings-panel');
    if (!panel) return;

    var s = state.settings || {};

    var html = '';
    html += buildSetting('Макс. игроков', 'maxPlayers', 'set-max-players', 3, 18, s.maxPlayers || 8, 1);
    html += buildSetting('Количество раундов', 'rounds', 'set-rounds', 1, 7, s.rounds || 3, 1);
    html += buildSetting('Стартовый капитал', 'capital', 'set-capital', 3, 30, s.startCapital || 10, 1);
    html += buildSetting('Подготовка (сек)', 'prep', 'set-prep', 30, 300, s.prepTime || 60, 15);
    html += buildSetting('Питч (сек)', 'present', 'set-present', 60, 300, s.presentTime || 120, 15);
    html += buildSetting('Инвестирование (сек)', 'invest', 'set-invest', 30, 120, s.investTime || 60, 10);

    html += '<div class="h-px bg-corp-border my-4"></div>';
    html += buildToggle('Псевдоинновации', 'Лайт-режим: только прилагательное + предмет (без особенности)', 'set-pseudo', s.pseudoMode, false);

    html += '<div class="h-px bg-corp-border my-4"></div>';
    html += buildToggle('Карточка отзыва', 'Добавляет первый отзыв клиента к продукту', 'set-reviews', s.useReviews, false);
    html += buildToggle('Чёрный лебедь', '20% шанс замены карты при выступлении', 'set-blackswan', s.blackSwan, false);
    html += '<div class="h-px bg-corp-border my-4"></div>';
    html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-3">Модификатор предмета</div>';

    var modNone = !s.modifier || s.modifier === 'none';
    var modAdd = s.modifier === 'addition';
    var modMeta = s.modifier === 'metaphor';

    html += '<div class="space-y-2">';

    html += '<label class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ';
    html += modNone ? 'bg-corp-black/30 border border-accent-blue/20' : 'bg-corp-black/30 border border-corp-border hover:border-corp-border';
    html += '">';
    html += '<input type="radio" name="modifier" value="none" class="modifier-radio"';
    if (modNone) html += ' checked';
    html += '>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">🚫 Без модификатора</div>';
    html += '<div class="text-[0.6rem] text-corp-dim">Классическая игра</div>';
    html += '</div>';
    html += '</label>';

    html += '<label class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ';
    html += modAdd ? 'bg-accent-green-dim border border-accent-green/20' : 'bg-corp-black/30 border border-corp-border hover:border-corp-border';
    html += '">';
    html += '<input type="radio" name="modifier" value="addition" class="modifier-radio"';
    if (modAdd) html += ' checked';
    html += '>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">📜 Дополнение</div>';
    html += '<div class="text-[0.6rem] text-corp-dim">+1 слово после предмета (напр. «Утюг СПРАВЕДЛИВОСТИ»)</div>';
    html += '</div>';
    html += '</label>';

    html += '<label class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ';
    html += modMeta ? 'bg-accent-green-dim border border-accent-green/20' : 'bg-corp-black/30 border border-corp-border hover:border-corp-border';
    html += '">';
    html += '<input type="radio" name="modifier" value="metaphor" class="modifier-radio"';
    if (modMeta) html += ' checked';
    html += '>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">🌀 Метафора</div>';
    html += '<div class="text-[0.6rem] text-corp-dim">+2 слова после предмета (напр. «Утюг ТОКСИЧНОЙ ЭНЕРГЕТИКИ»)</div>';
    html += '</div>';
    html += '</label>';

    html += '</div>';
    html += buildToggle('Колода событий', 'Случайные ограничения', 'set-events', s.useEvents, false);
    html += buildToggle('Текстовые питчи', 'Для стримера / без микрофона', 'set-streamer', s.streamerMode, false);

    html += buildToggle('Озвучка текста', 'Голосовое сопровождение презентаций (хост управляет)', 'set-speech', s.useSpeech, false);

    html += '<div class="h-px bg-corp-border my-4"></div>';

    html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-3">Источник карт</div>';

    // Radio-like toggle
    html += '<div class="space-y-2">';

    var isDb = !s.cardSource || s.cardSource === 'database';
    var isPlayers = s.cardSource === 'players';

    html += '<label class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ';
    html += isDb ? 'bg-accent-blue-dim border border-accent-blue/20' : 'bg-corp-black/30 border border-corp-border hover:border-corp-border';
    html += '">';
    html += '<input type="radio" name="cardSource" value="database" class="card-source-radio"';
    if (isDb) html += ' checked';
    html += '>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">🗃 Наша база</div>';
    html += '<div class="text-[0.6rem] text-corp-dim">240 млн+ комбинаций со склонениями</div>';
    html += '</div>';
    html += '</label>';

    html += '<label class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ';
    html += isPlayers ? 'bg-accent-gold-dim border border-accent-gold/20' : 'bg-corp-black/30 border border-corp-border hover:border-corp-border';
    html += '">';
    html += '<input type="radio" name="cardSource" value="players" class="card-source-radio"';
    if (isPlayers) html += ' checked';
    html += '>';
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">🧟 Генератор абсурда</div>';
    html += '<div class="text-[0.6rem] text-corp-dim">Игроки сами придумывают карты Франкенштейна</div>';
    html += '</div>';
    html += '</label>';

    html += '</div>';

    html += '<div class="h-px bg-corp-border my-4"></div>';

    html += buildToggle('Режим «Бункер»', 'Постепенное открытие карт', 'set-bunker', false, true);

    panel.innerHTML = html;

    // Re-attach settings listeners
    attachSettingsListeners(container);
}


// ═══════════════════════════════════════════
// Полный рендер лобби (первый вход)
// ═══════════════════════════════════════════

export function renderLobby(container) {
    console.log('[lobby] Full render');

    var isHost = state.isHost;

    var html = '';
    html += '<div class="max-w-5xl mx-auto px-4 py-8 min-h-screen">';

    // Back
    html += '<button id="btn-back" class="flex items-center gap-2 text-corp-muted hover:text-accent-red text-sm font-bold mb-6 transition-colors group cursor-pointer">';
    html += '<span class="group-hover:-translate-x-1 transition-transform">←</span>';
    html += '<span>Выйти</span>';
    html += '</button>';

    html += '<div class="flex flex-col lg:flex-row gap-8">';

    // LEFT
    html += '<div class="flex-1 space-y-6">';

    // Room code
    html += '<div class="corp-card p-6">';
    html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-2">Код комнаты</div>';
    html += '<div class="flex items-center gap-4">';
    html += '<span class="font-mono text-4xl md:text-5xl font-black text-accent-blue tracking-[0.2em]" style="text-shadow: 0 0 20px rgba(0,180,255,0.3);">';
    html += escapeHtml(state.roomCode || '');
    html += '</span>';
    html += '<button id="btn-copy" class="p-2 rounded-lg hover:bg-corp-card transition-colors text-corp-muted hover:text-corp-light cursor-pointer" title="Скопировать">📋</button>';
    html += '</div>';
    html += '<p class="text-xs text-corp-muted mt-3">Отправьте этот код инвесторам</p>';
    html += '</div>';

    // Players
    html += '<div>';
    html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-3">Участник�� · <span id="players-count">' + (state.players || []).length + '</span></div>';
    html += '<div class="space-y-2" id="players-list"></div>';
    html += '</div>';

    // Start area
    html += '<div class="pt-4" id="start-button-area"></div>';

    html += '</div>'; // end left

    // RIGHT — settings (host only)
    if (isHost) {
        html += '<div class="lg:w-[380px] space-y-4">';
        html += '<div class="text-xs font-bold text-corp-muted uppercase tracking-widest mb-1">Приборная панель</div>';
        html += '<div class="corp-card p-6 space-y-5" id="settings-panel"></div>';
        html += '</div>';
    }

    html += '</div>'; // end flex
    html += '</div>'; // end main

    container.innerHTML = html;

    // Fill dynamic parts
    updatePlayersList(container);
    updateStartButton(container);
    if (isHost) updateSettingsPanel(container);

    // Static listeners
    var btnBack = container.querySelector('#btn-back');
    if (btnBack) {
        btnBack.addEventListener('click', function () {
            console.log('[lobby] Back clicked');
            window.location.reload();
        });
    }

    var btnCopy = container.querySelector('#btn-copy');
    if (btnCopy) {
        btnCopy.addEventListener('click', function () {
            if (!state.roomCode) return;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(state.roomCode)
                    .then(function () { showNotification('Код скопирован: ' + state.roomCode, 'success'); })
                    .catch(function () { showNotification('Код: ' + state.roomCode, 'info'); });
            } else {
                showNotification('Код: ' + state.roomCode, 'info');
            }
        });
    }
}


// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function buildSetting(label, stepName, inputId, min, max, value, step) {
    var html = '';
    html += '<div class="flex items-center justify-between">';
    html += '<div class="text-sm font-bold text-corp-light">' + label + '</div>';
    html += '<div class="flex items-center gap-2">';
    html += '<button class="stepper-btn cursor-pointer" data-step="' + stepName + '" data-dir="-' + step + '">−</button>';
    html += '<input type="number" id="' + inputId + '" class="stepper-input" min="' + min + '" max="' + max + '" value="' + value + '" step="' + step + '">';
    html += '<button class="stepper-btn cursor-pointer" data-step="' + stepName + '" data-dir="' + step + '">+</button>';
    html += '</div>';
    html += '</div>';
    return html;
}

function buildToggle(label, hint, inputId, checked, locked) {
    var html = '';
    if (locked) {
        html += '<div class="feature-locked flex items-center justify-between py-1">';
    } else {
        html += '<div class="flex items-center justify-between py-1">';
    }
    html += '<div>';
    html += '<div class="text-sm font-bold text-corp-light">' + label + '</div>';
    html += '<div class="text-xs text-corp-muted mt-0.5">' + hint + '</div>';
    html += '</div>';
    html += '<input type="checkbox" id="' + inputId + '" class="toggle-corp"';
    if (checked) html += ' checked';
    if (locked) html += ' disabled';
    html += '>';
    html += '</div>';
    return html;
}

function attachSettingsListeners(container) {
    // Steppers
    var stepBtns = container.querySelectorAll('.stepper-btn');
    for (var j = 0; j < stepBtns.length; j++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var field = btn.getAttribute('data-step');
                var dir = parseInt(btn.getAttribute('data-dir'));
                handleStep(field, dir, container);
            });
        })(stepBtns[j]);
    }

    // Inputs
    var inputs = container.querySelectorAll('.stepper-input, .toggle-corp');
    for (var k = 0; k < inputs.length; k++) {
        (function (inp) {
            inp.addEventListener('change', function () {
                pushSettings(container);
            });
        })(inputs[k]);
    }

    // Card source radios
    var radios = container.querySelectorAll('.card-source-radio');
    for (var r = 0; r < radios.length; r++) {
        (function (radio) {
            radio.addEventListener('change', function () {
                pushSettings(container);
            });
        })(radios[r]);
    }

    // Взаимоисключение: blackSwan <-> players source
    var blackSwanToggle = container.querySelector('#set-blackswan');
    var sourceRadios = container.querySelectorAll('.card-source-radio');

    if (blackSwanToggle) {
        blackSwanToggle.addEventListener('change', function () {
            if (blackSwanToggle.checked) {
                // Выключаем "Генератор абсурда"
                var dbRadio = container.querySelector('input[name="cardSource"][value="database"]');
                if (dbRadio) {
                    dbRadio.checked = true;
                }
            }
            pushSettings(container);
        });
    }

    for (var r = 0; r < sourceRadios.length; r++) {
        (function (radio) {
            radio.addEventListener('change', function () {
                if (radio.value === 'players' && radio.checked) {
                    // Выключаем Чёрный лебедь
                    var bsToggle = container.querySelector('#set-blackswan');
                    if (bsToggle) bsToggle.checked = false;
                    // Выключаем модификатор
                    var noneRadio = container.querySelector('input[name="modifier"][value="none"]');
                    if (noneRadio) noneRadio.checked = true;
                }
                pushSettings(container);
            });
        })(sourceRadios[r]);
    }

    // Modifier radios
    var modRadios = container.querySelectorAll('.modifier-radio');
    for (var m = 0; m < modRadios.length; m++) {
        (function (radio) {
            radio.addEventListener('change', function () {
                if (radio.value !== 'none' && radio.checked) {
                    // Модификаторы несовместимы с генератором абсурда
                    var dbRadio = container.querySelector('input[name="cardSource"][value="database"]');
                    if (dbRadio) dbRadio.checked = true;
                }
                pushSettings(container);
            });
        })(modRadios[m]);
    }
}

function handleStep(field, dir, container) {
    var map = { rounds: 'set-rounds', capital: 'set-capital', prep: 'set-prep', present: 'set-present', invest: 'set-invest', maxPlayers: 'set-max-players' };
    var input = container.querySelector('#' + map[field]);
    if (!input) return;

    var val = parseInt(input.value) || 0;
    val += dir;
    val = Math.max(parseInt(input.min) || 1, Math.min(parseInt(input.max) || 999, val));
    input.value = val;
    pushSettings(container);
}

function pushSettings(container) {
    var cardSourceEl = container.querySelector('input[name="cardSource"]:checked');
    var modifierEl = container.querySelector('input[name="modifier"]:checked');

    var settings = {
        maxPlayers: parseInt(container.querySelector('#set-max-players')?.value) || 8,
        rounds: parseInt(container.querySelector('#set-rounds')?.value) || 3,
        startCapital: parseInt(container.querySelector('#set-capital')?.value) || 10,
        useReviews: container.querySelector('#set-reviews')?.checked || false,
        useEvents: container.querySelector('#set-events')?.checked || false,
        useSpeech: container.querySelector('#set-speech')?.checked || false,
        streamerMode: container.querySelector('#set-streamer')?.checked || false,
        prepTime: parseInt(container.querySelector('#set-prep')?.value) || 60,
        presentTime: parseInt(container.querySelector('#set-present')?.value) || 120,
        investTime: parseInt(container.querySelector('#set-invest')?.value) || 60,
        cardSource: cardSourceEl ? cardSourceEl.value : 'database',
        blackSwan: container.querySelector('#set-blackswan')?.checked || false,
        modifier: modifierEl ? modifierEl.value : 'none',
        pseudoMode: container.querySelector('#set-pseudo')?.checked || false,
    };
    console.log('[lobby] Pushing settings:', settings);
    sendMsg({ type: 'updateSettings', settings: settings });
}