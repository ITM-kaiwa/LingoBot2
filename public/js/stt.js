// Web Speech STT Engine & Pronunciation Analyzer - LingoBot2 Ver5.6β Implementation
// Enhanced Microphone Permissions, Retry Logic on Speech Network Errors
window.LingoSTT = {
    recognition: null,
    isListening: false,
    silenceTimer: null,
    retryCount: 0,
    activeStream: null,

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.LingoLog.add("⚠️ Trình duyệt không hỗ trợ Web Speech API (SpeechRecognition).");
            return;
        }

        const micBtn = document.getElementById("micBtn");
        if (micBtn) {
            micBtn.addEventListener("click", () => this.toggleListening());
        }

        window.LingoLog.add("Khởi tạo Web Speech STT Engine (LingoBot2 Ver5.6β - Micro Auto-Permissions & Network Recovery) thành công.");
    },

    getRecognitionLang() {
        const targetLang = window.LingoApp ? window.LingoApp.targetLang : "jp 日本語";
        if (targetLang.includes("日本語") || targetLang.includes("jp")) return "ja-JP";
        if (targetLang.includes("English") || targetLang.includes("us")) return "en-US";
        if (targetLang.includes("Việt") || targetLang.includes("vn")) return "vi-VN";
        return "ja-JP";
    },

    resetSilenceTimer(onSilenceCallback) {
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        // 5 SECONDS SILENCE AUTO-OFF TIMER FOR STABILITY
        this.silenceTimer = setTimeout(() => {
            window.LingoLog.add("⏱️ 無音が5秒間続いたため、自動的にマイクをOFFにしました。 (5s Silence Auto-OFF triggered)");
            if (onSilenceCallback) onSilenceCallback();
        }, 5000);
    },

    toggleListening() {
        if (this.isListening) {
            this.stop();
        } else {
            this.retryCount = 0;
            this.start();
        }
    },

    async requestMicAccess() {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.activeStream = stream;
                return true;
            }
        } catch (err) {
            console.warn("Microphone access error:", err);
            window.LingoLog.add(`⚠️ Lỗi truy cập Micro: ${err.message}`);
        }
        return false;
    },

    async start() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng dùng Google Chrome!");
            return;
        }

        const hasMic = await this.requestMicAccess();
        if (!hasMic && this.retryCount === 0) {
            window.LingoLog.add("⚠️ Cần cấp quyền truy cập Micro trên trình duyệt để nói bằng giọng nói.");
        }

        const micBtn = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");

        if (this.recognition) {
            try { this.recognition.abort(); } catch(e){}
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.recognition.lang = this.getRecognitionLang();

        this.isListening = true;

        if (micBtn) {
            micBtn.classList.add("recording");
        }

        window.LingoLog.add(`Bắt đầu thu âm hội thoại [Language: ${this.recognition.lang}]...`);

        let finalTranscript = "";

        // Reset silence timer when starting
        this.resetSilenceTimer(() => this.stop());

        this.recognition.onresult = (event) => {
            this.resetSilenceTimer(() => this.stop());

            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            if (chatInput) {
                chatInput.value = finalTranscript || interim;
            }
        };

        this.recognition.onerror = (event) => {
            const errName = event.error;
            window.LingoLog.add(`Lỗi nhận diện giọng nói STT: ${errName}`);

            if (errName === "network" && this.retryCount < 2) {
                this.retryCount++;
                window.LingoLog.add(`🔄 Tự động thử lại nhận diện giọng nói (Retry #${this.retryCount})...`);
                setTimeout(() => {
                    if (this.isListening) this.start();
                }, 400);
                return;
            }

            if (errName === "network") {
                alert("🎤 Google 音声認識サーバーへの接続エラーが発生しました。インターネット接続をご確認いただくか、テキスト入力をお使いください。");
            }

            this.stop();
        };

        this.recognition.onend = () => {
            this.stop();
            if (chatInput && chatInput.value.trim()) {
                window.LingoLog.add(`Nhận diện giọng nói hoàn tất: "${chatInput.value}"`);
            }
        };

        try {
            this.recognition.start();
        } catch (e) {
            window.LingoLog.add(`Không thể khởi động STT: ${e.message}`);
            this.stop();
        }
    },

    stop() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        this.isListening = false;
        
        if (this.activeStream) {
            try {
                this.activeStream.getTracks().forEach(track => track.stop());
            } catch(e){}
            this.activeStream = null;
        }

        const micBtn = document.getElementById("micBtn");
        if (micBtn) {
            micBtn.classList.remove("recording");
        }
        if (this.recognition) {
            try { this.recognition.stop(); } catch(e){}
        }
    },

    // PRONUNCIATION ADVISOR STT ENGINE
    async listenForPronunciation(targetText, callback) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.LingoLog.add("⚠️ Web Speech API not supported for pronunciation analysis.");
            if (callback) callback(targetText, "Not supported");
            return;
        }

        await this.requestMicAccess();

        const pronRec = new SpeechRecognition();
        pronRec.continuous = false;
        pronRec.interimResults = true;
        pronRec.maxAlternatives = 1;

        let recLang = "ja-JP";
        if (targetText.match(/[a-zA-Z]/) && !targetText.match(/[\u3040-\u30ff\u4e00-\u9fff]/)) {
            recLang = "en-US";
        }
        const targetLangSelect = window.LingoApp ? window.LingoApp.targetLang : "jp 日本語";
        if (targetLangSelect.includes("Việt") || targetLangSelect.includes("vn")) {
            recLang = "vi-VN";
        }
        pronRec.lang = recLang;

        window.LingoLog.add(`Bắt đầu ghi âm Luyện phát âm [Lang: ${recLang}] cho câu: "${targetText}"`);

        let capturedText = "";
        let hasFinished = false;
        let pronSilenceTimer = null;

        const finishRecording = () => {
            if (!hasFinished) {
                hasFinished = true;
                if (pronSilenceTimer) clearTimeout(pronSilenceTimer);
                try { pronRec.stop(); } catch(e){}
                if (this.activeStream) {
                    try { this.activeStream.getTracks().forEach(track => track.stop()); } catch(e){}
                    this.activeStream = null;
                }
                window.LingoLog.add(`Thu âm phát âm hoàn tất: "${capturedText || targetText}"`);
                if (callback) callback(capturedText || targetText, null);
            }
        };

        const resetPronSilence = () => {
            if (pronSilenceTimer) clearTimeout(pronSilenceTimer);
            pronSilenceTimer = setTimeout(() => {
                window.LingoLog.add("⏱️ 発音練習: 無音が続いたためマイクを自動OFFにします。");
                finishRecording();
            }, 5000);
        };

        resetPronSilence();

        pronRec.onresult = (event) => {
            resetPronSilence();

            let resultText = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                resultText += event.results[i][0].transcript;
            }
            if (resultText) {
                capturedText = resultText;
            }
        };

        pronRec.onerror = (event) => {
            window.LingoLog.add(`Lỗi ghi âm phát âm: ${event.error}`);
            if (!hasFinished) {
                hasFinished = true;
                if (pronSilenceTimer) clearTimeout(pronSilenceTimer);
                if (callback) callback(capturedText || targetText, event.error);
            }
        };

        pronRec.onend = () => {
            if (!hasFinished) {
                hasFinished = true;
                if (pronSilenceTimer) clearTimeout(pronSilenceTimer);
                if (callback) callback(capturedText || targetText, null);
            }
        };

        try {
            pronRec.start();
        } catch (e) {
            window.LingoLog.add(`Lỗi khởi động thu âm phát âm: ${e.message}`);
            if (!hasFinished) {
                hasFinished = true;
                if (pronSilenceTimer) clearTimeout(pronSilenceTimer);
                if (callback) callback(targetText, e.message);
            }
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoSTT.init();
});
