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

// Общий контекст — им пользуется и фоновая музыка (music.js)
export function getAudioCtx() {
    return audioCtx;
}

// Барабанная дробь перед разоблачением: частые глухие удары с нарастанием
function drumroll() {
    var t0 = audioCtx.currentTime;
    for (var i = 0; i < 18; i++) {
        var t = t0 + i * 0.065;
        var osc = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140 + (i % 2) * 12, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.05);
        g.gain.setValueAtTime(0.03 + i * 0.004, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(t); osc.stop(t + 0.07);
    }
}

// Удар печати: низкий «бум» и щелчок
function stamp() {
    var t = audioCtx.currentTime;
    var boom = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(160, t);
    boom.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    boom.connect(g); g.connect(audioCtx.destination);
    boom.start(t); boom.stop(t + 0.26);
    var click = audioCtx.createOscillator();
    var cg = audioCtx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(1800, t);
    cg.gain.setValueAtTime(0.04, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    click.connect(cg); cg.connect(audioCtx.destination);
    click.start(t); click.stop(t + 0.04);
}

export function playSound(type) {
    if (!audioCtx) return;

    try {
        if (type === 'drumroll') { drumroll(); return; }
        if (type === 'stamp') { stamp(); return; }

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
            case 'whoosh':
                // Занавес поднимается
                osc.type = 'sine';
                osc.frequency.setValueAtTime(220, t);
                osc.frequency.exponentialRampToValueAtTime(1100, t + 0.3);
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.linearRampToValueAtTime(0.07, t + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
                osc.start(t); osc.stop(t + 0.36);
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