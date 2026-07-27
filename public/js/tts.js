// Text-to-Speech (TTS) Module - LingoBot2 Ver5.7 Implementation
// Audio Preload & Synchronized Bubble Reveal with Speech Playback
window.LingoTTS = {
    audio: null,
    activePlayBtn: null,
    cachedAudioUrls: {},

    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.audio = null;
        }
        this.resetPlayButtons();
        if (window.LingoLog) window.LingoLog.add("Đã dừng phát âm thanh TTS.");
    },

    resetPlayButtons() {
        const uiLang = window.LingoApp ? window.LingoApp.uiLang : "tiếng Việt";
        const dict = (window.LingoApp && window.LingoApp.i18n[uiLang]) || {};
        const defaultText = dict.btnPlay || "▶ Phát";

        document.querySelectorAll(".btn-play").forEach(btn => {
            btn.classList.remove("playing");
            btn.textContent = defaultText;
        });
        this.activePlayBtn = null;
    },

    // PRELOAD AUDIO AND EXECUTE SYNCED REVEAL AT EXACT PLAYBACK START
    async playWithSyncBubble(text, playCallback) {
        this.stop();

        const cleanText = (text || "")
            .replace(/💡.*?\n/g, '') // Filter out 💡 advice lines from TTS
            .replace(/（.*?）|\(.*?\)/g, '') // Filter out furigana in parentheses
            .replace(/<ruby>.*?<rt>(.*?)<\/rt><\/ruby>/g, '$1')
            .trim();

        if (!cleanText) {
            if (playCallback) playCallback();
            return;
        }

        const ttsSelect = document.getElementById("ttsModelSelect");
        const voiceModel = ttsSelect ? ttsSelect.value : "ja-JP-Chirp3-HD-F";

        let audioUrl = this.cachedAudioUrls[cleanText];
        let hasExecutedCallback = false;

        const executeOnceCallback = () => {
            if (!hasExecutedCallback) {
                hasExecutedCallback = true;
                if (playCallback) playCallback();
            }
        };

        if (audioUrl) {
            this.audio = new Audio(audioUrl);
            this.audio.onplay = () => executeOnceCallback();
            this.audio.onended = () => this.resetPlayButtons();
            this.audio.onerror = () => executeOnceCallback();

            try {
                await this.audio.play();
            } catch (err) {
                console.warn("Audio autoplay blocked or failed:", err);
                executeOnceCallback();
            }
            return;
        }

        // Fetch Audio Stream from Server
        try {
            const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: cleanText,
                    voice: voiceModel,
                    api_key: apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`TTS HTTP status ${response.status}`);
            }

            const blob = await response.blob();
            if (blob.size < 500) {
                throw new Error("TTS payload too small");
            }

            audioUrl = URL.createObjectURL(blob);
            this.cachedAudioUrls[cleanText] = audioUrl;

            this.audio = new Audio(audioUrl);
            
            // SYNCHRONIZED REVEAL: Trigger bubble creation on exact audio play event
            this.audio.onplay = () => executeOnceCallback();
            this.audio.onended = () => this.resetPlayButtons();
            this.audio.onerror = () => executeOnceCallback();

            // Safety timeout: If audio play is blocked or takes longer than 2.5s, reveal bubble anyway
            setTimeout(() => executeOnceCallback(), 2500);

            try {
                await this.audio.play();
            } catch (playErr) {
                console.warn("Autoplay interaction requirement triggered:", playErr);
                executeOnceCallback();
            }
        } catch (err) {
            console.warn("Preload TTS Server Error, falling back to Web Speech:", err);
            this.speakWebSpeechFallback(cleanText, executeOnceCallback);
        }
    },

    playText(text, playBtn = null) {
        this.stop();

        const cleanText = (text || "")
            .replace(/💡.*?\n/g, '')
            .replace(/（.*?）|\(.*?\)/g, '')
            .replace(/<ruby>.*?<rt>(.*?)<\/rt><\/ruby>/g, '$1')
            .trim();

        if (!cleanText) return;

        const uiLang = window.LingoApp ? window.LingoApp.uiLang : "tiếng Việt";
        const dict = (window.LingoApp && window.LingoApp.i18n[uiLang]) || {};
        const playingText = dict.btnPlaying || "▶ 再生中";

        if (playBtn) {
            this.activePlayBtn = playBtn;
            playBtn.classList.add("playing");
            playBtn.textContent = playingText;
        }

        const ttsSelect = document.getElementById("ttsModelSelect");
        const voiceModel = ttsSelect ? ttsSelect.value : "ja-JP-Chirp3-HD-F";

        let audioUrl = this.cachedAudioUrls[cleanText];

        if (audioUrl) {
            this.audio = new Audio(audioUrl);
            this.audio.onended = () => this.resetPlayButtons();
            this.audio.onerror = () => this.resetPlayButtons();
            this.audio.play().catch(e => {
                console.warn("Play cached audio error:", e);
                this.resetPlayButtons();
            });
            return;
        }

        const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";
        fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: cleanText,
                voice: voiceModel,
                api_key: apiKey
            })
        })
        .then(res => res.blob())
        .then(blob => {
            if (blob.size < 500) throw new Error("TTS Blob payload too small");
            audioUrl = URL.createObjectURL(blob);
            this.cachedAudioUrls[cleanText] = audioUrl;

            if (playBtn) playBtn._cachedAudioUrl = audioUrl;

            this.audio = new Audio(audioUrl);
            this.audio.onended = () => this.resetPlayButtons();
            this.audio.onerror = () => this.resetPlayButtons();
            this.audio.play().catch(e => {
                console.warn("Play audio blob error:", e);
                this.resetPlayButtons();
            });
        })
        .catch(err => {
            console.warn("Server TTS Error, falling back to Web Speech:", err);
            this.speakWebSpeechFallback(cleanText, () => {});
        });
    },

    speakWebSpeechFallback(text, onStartCallback = null) {
        if (!('speechSynthesis' in window)) {
            if (onStartCallback) onStartCallback();
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        const targetLang = window.LingoApp ? window.LingoApp.targetLang : "jp 日本語";

        if (targetLang.includes("日本語")) {
            utterance.lang = 'ja-JP';
        } else if (targetLang.includes("English") || targetLang.includes("us")) {
            utterance.lang = 'en-US';
        } else if (targetLang.includes("Việt") || targetLang.includes("vn")) {
            utterance.lang = 'vi-VN';
        }

        utterance.onstart = () => {
            if (onStartCallback) onStartCallback();
        };

        utterance.onend = () => this.resetPlayButtons();
        utterance.onerror = () => {
            if (onStartCallback) onStartCallback();
            this.resetPlayButtons();
        };

        window.speechSynthesis.speak(utterance);
    },

    updateActiveTtsBadge(modelName) {
        const badge = document.getElementById("activeTtsBadge");
        if (!badge) return;

        if (modelName === "browser-native") {
            badge.textContent = "Gen";
            badge.style.background = "#e0e7ff";
            badge.style.color = "#3730a3";
        } else if (modelName.includes("Chirp3")) {
            const gender = modelName.endsWith("-F") ? "♀" : "♂";
            const lang = modelName.startsWith("ja") ? "JP" : "EN";
            badge.textContent = `EdgeTTS ${lang}(${gender})`;
            badge.style.background = "#f0f9ff";
            badge.style.color = "#0369a1";
        } else if (modelName.includes("Neural2")) {
            badge.textContent = "EdgeTTS VN(♀)";
            badge.style.background = "#f0f9ff";
            badge.style.color = "#0369a1";
        } else {
            badge.textContent = "Gen";
            badge.style.background = "#f1f5f9";
            badge.style.color = "#334155";
        }
    },

    downloadAudio(text, audioUrl = null) {
        const cleanText = (text || "")
            .replace(/💡.*?\n/g, '')
            .replace(/（.*?）|\(.*?\)/g, '')
            .replace(/<ruby>.*?<rt>(.*?)<\/rt><\/ruby>/g, '$1')
            .trim();

        if (!cleanText) return;

        const url = audioUrl || this.cachedAudioUrls[cleanText];
        if (url) {
            const a = document.createElement("a");
            a.href = url;
            a.download = `lingobot_speech_${Date.now()}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            if (window.LingoLog) window.LingoLog.add("Đã tải xuống tệp MP3 về máy.");
        } else {
            alert("Tệp MP3 đang được khởi tạo, vui lòng nhấn phát âm thanh 1 lần trước khi tải về.");
        }
    }
};
