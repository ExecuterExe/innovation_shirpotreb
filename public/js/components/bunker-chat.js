import { state, escapeHtml } from '../app.js';
import { sendMsg } from '../socket.js';
import { speak, stopSpeaking } from './speech.js';

// ═══════════════════════════════════════════
// BUNKER CHAT COMPONENT
// ═══════════════════════════════════════════

var CHAT_COLLAPSED = false;
var CHAT_IS_LOBBY = false; // запоминаем режим для повторного рендера при сворачивании

// Типы сообщений
var MSG_STYLES = {
    system:  { icon: '🔔', cls: 'chat-msg-system',  nameCls: 'text-corp-muted',   textCls: 'text-corp-dim' },
    event:   { icon: '⚡', cls: 'chat-msg-event',   nameCls: 'text-accent-cyan',  textCls: 'text-accent-cyan/90' },
    alert:   { icon: '🚨', cls: 'chat-msg-alert',   nameCls: 'text-accent-red',   textCls: 'text-accent-red/90' },
    pitch:   { icon: '🎤', cls: 'chat-msg-pitch',   nameCls: 'text-accent-gold',  textCls: 'text-corp-light' },
    general: { icon: '',   cls: 'chat-msg-general', nameCls: 'text-accent-blue',  textCls: 'text-corp-light' },
};

export function renderBunkerChat(container, forceShow) {
    // В лобби чат доступен всегда; во время игры — только если включена настройка
    var chatSettings = forceShow || (state.settings && state.settings.bunkerChat) !== false; // default on
    if (!chatSettings) return;

    var chatEl = container.querySelector('#bunker-chat-container');
    if (chatEl) return; // already rendered

    CHAT_IS_LOBBY = !!forceShow;
    var isLobby = CHAT_IS_LOBBY;
    var isCollapsed = CHAT_COLLAPSED;

    var html = '';
    html += '<div id="bunker-chat-container" class="bunker-chat-panel' + (isCollapsed ? ' bunker-chat-collapsed' : '') + (isLobby ? ' bunker-chat-left' : '') + '">';

    // Header
    html += '<div class="bunker-chat-header">';
    html += '  <span class="text-xs font-black text-corp-dim uppercase tracking-widest">💬 Чат</span>';
    html += '  <div class="flex items-center gap-1.5">';
    if (!isCollapsed) {
        html += '  <button id="btn-chat-export" title="Сохранить лог" class="chat-icon-btn text-corp-muted hover:text-accent-gold" style="font-size:0.75rem">⬇</button>';
    }
    html += '  <button id="btn-chat-toggle" class="chat-icon-btn text-corp-muted hover:text-corp-light">' + (isCollapsed ? '＋' : '－') + '</button>';
    html += '  </div>';
    html += '</div>';

    if (!isCollapsed) {
        // Messages area
        html += '<div class="bunker-chat-messages-wrap">';
        html += '<div id="bunker-chat-messages" class="bunker-chat-messages">';
        var msgs = state.chatMessages || [];
        for (var i = 0; i < msgs.length; i++) {
            html += buildMsgHtml(msgs[i]);
        }
        html += '</div>';
        html += '<button id="bunker-chat-new-msg-btn" class="bunker-chat-new-msg-btn hidden">↓ Новые сообщения</button>';
        html += '</div>';

        // Input
        html += '<div class="bunker-chat-input-area">';
        html += '  <input id="bunker-chat-input" type="text" placeholder="' + (isLobby ? 'Сообщение...' : 'Сообщение или !питч ...') + '" maxlength="300" class="bunker-chat-input" />';
        html += '  <button id="bunker-chat-send" class="bunker-chat-send-btn" title="Отправить">▶</button>';
        html += '</div>';
        if (isLobby) {
            html += '<div class="bunker-chat-hint"><b style="color:#f5d060">Enter</b> — отправить сообщение</div>';
        } else {
            html += '<div class="bunker-chat-hint"><b style="color:#f5d060">!питч</b> — озвучится (если включено), <b style="color:#f5d060">Enter</b> — отправить</div>';
        }
    }

    html += '</div>';

    // Append chat as sibling to #bunker-main-content inside .bunker-layout
    var layout = container.querySelector('.bunker-layout');
    if (layout) {
        layout.insertAdjacentHTML('beforeend', html);
    } else {
        container.insertAdjacentHTML('beforeend', html);
    }

    bindChatEvents(container);
    scrollChatToBottom(container);
}

