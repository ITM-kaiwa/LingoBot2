// Text-to-Speech (TTS) Module - LingoBot2 Ver5.8 Implementation
// Robust Autoplay Unlocker, Synchronized Bubble Reveal, and Reliable Play Buttons
window.LingoTTS = {
    audio: null,
    activePlayBtn: null,
    cachedAudioBlobs: {},
    isAudioUnlocked: false,

    // UNLOCK BROWSER AUTOPLAY POLICY ON FIRST USER GESTURE
    unlockAutoplay() {
        if (this.isAudioUnlocked) return;
        try {
            const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
            silentAudio.play().then(() => {
                this.isAudioUnlocked = true;
                if (window.LingoLog) window.LingoLog.add("Đã kích hoạt giải khóa Autoplay Audio cho trình duyệt.");
            }).catch(() => {});
        } catch (e) {}
    },

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

    // PRELOAD AUDIO AND REVEAL BUBBLE SYNCED WITH AUDIO PLAYBACK
    async playWithSyncBubble(text, playCallback) {
        this.stop();
        this.unlockAutoplay();

        const cleanText = (text || "")
            .replace(/💡.*?\n/g, '') // Filter out 💡 advice lines from TTS
            .replace(/（.*?）|\(.*?\)/g, '') // Filter out furigana in parentheses
            .replace(/<ruby>.*?<rt>(.*?)<\/rt><\/ruby>/g, '$1')
            .trim();

        if (!cleanText) {
            if (playCallback) playCallback();
            return;
        }

        let hasExecutedCallback = false;
        const executeOnceCallback = () => {
            if (!hasExecutedCallback) {
                hasExecutedCallback = true;
                if (playCallback) playCallback();
            }
        };

        const ttsSelect = document.getElementById("ttsModelSelect");
        const voiceModel = ttsSelect ? ttsSelect.value : "ja-JP-Chirp3-HD-F";

        // Check Cached Audio Blob
        if (this.cachedAudioBlobs[cleanText]) {
            const blobUrl = URL.createObjectURL(this.cachedAudioBlobs[cleanText]);
            this.audio = new Audio(blobUrl);
            this.audio.onended = () => this.resetPlayButtons();
            this.audio.onerror = () => executeOnceCallback();

            executeOnceCallback();
            this.audio.play().catch(err => {
                console.warn("Autoplay blocked for cached audio:", err);
            });
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
            if (blob.size < 300) {
                throw new Error("TTS payload too small");
            }

            this.cachedAudioBlobs[cleanText] = blob;
            const blobUrl = URL.createObjectURL(blob);

            this.audio = new Audio(blobUrl);
            this.audio.onended = () => this.resetPlayButtons();
            this.audio.onerror = () => executeOnceCallback();

            // REVEAL BUBBLE AT ONCE BEFORE PLAYING AUDIO
            executeOnceCallback();

            try {
                await this.audio.play();
            } catch (playErr) {
                console.warn("Autoplay policy restriction triggered:", playErr);
            }
        } catch (err) {
            console.warn("TTS fetch failed, using Web Speech fallback:", err);
            executeOnceCallback();
            this.speakWebSpeechFallback(cleanText);
        }
    },

    // MANUAL PLAY BUTTON HANDLER (ALWAYS WORKS ON DIRECT USER CLICK)
    playText(text, playBtn = null) {
        this.stop();
        this.unlockAutoplay();

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

        // Check Cache
        if (this.cachedAudioBlobs[cleanText]) {
            const blobUrl = URL.createObjectURL(this.cachedAudioBlobs[cleanText]);
            if (playBtn) playBtn._cachedAudioUrl = blobUrl;

            this.audio = new Audio(blobUrl);
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
        .then(res => {
            if (!res.ok) throw new Error("TTS response error");
            return res.blob();
        })
        .then(blob => {
            if (blob.size < 300) throw new Error("TTS Blob payload too small");
            this.cachedAudioBlobs[cleanText] = blob;
            const blobUrl = URL.createObjectURL(blob);

            if (playBtn) playBtn._cachedAudioUrl = blobUrl;

            this.audio = new Audio(blobUrl);
            this.audio.onended = () => this.resetPlayButtons();
            this.audio.onerror = () => this.resetPlayButtons();
            this.audio.play().catch(e => {
                console.warn("Play audio blob error:", e);
                this.resetPlayButtons();
            });
        })
        .catch(err => {
            console.warn("Server TTS Error, falling back to Web Speech:", err);
            this.speakWebSpeechFallback(cleanText);
        });
    },

    speakWebSpeechFallback(text) {
        if (!('speechSynthesis' in window)) return;

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

        utterance.onend = () => this.resetPlayButtons();
        utterance.onerror = () => this.resetPlayButtons();

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

        let url = audioUrl;
        if (!url && this.cachedAudioBlobs[cleanText]) {
            url = URL.createObjectURL(this.cachedAudioBlobs[cleanText]);
        }

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
