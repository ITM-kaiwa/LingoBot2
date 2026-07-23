// Google Cloud Text-To-Speech Manager with Furigana Stripping
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
    },

    // Clean Japanese furigana annotations (parentheses, brackets, ruby tags) before TTS playback
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
        return (select && select.value) ? select.value : "ja-JP-Neural2-B";
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
            this.currentActiveBtn.textContent = "▶ Phát";
            this.currentActiveBtn = null;
        }
    },

    async playText(text, btnElement = null, customVoiceModel = null) {
        // Strip Japanese furigana readings before TTS reading out
        const cleanSpeechText = this.stripFurigana(text);

        if (btnElement && this.currentActiveBtn === btnElement && this.audioPlayer && !this.audioPlayer.paused) {
            this.stop();
            return;
        }

        this.stop();

        if (btnElement) {
            this.currentActiveBtn = btnElement;
            this.currentActiveBtn.classList.add("playing");
            this.currentActiveBtn.textContent = "▶ Đang phát...";
        }

        const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";
        const voiceName = customVoiceModel || this.getSelectedVoiceModel();

        window.LingoLog.add(`Phát TTS [Đã loại bỏ furigana]: "${cleanSpeechText.substring(0, 35)}..." [Giọng: ${voiceName}]`);

        try {
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: apiKey,
                    text: cleanSpeechText,
                    voice_name: voiceName
                })
            });

            const data = await response.json();

            if (response.ok && data.audio_url) {
                this.audioPlayer.src = data.audio_url;
                await this.audioPlayer.play();
                window.LingoLog.add(`Đang phát audio thành công bằng giọng đọc (${voiceName}).`);
            } else {
                window.LingoLog.add(`TTS Backend: Chuyển sang Web SpeechSynthesis trình duyệt (${voiceName})...`, data.error || "");
                this.fallbackBrowserTTS(cleanSpeechText, voiceName);
            }
        } catch (err) {
            window.LingoLog.add("Lỗi kết nối TTS API, chuyển dự phòng Web Speech", err.message);
            this.fallbackBrowserTTS(cleanSpeechText, voiceName);
        }
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
