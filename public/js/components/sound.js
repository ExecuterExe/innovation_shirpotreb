// ═══════════════════════════════════════════════════════════════════
// SOUND EFFECTS (Web Audio API)
// ═══════════════════════════════════════════════════════════════════

let audioCtx = null;

export function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { /* ignore */ }
    }
}

export function playSound(type) {
    if (!audioCtx) return;

    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t = audioCtx.currentTime;

        switch (type) {
            case 'join':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, t);
                osc.frequency.linearRampToValueAtTime(900, t + 0.1);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'start':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.linearRampToValueAtTime(800, t + 0.15);
                osc.frequency.linearRampToValueAtTime(1200, t + 0.3);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.4);
                osc.start(t); osc.stop(t + 0.4);
                break;
            case 'tick':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, t);
                gain.gain.setValueAtTime(0.06, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.05);
                osc.start(t); osc.stop(t + 0.05);
                break;
            case 'warning':
                osc.type = 'square';
                osc.frequency.setValueAtTime(440, t);
                osc.frequency.setValueAtTime(520, t + 0.1);
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'success':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523, t);
                osc.frequency.setValueAtTime(659, t + 0.12);
                osc.frequency.setValueAtTime(784, t + 0.24);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.4);
                osc.start(t); osc.stop(t + 0.4);
                break;
            case 'fanfare':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523, t);
                osc.frequency.setValueAtTime(659, t + 0.15);
                osc.frequency.setValueAtTime(784, t + 0.3);
                osc.frequency.setValueAtTime(1047, t + 0.45);
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.7);
                osc.start(t); osc.stop(t + 0.7);
                break;
            case 'invest':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.linearRampToValueAtTime(600, t + 0.15);
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
        }
    } catch (e) { /* ignore */ }
}