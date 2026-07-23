// Google Cloud Text-to-Speech Controller - LingoBot2 Ver1.35 Implementation
window.LingoTTS = {
    currentAudio: null,
    currentPlayBtn: null,

    async playText(text, btnElement = null) {
        this.stop();

        if (btnElement) {
            this.currentPlayBtn = btnElement;
            btnElement.classList.add("playing");
            btnElement.textContent = "⏳...";
        }

        const cleanText = text.replace(/（[^）]+）/g, "").replace(/\([^)]+\)/g, "").trim();
        if (!cleanText) {
            this.resetBtnState();
            return;
        }

        const ttsSelect = document.getElementById("ttsModelSelect");
        const voiceName = ttsSelect ? ttsSelect.value : "ja-JP-Chirp3-HD-F";
        const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";

        window.LingoLog.add(`Yêu cầu Google Cloud TTS [Voice: ${voiceName}]: "${cleanText.substring(0, 30)}..."`);

        try {
            const reqPayload = {
                text: cleanText,
                voice_name: voiceName
            };
            if (apiKey && apiKey.trim().length > 5) {
                reqPayload.api_key = apiKey.trim();
            }

            const response = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqPayload)
            });

            const data = await response.json();

            if (data.audio_url) {
                const audio = new Audio(data.audio_url);
                this.currentAudio = audio;
                
                if (btnElement) {
                    btnElement._cachedAudioUrl = data.audio_url;
                }

                audio.onplay = () => {
                    const dict = window.LingoApp ? (window.LingoApp.i18n[window.LingoApp.uiLang] || window.LingoApp.i18n["tiếng Việt"]) : {};
                    if (btnElement) btnElement.textContent = "🔊 " + (dict.btnPlay || "Phát");
                    window.LingoLog.add(`Đang phát Google Cloud TTS MP3 (${data.model_used || voiceName}).`);
                };

                audio.onended = () => {
                    this.resetBtnState();
                    window.LingoLog.add("Phát âm thanh hoàn tất.");
                };

                audio.onerror = (e) => {
                    console.error("Audio playback error:", e);
                    window.LingoLog.add("Lỗi phát tệp âm thanh MP3. Chuyển sang Web SpeechSynthesis trình duyệt dự phòng...");
                    this.playBrowserTts(cleanText, voiceName);
                };

                await audio.play();
            } else {
                window.LingoLog.add(`Google Cloud TTS API (${data.error || "Không thể tổng hợp"}). Chuyển sang Web SpeechSynthesis trình duyệt dự phòng...`);
                this.playBrowserTts(cleanText, voiceName);
            }
        } catch (err) {
            window.LingoLog.add(`Lỗi kết nối TTS Server: ${err.message}. Chuyển sang Web SpeechSynthesis dự phòng...`);
            this.playBrowserTts(cleanText, voiceName);
        }
    },

    playBrowserTts(text, voiceName) {
        if (!('speechSynthesis' in window)) {
            alert("Trình duyệt của bạn không hỗ trợ Web Speech Synthesis.");
            this.resetBtnState();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        if (voiceName.includes("ja-JP") || voiceName.includes("Chirp3-HD-F") || voiceName.includes("Chirp3-HD-M")) {
            utterance.lang = "ja-JP";
        } else if (voiceName.includes("en-US")) {
            utterance.lang = "en-US";
        } else {
            utterance.lang = "vi-VN";
        }

        utterance.onstart = () => {
            const dict = window.LingoApp ? (window.LingoApp.i18n[window.LingoApp.uiLang] || window.LingoApp.i18n["tiếng Việt"]) : {};
            if (this.currentPlayBtn) this.currentPlayBtn.textContent = "🔊 " + (dict.btnPlay || "Phát");
        };

        utterance.onend = () => {
            this.resetBtnState();
        };

        utterance.onerror = () => {
            this.resetBtnState();
        };

        window.speechSynthesis.speak(utterance);
    },

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        this.resetBtnState();
        window.LingoLog.add("Đã dừng phát âm thanh.");
    },

    resetBtnState() {
        if (this.currentPlayBtn) {
            const dict = window.LingoApp ? (window.LingoApp.i18n[window.LingoApp.uiLang] || window.LingoApp.i18n["tiếng Việt"]) : {};
            this.currentPlayBtn.classList.remove("playing");
            this.currentPlayBtn.textContent = dict.btnPlay || "▶ Phát";
            this.currentPlayBtn = null;
        }
    },

    downloadAudio(text, cachedUrl = null) {
        if (cachedUrl) {
            this.triggerDownload(cachedUrl, "LingoBot2_TTS_Audio.mp3");
            return;
        }

        const cleanText = text.replace(/（[^）]+）/g, "").replace(/\([^)]+\)/g, "").trim();
        const ttsSelect = document.getElementById("ttsModelSelect");
        const voiceName = ttsSelect ? ttsSelect.value : "ja-JP-Chirp3-HD-F";
        const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";

        const reqPayload = { text: cleanText, voice_name: voiceName };
        if (apiKey && apiKey.trim().length > 5) reqPayload.api_key = apiKey.trim();

        fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqPayload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.audio_url) {
                this.triggerDownload(data.audio_url, "LingoBot2_TTS_Audio.mp3");
            } else {
                alert("Không thể tải audio MP3 từ Google Cloud TTS.");
            }
        })
        .catch(err => alert("Lỗi tải audio: " + err.message));
    },

    triggerDownload(url, filename) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    updateActiveTtsBadge(modelName) {
        const badge = document.getElementById("activeTtsBadge");
        if (!badge) return;

        let abbr = "JP-Chirp";
        if (modelName.includes("ja-JP-Chirp3-HD-F")) abbr = "JP-Chirp(♀)";
        else if (modelName.includes("ja-JP-Chirp3-HD-M")) abbr = "JP-Chirp(♂)";
        else if (modelName.includes("en-US-Chirp3-HD-F")) abbr = "EN-Chirp(♀)";
        else if (modelName.includes("en-US-Chirp3-HD-M")) abbr = "EN-Chirp(♂)";
        else if (modelName.includes("ja-JP-Neural2")) abbr = "JP-Neural2";
        else if (modelName.includes("en-US-Neural2")) abbr = "EN-Neural2";
        else if (modelName.includes("vi-VN-Neural2")) abbr = "VN-Neural2";

        badge.textContent = abbr;
    }
};
