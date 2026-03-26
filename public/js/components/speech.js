// ═══════════════════════════════════════════
// ОЗВУЧКА ТЕКСТА — Web Speech API
// ═══════════════════════════════════════════

var speechEnabled = false;
var currentUtterance = null;

export function initSpeech() {
    speechEnabled = 'speechSynthesis' in window;
    if (!speechEnabled) {
        console.warn('[speech] Web Speech API не поддерживается');
    }
    return speechEnabled;
}

export function isSpeechSupported() {
    return 'speechSynthesis' in window;
}

export function speak(text, onEnd) {
    if (!speechEnabled && !initSpeech()) {
        if (onEnd) onEnd();
        return;
    }

    // Останавливаем предыдущую озвучку
    stopSpeaking();

    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Пытаемся найти русский голос
    var voices = speechSynthesis.getVoices();
    var ruVoice = null;
    for (var i = 0; i < voices.length; i++) {
        if (voices[i].lang && voices[i].lang.startsWith('ru')) {
            ruVoice = voices[i];
            break;
        }
    }
    if (ruVoice) utterance.voice = ruVoice;

    utterance.onend = function () {
        currentUtterance = null;
        if (onEnd) onEnd();
    };

    utterance.onerror = function () {
        currentUtterance = null;
        if (onEnd) onEnd();
    };

    currentUtterance = utterance;
    speechSynthesis.speak(utterance);
}

export function speakSequence(texts, onAllDone) {
    // Озвучиваем массив текстов последовательно
    var index = 0;

    function next() {
        if (index >= texts.length) {
            if (onAllDone) onAllDone();
            return;
        }
        var text = texts[index];
        index++;

        if (!text || !text.trim()) {
            next();
            return;
        }

        speak(text, function () {
            // Небольшая пауза между фразами
            setTimeout(next, 400);
        });
    }

    next();
}

export function stopSpeaking() {
    if (speechSynthesis) {
        speechSynthesis.cancel();
    }
    currentUtterance = null;
}

export function isSpeaking() {
    return speechSynthesis && speechSynthesis.speaking;
}