// ═══════════════════════════════════════════
// QR-КОД КОМНАТЫ НА ЭКРАНЕ
// Зритель стрима или человек в зале сканирует его сам, не прося ведущего.
//  • в лобби — внутри карточки с кодом комнаты (ведёт «играть»);
//  • в игре — в колонке участников под реакциями (см. audience.js, ведёт «смотреть»).
// Ведущий выключает его настройкой «QR-код комнаты на экране»; скрытый код прячет и QR.
// ═══════════════════════════════════════════
import { state, escapeHtml } from '../app.js';
import { qrSvg } from './qr.js';
import { openInviteModal } from './audience.js';

function enabled() {
    return !!state.roomCode && !(state.settings && state.settings.qrOnScreen === false) && !state.codeHidden;
}

export function roomQrLink(watch) {
    return location.origin + '/?room=' + encodeURIComponent(state.roomCode || '') + (watch ? '&watch=1' : '');
}

// ── лобби: QR рядом с кодом комнаты ──
export function lobbyQrHtml() {
    if (!enabled()) return '';
    return '<button type="button" class="room-qr-mini" id="room-qr-mini" title="Наведите камеру телефона — и вы в комнате. Нажмите, чтобы увеличить">'
        + qrSvg(roomQrLink(false), { size: 92 })
        + '<span>📱 сканируйте</span></button>';
}

export function bindLobbyQr(root) {
    var btn = (root || document).querySelector('#room-qr-mini');
    if (btn) btn.addEventListener('click', function () { openInviteModal('play'); });
}