function buildMsgHtml(msg) {
    var style = MSG_STYLES[msg.type] || MSG_STYLES.general;
    var bunker = state.bunker || {};
    var isCurrentPlayer = bunker.currentPlayerId && msg.playerId === bunker.currentPlayerId;

    var html = '<div class="chat-msg ' + style.cls + '" data-msg-id="' + escapeHtml(msg.id || '') + '">';
    html += '<div class="chat-msg-meta">';
    if (msg.relativeTime) {
        html += '<span class="chat-msg-time">' + escapeHtml(msg.relativeTime) + '</span>';
    }
    if (msg.nickname) {
        html += '<span class="chat-msg-name ' + style.nameCls + '">';
        if (isCurrentPlayer && msg.type === 'general') html += '▶ ';
        html += escapeHtml(msg.nickname);
        html += '</span>';
    } else if (style.icon) {
        html += '<span class="chat-msg-icon">' + style.icon + '</span>';
    }
    if (state.isHost && msg.id) {
        html += '<button class="chat-msg-delete" data-delete-msg="' + escapeHtml(msg.id) + '" title="Удалить сообщение">✕</button>';
    }
    html += '</div>';
    html += '<div class="chat-msg-text ' + style.textCls + '">' + escapeHtml(msg.text) + '</div>';
    html += '</div>';
    return html;
}

export function removeChatMsgFromDom(messageId) {
    if (state.chatMessages) {
        state.chatMessages = state.chatMessages.filter(function (m) { return m.id !== messageId; });
    }
    var el = document.querySelector('.chat-msg[data-msg-id="' + messageId + '"]');
    if (!el) return;
    el.classList.add('chat-msg-removing');
    setTimeout(function () { if (el.parentNode) el.remove(); }, 180);
}

export function appendChatMsg(msg) {
    if (!state.chatMessages) state.chatMessages = [];
    state.chatMessages.push(msg);

    // TTS for pitches if setting enabled
    if (msg.type === 'pitch' && state.settings && state.settings.chatTTS) {
        var textToSpeak = msg.nickname ? (msg.nickname + ': ' + msg.text) : msg.text;
        speak(textToSpeak);
    }

    // Append to DOM if chat is open
    var messagesEl = document.querySelector('#bunker-chat-messages');
    if (messagesEl) {
        var wasNearBottom = isNearBottom(messagesEl);
        messagesEl.insertAdjacentHTML('beforeend', buildMsgHtml(msg));
        if (wasNearBottom) {
            scrollChatToBottom(null);
            hideNewMsgBtn();
        } else {
            showNewMsgBtn();
        }
    }
}

function isNearBottom(el) {
    if (!el) return true;
    return (el.scrollHeight - el.scrollTop - el.clientHeight) < 60;
}

function showNewMsgBtn() {
    var btn = document.querySelector('#bunker-chat-new-msg-btn');
    if (btn) btn.classList.remove('hidden');
}
function hideNewMsgBtn() {
    var btn = document.querySelector('#bunker-chat-new-msg-btn');
    if (btn) btn.classList.add('hidden');
}

function scrollChatToBottom(container) {
    var el = (container || document).querySelector('#bunker-chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
}

function bindChatEvents(container) {
    var toggleBtn = container.querySelector('#btn-chat-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            CHAT_COLLAPSED = !CHAT_COLLAPSED;
            var chatEl = container.querySelector('#bunker-chat-container');
            if (chatEl) chatEl.remove();
            renderBunkerChat(container, CHAT_IS_LOBBY);
        });
    }

    var exportBtn = container.querySelector('#btn-chat-export');
    if (exportBtn) {
        exportBtn.addEventListener('click', function () { exportChatLog(); });
    }

    var input = container.querySelector('#bunker-chat-input');
    var sendBtn = container.querySelector('#bunker-chat-send');

    function doSend() {
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        sendMsg({ type: 'chatMessage', text: text });
        input.value = '';
        input.focus();
    }

    if (sendBtn) sendBtn.addEventListener('click', doSend);
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
        });
    }

    // "Новые сообщения" — прыжок вниз
    var newMsgBtn = container.querySelector('#bunker-chat-new-msg-btn');
    var messagesEl = container.querySelector('#bunker-chat-messages');
    if (newMsgBtn && messagesEl) {
        newMsgBtn.addEventListener('click', function () {
            messagesEl.scrollTop = messagesEl.scrollHeight;
            hideNewMsgBtn();
        });
        messagesEl.addEventListener('scroll', function () {
            if (isNearBottom(messagesEl)) hideNewMsgBtn();
        });
    }

    // Ведущий: удалить сообщение (делегирование — кнопки добавляются динамически)
    if (messagesEl) {
        messagesEl.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-delete-msg]');
            if (!btn) return;
            var msgId = btn.getAttribute('data-delete-msg');
            if (!msgId) return;
            if (!window.confirm('Удалить это сообщение для всех?')) return;
            sendMsg({ type: 'deleteChatMessage', messageId: msgId });
        });
    }
}

function exportChatLog() {
    var msgs = state.chatMessages || [];
    if (msgs.length === 0) { alert('Лог чата пуст.'); return; }

    var lines = ['=== ЧАТ БУНКЕРА ===', ''];
    for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        var time = m.relativeTime ? '[' + m.relativeTime + '] ' : '';
        var who = m.nickname ? ('@' + m.nickname + ': ') : '';
        var typeLabel = m.type === 'system' ? '[Система] ' : m.type === 'event' ? '[Событие] ' : m.type === 'pitch' ? '[Питч] ' : '';
        lines.push(time + typeLabel + who + m.text);
    }

    var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bunker-chat-' + (state.roomCode || 'log') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
}
