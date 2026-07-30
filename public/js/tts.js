// Text-to-Speech (TTS) Module - LingoBot2 Ver7.0β Implementation (Fixed JSON Audio URL Handling)
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
        if (window.LingoApp && window.LingoApp.onTtsPlaybackEnded) {
            window.LingoApp.onTtsPlaybackEnded();
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

        const cacheKey = `${voiceModel}_${cleanText}`;
        let audioUrl = this.cachedAudioUrls[cacheKey];

        if (audioUrl) {
            if (window.LingoLog) window.LingoLog.add(`Phát âm thanh từ bộ nhớ đệm Cache.`);
            this.audio = new Audio(audioUrl);
            this.audio.onended = () => this.resetPlayButtons();
            this.audio.onerror = () => this.resetPlayButtons();
            this.audio.play().catch(e => {
                console.warn("Play cached audio error:", e);
                this.speakWebSpeechFallback(cleanText);
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
                voice_name: voiceModel,
                api_key: apiKey
            })
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.audio_url) {
                audioUrl = data.audio_url;
                this.cachedAudioUrls[cacheKey] = audioUrl;

                if (playBtn) playBtn._cachedAudioUrl = audioUrl;

                if (window.LingoLog) window.LingoLog.add(`Nhận âm thanh EdgeTTS thành công [${data.model_used || voiceModel}]. Bắt đầu phát...`);

                this.audio = new Audio(audioUrl);
                this.audio.onended = () => this.resetPlayButtons();
                this.audio.onerror = () => {
                    if (window.LingoLog) window.LingoLog.add("Lỗi phát EdgeTTS Audio element -> Chuyển sang Web Speech API.");
                    this.speakWebSpeechFallback(cleanText);
                };

                this.audio.play().catch(e => {
                    console.warn("Play audio url error (Autoplay policy or browser block):", e);
                    this.speakWebSpeechFallback(cleanText);
                });
            } else if (data.fallback_browser) {
                if (window.LingoLog) window.LingoLog.add("Máy chủ chỉ định chuyển sang Web Speech API.");
                this.speakWebSpeechFallback(cleanText);
            } else {
                throw new Error("Invalid TTS JSON response");
            }
        })
        .catch(err => {
            console.warn("Server TTS Error, falling back to Web Speech:", err);
            if (window.LingoLog) window.LingoLog.add(`Lỗi máy chủ TTS (${err.message}) -> Dùng Web Speech API dự phòng.`);
            this.speakWebSpeechFallback(cleanText);
        });
    },

    speakWebSpeechFallback(text) {
        if (!('speechSynthesis' in window)) {
            this.resetPlayButtons();
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        const targetLang = window.LingoApp ? window.LingoApp.targetLang : "jp 日本語";

        if (targetLang.includes("日本語")) {
            utterance.lang = 'ja-JP';
            utterance.rate = 0.95;
        } else if (targetLang.includes("English") || targetLang.includes("us")) {
            utterance.lang = 'en-US';
            utterance.rate = 0.95;
        } else if (targetLang.includes("Việt") || targetLang.includes("vn")) {
            utterance.lang = 'vi-VN';
            utterance.rate = 0.95;
        }

        utterance.onend = () => this.resetPlayButtons();
        utterance.onerror = () => this.resetPlayButtons();

        if (window.LingoLog) window.LingoLog.add(`Đang đọc bằng giọng đọc Web Speech API của trình duyệt [${utterance.lang}].`);
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

        const ttsSelect = document.getElementById("ttsModelSelect");
        const voiceModel = ttsSelect ? ttsSelect.value : "ja-JP-Chirp3-HD-F";
        const cacheKey = `${voiceModel}_${cleanText}`;

        const url = audioUrl || this.cachedAudioUrls[cacheKey];
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
