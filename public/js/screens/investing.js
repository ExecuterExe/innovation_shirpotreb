import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';
import { showNotification } from '../components/notification.js';
import { playSound } from '../components/sound.js';
import { CARD_TYPES } from './presentation.js';

export function renderInvesting(container) {
    var presentations = state.presentations || [];
    var capital = state.myCapital;
    var confirmed = state.investmentConfirmed;
    var isHost = state.isHost;

    var html = '';
    html += '<div class="max-w-4xl mx-auto px-4 py-6 min-h-screen">';

    // ═══════ HUD ═══════
    html += '<div class="corp-card px-6 py-4 flex items-center justify-between flex-wrap gap-4 mb-8">';

    html += '  <div>';
    html += '    <div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">Раунд</div>';
    html += '    <div class="text-2xl font-black text-corp-white">' + state.currentRound;
    html += '      <span class="text-corp-muted text-lg">/' + state.totalRounds + '</span>';
    html += '    </div>';
    html += '  </div>';

    html += '  <div class="flex-1 max-w-md mx-6">';
    html += '    <div class="flex justify-between text-xs font-bold text-corp-muted mb-1.5">';
    html += '      <span>ИНВЕСТИРОВАНИЕ</span>';
    html += '      <span data-timer-text class="font-mono text-corp-light"></span>';
    html += '    </div>';
    html += '    <div class="timer-bar"><div data-timer-bar class="timer-bar-fill" style="width:100%"></div></div>';
    html += '  </div>';

    html += '  <div class="text-right">';
    html += '    <div class="text-[0.6rem] font-bold text-corp-muted uppercase tracking-widest">Ваш капитал</div>';
    html += '    <div class="text-2xl font-black text-accent-blue">' + capital + '</div>';
    html += '  </div>';

    html += '</div>';

    // ═══════ HEADER ═══════
    html += '<div class="text-center mb-8">';
    html += '  <h2 class="text-2xl font-black text-corp-white mb-2">Терминал инвестиций</h2>';
    html += '  <p class="text-corp-muted text-sm">Распределите жетоны между проектами. В себя вкладывать нельзя.</p>';
    html += '  <p class="text-accent-blue font-bold text-sm mt-1">Кто вложится в лучшего предпринимателя — получит ×2!</p>';
    html += '</div>';

    // ═══════ INVESTMENT LIST ═══════
    html += '<div class="space-y-4 mb-8" id="invest-list">';

    for (var i = 0; i < presentations.length; i++) {
        var p = presentations[i];
        var isSelf = p.id === state.playerId;

        html += '<div class="corp-card overflow-hidden';
        if (isSelf) html += ' opacity-30 relative';
        html += '">';

        // Self overlay
        if (isSelf) {
            html += '<div class="absolute inset-0 flex items-center justify-center z-10">';
            html += '  <span class="text-xs font-bold text-accent-red bg-corp-black/90 px-4 py-2 rounded-xl">🚫 Нельзя инвестировать в себя</span>';
            html += '</div>';
        }

        // Top section — name + cards
        html += '<div class="px-6 py-5">';
        html += '  <div class="text-lg font-black text-accent-gold mb-3">' + escapeHtml(p.nickname);
        if (isSelf) html += ' <span class="text-corp-muted text-sm font-normal">(Вы)</span>';
        html += '  </div>';

        // Card tags
        html += '  <div class="flex flex-wrap gap-2">';
        for (var ct = 0; ct < CARD_TYPES.length; ct++) {
            var ctype = CARD_TYPES[ct];
            var cval = p.cards[ctype.key];
            if (cval) {
                var tagColors = [
                    'bg-red-900/30 text-red-400 border-red-800/30',
                    'bg-cyan-900/30 text-cyan-400 border-cyan-800/30',
                    'bg-purple-900/30 text-purple-400 border-purple-800/30',
                    'bg-amber-900/30 text-amber-400 border-amber-800/30',
                    'bg-green-900/30 text-green-400 border-green-800/30',
                ];
                var tagColor = tagColors[ct] || tagColors[0];
                html += '<span class="text-xs font-bold px-3 py-1 rounded-lg border ' + tagColor + '">' + escapeHtml(cval) + '</span>';
            }
        }
        html += '  </div>';
        html += '</div>';

        // Bottom section — investment controls
        if (!isSelf) {
            html += '<div class="bg-corp-black/40 px-6 py-5 border-t border-corp-border">';
            html += '  <div class="flex items-center gap-4 flex-wrap">';

            // Minus button
            html += '    <button class="invest-minus w-10 h-10 rounded-full border border-corp-border text-corp-dim font-black text-lg flex items-center justify-center hover:border-accent-red hover:text-accent-red transition-colors cursor-pointer" data-target="' + p.id + '">−</button>';

            // Amount display
            html += '    <div class="flex-shrink-0 text-center">';
            html += '      <div class="invest-display font-mono text-3xl font-black text-accent-blue w-16 text-center" data-target="' + p.id + '">0</div>';
            html += '      <div class="text-[0.6rem] text-corp-muted font-bold uppercase tracking-wider mt-0.5">жетонов</div>';
            html += '    </div>';

            // Plus button
            html += '    <button class="invest-plus w-10 h-10 rounded-full border border-corp-border text-corp-dim font-black text-lg flex items-center justify-center hover:border-accent-blue hover:text-accent-blue transition-colors cursor-pointer" data-target="' + p.id + '">+</button>';

            // Slider
            html += '    <div class="flex-1 min-w-[120px]">';
            html += '      <input type="range" class="invest-slider w-full" min="0" max="' + capital + '" value="0" data-target="' + p.id + '">';
            html += '    </div>';

            // Quick buttons
            html += '    <div class="flex gap-1.5">';
            html += '      <button class="invest-quick text-[0.65rem] font-bold px-2.5 py-1 rounded-lg bg-corp-graphite text-corp-dim border border-corp-border hover:border-accent-blue hover:text-accent-blue transition-colors cursor-pointer" data-target="' + p.id + '" data-amount="1">+1</button>';
            html += '      <button class="invest-quick text-[0.65rem] font-bold px-2.5 py-1 rounded-lg bg-corp-graphite text-corp-dim border border-corp-border hover:border-accent-blue hover:text-accent-blue transition-colors cursor-pointer" data-target="' + p.id + '" data-amount="3">+3</button>';
            html += '      <button class="invest-quick text-[0.65rem] font-bold px-2.5 py-1 rounded-lg bg-corp-graphite text-corp-dim border border-corp-border hover:border-accent-blue hover:text-accent-blue transition-colors cursor-pointer" data-target="' + p.id + '" data-amount="5">+5</button>';
            html += '      <button class="invest-quick-all text-[0.65rem] font-bold px-2.5 py-1 rounded-lg bg-accent-blue-dim text-accent-blue border border-accent-blue/20 hover:bg-accent-blue hover:text-white transition-colors cursor-pointer" data-target="' + p.id + '">ALL</button>';
            html += '    </div>';

            html += '  </div>';
            html += '</div>';
        }

        html += '</div>'; // end invest item
    }

    html += '</div>'; // end invest-list

    // ═══════ FOOTER — remaining ═══════
    html += '<div class="corp-card px-6 py-5 flex items-center justify-between flex-wrap gap-4 mb-6">';
    html += '  <div class="flex items-center gap-4">';
    html += '    <span class="text-sm font-bold text-corp-dim">Осталось жетонов:</span>';
    html += '    <span id="inv-remaining" class="font-mono text-4xl font-black text-accent-blue">' + capital + '</span>';
    html += '  </div>';
    html += '  <div id="invest-progress" class="text-xs font-semibold text-corp-muted"></div>';
    html += '</div>';

    // ═══════ CONFIRM / CONFIRMED ═══════
    if (confirmed) {
        html += '<div class="corp-card border-accent-green/20 bg-accent-green-dim px-6 py-5 text-center">';
        html += '  <span class="text-accent-green font-bold">✓ Инвестиции приняты! Ожидайте остальных...</span>';
        html += '</div>';
    } else {
        html += '<button id="btn-confirm-invest" class="btn-neon-solid w-full py-5 rounded-2xl text-base font-black uppercase tracking-wider cursor-pointer">';
        html += '  ✓ ПОДТВЕРДИТЬ ТРАНЗАКЦИЮ';
        html += '</button>';
    }

    html += '</div>'; // end main

    container.innerHTML = html;

    // ═══════════════════════════════════════════
    // INVESTMENT LOGIC
    // ═══════════════════════════════════════════

    var investments = {};
    for (var j = 0; j < presentations.length; j++) {
        if (presentations[j].id !== state.playerId) {
            investments[presentations[j].id] = 0;
        }
    }

    function getTotal() {
        var total = 0;
        var keys = Object.keys(investments);
        for (var k = 0; k < keys.length; k++) total += investments[keys[k]];
        return total;
    }

    function updateRemainingUI() {
        var remaining = capital - getTotal();
        var el = container.querySelector('#inv-remaining');
        if (el) {
            el.textContent = remaining;
            if (remaining < 0) {
                el.className = 'font-mono text-4xl font-black text-accent-red';
            } else if (remaining === 0) {
                el.className = 'font-mono text-4xl font-black text-accent-gold';
            } else {
                el.className = 'font-mono text-4xl font-black text-accent-blue';
            }
        }
    }

    function setInvestment(targetId, value) {
        // Clamp
        value = Math.max(0, value);

        // Don't exceed capital
        var otherTotal = 0;
        var keys = Object.keys(investments);
        for (var k = 0; k < keys.length; k++) {
            if (keys[k] !== targetId) otherTotal += investments[keys[k]];
        }
        var maxForThis = capital - otherTotal;
        if (value > maxForThis) value = maxForThis;
        if (value < 0) value = 0;

        investments[targetId] = value;

        // Update display
        var displays = container.querySelectorAll('.invest-display[data-target="' + targetId + '"]');
        for (var d = 0; d < displays.length; d++) displays[d].textContent = value;

        var sliders = container.querySelectorAll('input.invest-slider[data-target="' + targetId + '"]');
        for (var s = 0; s < sliders.length; s++) sliders[s].value = value;

        updateRemainingUI();
    }

    // ═══════ MINUS BUTTONS ═══════
    var minusBtns = container.querySelectorAll('.invest-minus');
    for (var a = 0; a < minusBtns.length; a++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-target');
                setInvestment(id, (investments[id] || 0) - 1);
            });
        })(minusBtns[a]);
    }

    // ═══════ PLUS BUTTONS ═══════
    var plusBtns = container.querySelectorAll('.invest-plus');
    for (var b = 0; b < plusBtns.length; b++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-target');
                setInvestment(id, (investments[id] || 0) + 1);
            });
        })(plusBtns[b]);
    }

    // ═══════ QUICK BUTTONS (+1, +3, +5) ═══════
    var quickBtns = container.querySelectorAll('.invest-quick');
    for (var q = 0; q < quickBtns.length; q++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-target');
                var amount = parseInt(btn.getAttribute('data-amount')) || 1;
                setInvestment(id, (investments[id] || 0) + amount);
            });
        })(quickBtns[q]);
    }

    // ═══════ ALL-IN BUTTONS ═══════
    var allBtns = container.querySelectorAll('.invest-quick-all');
    for (var al = 0; al < allBtns.length; al++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-target');
                // Reset others to 0, put everything here
                var keys = Object.keys(investments);
                for (var k = 0; k < keys.length; k++) {
                    if (keys[k] !== id) {
                        investments[keys[k]] = 0;
                        var displays = container.querySelectorAll('.invest-display[data-target="' + keys[k] + '"]');
                        for (var d = 0; d < displays.length; d++) displays[d].textContent = '0';
                        var sliders = container.querySelectorAll('input.invest-slider[data-target="' + keys[k] + '"]');
                        for (var s = 0; s < sliders.length; s++) sliders[s].value = 0;
                    }
                }
                setInvestment(id, capital);
            });
        })(allBtns[al]);
    }

    // ═══════ SLIDERS ═══════
    var sliders = container.querySelectorAll('input.invest-slider');
    for (var c = 0; c < sliders.length; c++) {
        (function (slider) {
            slider.addEventListener('input', function () {
                setInvestment(slider.getAttribute('data-target'), parseInt(slider.value) || 0);
            });
        })(sliders[c]);
    }

    // ═══════ CONFIRM BUTTON ═══════
    var btnConfirm = container.querySelector('#btn-confirm-invest');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', function () {
            var total = getTotal();

            if (total > capital) {
                showNotification('Недостаточно капитала! У вас ' + capital + ', вкладываете ' + total, 'error');
                playSound('warning');
                return;
            }

            var investArray = [];
            var keys = Object.keys(investments);
            for (var k = 0; k < keys.length; k++) {
                if (investments[keys[k]] > 0) {
                    investArray.push({ targetId: keys[k], amount: investments[keys[k]] });
                }
            }

            console.log('[invest] Confirming investments:', investArray);
            sendMsg({ type: 'submitInvestment', investments: investArray });
            playSound('invest');
        });
    }

}