// Web Speech STT Engine & Pronunciation Analyzer - LingoBot2 Ver4.7 Implementation
window.LingoSTT = {
    recognition: null,
    isListening: false,
    silenceTimer: null,

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.LingoLog.add("⚠️ Trình duyệt không hỗ trợ Web Speech API (SpeechRecognition).");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        const micBtn = document.getElementById("micBtn");
        if (micBtn) {
            micBtn.addEventListener("click", () => this.toggleListening());
        }

        window.LingoLog.add("Khởi tạo Web Speech STT Engine (LingoBot2 Ver4.7 - 3s Silence Auto-OFF) thành công.");
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
        // 3 SECONDS SILENCE AUTO-OFF TIMER
        this.silenceTimer = setTimeout(() => {
            window.LingoLog.add("⏱️ 無音が3秒間続いたため、自動的にマイクをOFFにしました。 (3s Silence Auto-OFF triggered)");
            if (onSilenceCallback) onSilenceCallback();
        }, 3000);
    },

    toggleListening() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    },

    async start() {
        if (!this.recognition) this.init();
        if (!this.recognition) {
            alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng dùng Google Chrome!");
            return;
        }

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            }
        } catch (err) {
            console.warn("Microphone access check:", err);
        }

        const micBtn = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");

        this.recognition.lang = this.getRecognitionLang();
        this.isListening = true;

        if (micBtn) {
            micBtn.classList.add("recording");
            micBtn.style.background = "#ef4444";
            micBtn.style.color = "#ffffff";
        }

        window.LingoLog.add(`Bắt đầu thu âm hội thoại [Language: ${this.recognition.lang}]... (3s Silence Auto-OFF active)`);

        let finalTranscript = "";

        // Reset 3s silence timer when starting
        this.resetSilenceTimer(() => this.stop());

        this.recognition.onresult = (event) => {
            // Reset silence timer on every spoken result
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
            window.LingoLog.add(`Lỗi nhận diện giọng nói: ${event.error}`);
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
        const micBtn = document.getElementById("micBtn");
        if (micBtn) {
            micBtn.classList.remove("recording");
            micBtn.style.background = "#fff7ed";
            micBtn.style.color = "#ea580c";
        }
        if (this.recognition) {
            try { this.recognition.stop(); } catch(e){}
        }
    },

    // PRONUNCIATION ADVISOR STT ENGINE (With 3s Silence Auto-OFF & Status Updates)
    async listenForPronunciation(targetText, callback) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.LingoLog.add("⚠️ Web Speech API not supported for pronunciation analysis.");
            if (callback) callback(targetText, "Not supported");
            return;
        }

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            }
        } catch (err) {
            console.warn("Microphone access check:", err);
        }

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

        window.LingoLog.add(`Bắt đầu ghi âm Luyện phát âm [Lang: ${recLang}] cho câu: "${targetText}" (3s Silence Auto-OFF active)`);

        let capturedText = "";
        let hasFinished = false;
        let pronSilenceTimer = null;

        const finishRecording = () => {
            if (!hasFinished) {
                hasFinished = true;
                if (pronSilenceTimer) clearTimeout(pronSilenceTimer);
                try { pronRec.stop(); } catch(e){}
                window.LingoLog.add(`Thu âm phát âm hoàn tất (Tự động ngắt khi hết tiếng 3s): "${capturedText || targetText}"`);
                if (callback) callback(capturedText || targetText, null);
            }
        };

        const resetPronSilence = () => {
            if (pronSilenceTimer) clearTimeout(pronSilenceTimer);
            pronSilenceTimer = setTimeout(() => {
                window.LingoLog.add("⏱️ 発音練習: 無音が3秒間続いたためマイクを自動OFFにします。 (3s Silence Auto-OFF)");
                finishRecording();
            }, 3000);
        };

        // Start 3s silence timer when recording starts
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
