// Google Cloud Text-To-Speech Manager (Chirp 3 HD -> Neural2 -> WaveNet -> Standard + Audio Download + Short Model Badge)
window.LingoTTS = {
    audioPlayer: null,
    currentActiveBtn: null,

    init() {
        this.audioPlayer = document.getElementById("globalAudioPlayer");
        if (!this.audioPlayer) {
            this.audioPlayer = document.createElement("audio");
            this.audioPlayer.id = "globalAudioPlayer";
            document.body.appendChild(this.audioPlayer);
        }

        this.audioPlayer.addEventListener("ended", () => {
            this.resetActiveButton();
        });

        this.audioPlayer.addEventListener("error", (e) => {
            window.LingoLog.add("Lỗi phát Audio Player", e);
            this.resetActiveButton();
        });

        // Initialize active badge with currently selected dropdown option
        this.updateActiveTtsBadge(this.getSelectedVoiceModel());
    },

    // Convert full voice model ID into short abbreviation e.g. "JP-Chirp", "US-Chirp", "JP-Neural2"
    formatShortVoiceName(voiceName) {
        if (!voiceName) return "JP-Chirp";
        if (voiceName.includes("Chirp3-HD") || voiceName.includes("Chirp")) {
            if (voiceName.startsWith("ja")) return "JP-Chirp";
            if (voiceName.startsWith("en")) return "US-Chirp";
            return "Chirp-3D";
        }
        if (voiceName.includes("Neural2")) {
            if (voiceName.startsWith("ja")) return "JP-Neural2";
            if (voiceName.startsWith("en")) return "US-Neural2";
            if (voiceName.startsWith("vi")) return "VN-Neural2";
            return "Neural2";
        }
        if (voiceName.includes("Wavenet") || voiceName.includes("WaveNet")) {
            if (voiceName.startsWith("ja")) return "JP-Wavenet";
            if (voiceName.startsWith("en")) return "US-Wavenet";
            if (voiceName.startsWith("vi")) return "VN-Wavenet";
            return "Wavenet";
        }
        if (voiceName.includes("Standard")) {
            if (voiceName.startsWith("ja")) return "JP-Standard";
            if (voiceName.startsWith("en")) return "US-Standard";
            if (voiceName.startsWith("vi")) return "VN-Standard";
            return "Standard";
        }
        if (voiceName === "browser" || voiceName.includes("Web")) return "Web-Speech";
        return voiceName;
    },

    updateActiveTtsBadge(modelName) {
        const badge = document.getElementById("activeTtsBadge");
        if (badge) {
            const shortName = this.formatShortVoiceName(modelName);
            badge.textContent = shortName;
        }
    },

    // Clean Japanese furigana annotations before TTS playback or download
    stripFurigana(text) {
        if (!text) return "";
        let cleaned = text;

        // 1. Remove HTML ruby tags: <ruby>漢字<rt>かんじ</rt></ruby> -> 漢字
        cleaned = cleaned.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/gi, '$1');
        cleaned = cleaned.replace(/<rt>.*?<\/rt>/gi, '');
        cleaned = cleaned.replace(/<\/?ruby>/gi, '');

        // 2. Remove full-width Japanese furigana brackets: 漢字（かんじ） -> 漢字
        cleaned = cleaned.replace(/([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)（[\u3040-\u309f\u30a0-\u30ff\s]+）/g, '$1');

        // 3. Remove half-width furigana brackets: 漢字(かんじ) -> 漢字
        cleaned = cleaned.replace(/([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)\([\u3040-\u309f\u30a0-\u30ff\s]+\)/g, '$1');

        // 4. Remove square bracket furigana: 漢字[かんじ] -> 漢字
        cleaned = cleaned.replace(/([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)\[[\u3040-\u309f\u30a0-\u30ff\s]+\]/g, '$1');

        // 5. Fallback remove any remaining brackets containing hiragana/katakana readings
        cleaned = cleaned.replace(/（[\u3040-\u309f\u30a0-\u30ff]+）/g, '');
        cleaned = cleaned.replace(/\([\u3040-\u309f\u30a0-\u30ff]+\)/g, '');

        return cleaned.trim();
    },

    getSelectedVoiceModel() {
        const select = document.getElementById("ttsModelSelect");
        return (select && select.value) ? select.value : "ja-JP-Chirp3-HD-F";
    },

    stop() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        this.resetActiveButton();
        window.LingoLog.add("Đã dừng phát âm thanh.");
    },

    resetActiveButton() {
        if (this.currentActiveBtn) {
            this.currentActiveBtn.classList.remove("playing");
            const uiLang = window.LingoApp ? window.LingoApp.uiLang : "tiếng Việt";
            const dict = window.LingoApp && window.LingoApp.i18n ? window.LingoApp.i18n[uiLang] : null;
            this.currentActiveBtn.textContent = dict ? dict.btnPlay : "▶ Phát";
            this.currentActiveBtn = null;
        }
    },

    async playText(text, btnElement = null, customVoiceModel = null) {
        const cleanSpeechText = this.stripFurigana(text);

        if (btnElement && this.currentActiveBtn === btnElement && this.audioPlayer && !this.audioPlayer.paused) {
            this.stop();
            return;
        }

        this.stop();

        if (btnElement) {
            this.currentActiveBtn = btnElement;
            this.currentActiveBtn.classList.add("playing");
            this.currentActiveBtn.textContent = "▶ ...";
        }

        const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";
        const requestedVoice = customVoiceModel || this.getSelectedVoiceModel();

        window.LingoLog.add(`Yêu cầu Google Cloud TTS [Voice: ${requestedVoice}]: "${cleanSpeechText.substring(0, 35)}..."`);

        try {
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: apiKey,
                    text: cleanSpeechText,
                    voice_name: requestedVoice
                })
            });

            const data = await response.json();

            if (response.ok && data.audio_url) {
                this.audioPlayer.src = data.audio_url;
                if (btnElement) btnElement._cachedAudioUrl = data.audio_url;
                await this.audioPlayer.play();
                
                const usedModel = data.model_used || requestedVoice;
                this.updateActiveTtsBadge(usedModel);
                
                if (data.note) {
                    window.LingoLog.add(`Phát thành công giọng Google Cloud TTS: ${usedModel} (${data.note})`);
                } else {
                    window.LingoLog.add(`Phát thành công giọng Google Cloud TTS: (${usedModel})`);
                }
            } else {
                this.updateActiveTtsBadge("Web-Speech");
                window.LingoLog.add(`Chuyển sang Web SpeechSynthesis trình duyệt dự phòng...`);
                this.fallbackBrowserTTS(cleanSpeechText, requestedVoice);
            }
        } catch (err) {
            this.updateActiveTtsBadge("Web-Speech");
            window.LingoLog.add("Lỗi kết nối TTS API, chuyển dự phòng Web Speech", err.message);
            this.fallbackBrowserTTS(cleanSpeechText, requestedVoice);
        }
    },

    // Download synthesized MP3 audio file
    async downloadAudio(text, cachedUrl = null) {
        if (cachedUrl && cachedUrl.startsWith("data:audio")) {
            this.triggerFileDownload(cachedUrl, "lingobot2_ai_speech.mp3");
            window.LingoLog.add("Đã tải xuống tệp âm thanh MP3 từ bộ nhớ đệm.");
            return;
        }

        const cleanSpeechText = this.stripFurigana(text);
        const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";
        const requestedVoice = this.getSelectedVoiceModel();

        window.LingoLog.add(`Tải xuống MP3 [Giọng: ${requestedVoice}]...`);

        try {
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: apiKey,
                    text: cleanSpeechText,
                    voice_name: requestedVoice
                })
            });

            const data = await response.json();
            if (response.ok && data.audio_url) {
                this.triggerFileDownload(data.audio_url, "lingobot2_ai_speech.mp3");
                const usedModel = data.model_used || requestedVoice;
                this.updateActiveTtsBadge(usedModel);
                window.LingoLog.add(`Đã tải xuống MP3 thành công (${usedModel}).`);
            } else {
                alert("Không thể tạo tệp âm thanh. Vui lòng kiểm tra Google API Key.");
            }
        } catch (err) {
            window.LingoLog.add("Lỗi tải xuống audio", err.message);
            alert("Lỗi tải xuống tệp âm thanh: " + err.message);
        }
    },

    triggerFileDownload(url, filename) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    fallbackBrowserTTS(text, voiceName) {
        if (!('speechSynthesis' in window)) {
            this.resetActiveButton();
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (voiceName.startsWith("ja")) utterance.lang = "ja-JP";
        else if (voiceName.startsWith("en")) utterance.lang = "en-US";
        else utterance.lang = "vi-VN";

        utterance.onend = () => this.resetActiveButton();
        utterance.onerror = () => this.resetActiveButton();

        window.speechSynthesis.speak(utterance);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoTTS.init();
});
