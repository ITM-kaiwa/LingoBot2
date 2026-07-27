// Web Speech STT Engine & Pronunciation Analyzer - LingoBot2 Ver4.6 Implementation
window.LingoSTT = {
    recognition: null,
    isListening: false,

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

        window.LingoLog.add("Khởi tạo Web Speech STT Engine (LingoBot2 Ver4.6) thành công.");
    },

    getRecognitionLang() {
        const targetLang = window.LingoApp ? window.LingoApp.targetLang : "jp 日本語";
        if (targetLang.includes("日本語") || targetLang.includes("jp")) return "ja-JP";
        if (targetLang.includes("English") || targetLang.includes("us")) return "en-US";
        if (targetLang.includes("Việt") || targetLang.includes("vn")) return "vi-VN";
        return "ja-JP";
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

        // Request microphone permission explicitly for mobile stability
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

        window.LingoLog.add(`Bắt đầu thu âm hội thoại [Language: ${this.recognition.lang}]...`);

        let finalTranscript = "";

        this.recognition.onresult = (event) => {
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

    // PRONUNCIATION ADVISOR STT ENGINE (Robust & Instant Speech Capture)
    async listenForPronunciation(targetText, callback) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.LingoLog.add("⚠️ Web Speech API not supported for pronunciation analysis.");
            if (callback) callback(targetText, "Not supported");
            return;
        }

        // Request microphone permission explicitly for mobile/desktop
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

        // Set recognition language based on sentence language
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

        pronRec.onresult = (event) => {
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
                if (callback) callback(capturedText || targetText, event.error);
            }
        };

        pronRec.onend = () => {
            if (!hasFinished) {
                hasFinished = true;
                window.LingoLog.add(`Thu âm phát âm xong: "${capturedText || targetText}"`);
                if (callback) callback(capturedText || targetText, null);
            }
        };

        // Auto timeout in 9 seconds if user stops speaking
        setTimeout(() => {
            if (!hasFinished) {
                hasFinished = true;
                try { pronRec.stop(); } catch(e){}
                if (callback) callback(capturedText || targetText, null);
            }
        }, 9000);

        try {
            pronRec.start();
        } catch (e) {
            window.LingoLog.add(`Lỗi khởi động thu âm phát âm: ${e.message}`);
            if (!hasFinished) {
                hasFinished = true;
                if (callback) callback(targetText, e.message);
            }
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoSTT.init();
});
