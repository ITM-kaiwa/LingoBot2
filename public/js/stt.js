// Speech-To-Text (STT) Module - LingoBot2 Ver3.7 Implementation
window.LingoSTT = {
    recognition: null,
    isListening: false,

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.LingoLog.add("Trình duyệt không hỗ trợ Web SpeechRecognition API (Dùng fallback).");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isListening = true;
            const micBtn = document.getElementById("micBtn");
            if (micBtn) micBtn.classList.add("recording");
            window.LingoLog.add("Bắt đầu thu âm bằng Micro...");
        };

        this.recognition.onend = () => {
            this.isListening = false;
            const micBtn = document.getElementById("micBtn");
            if (micBtn) micBtn.classList.remove("recording");
            window.LingoLog.add("Dừng thu âm Micro.");
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            window.LingoLog.add(`Nhận diện giọng nói thành công: "${transcript}"`);
            const chatInput = document.getElementById("chatInput");
            if (chatInput) {
                chatInput.value = transcript;
                window.LingoApp.handleSendMessage();
            }
        };

        this.recognition.onerror = (event) => {
            this.isListening = false;
            const micBtn = document.getElementById("micBtn");
            if (micBtn) micBtn.classList.remove("recording");
            window.LingoLog.add(`Lỗi nhận diện giọng nói STT: ${event.error}`);
        };

        this.bindEvents();
    },

    bindEvents() {
        const micBtn = document.getElementById("micBtn");
        if (micBtn) {
            micBtn.addEventListener("click", () => this.toggleListening());
        }
    },

    toggleListening() {
        if (!this.recognition) {
            alert("Trình duyệt của bạn không hỗ trợ Web SpeechRecognition (Micro).\n(ご使用のブラウザはマイク音声認識に対応していません)");
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            const targetLang = window.LingoApp ? window.LingoApp.targetLang : "jp 日本語";
            if (targetLang.includes("日本語")) this.recognition.lang = "ja-JP";
            else if (targetLang.includes("English")) this.recognition.lang = "en-US";
            else this.recognition.lang = "vi-VN";

            try {
                this.recognition.start();
            } catch (e) {
                console.error("STT Start Error:", e);
            }
        }
    },

    /**
     * Dedicated Pronunciation Practice Voice Recording & Assessment (Ver3.7)
     */
    listenForPronunciation(targetText, callback) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            // Fallback if SpeechRecognition not supported in browser
            callback(null, "Browser does not support SpeechRecognition");
            return;
        }

        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;

        const targetLang = window.LingoApp ? window.LingoApp.targetLang : "jp 日本語";
        if (targetLang.includes("日本語")) rec.lang = "ja-JP";
        else if (targetLang.includes("English")) rec.lang = "en-US";
        else rec.lang = "vi-VN";

        rec.onresult = (event) => {
            const spokenText = event.results[0][0].transcript;
            callback(spokenText, null);
        };

        rec.onerror = (event) => {
            callback(null, event.error);
        };

        try {
            rec.start();
        } catch (e) {
            callback(null, e.message);
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoSTT.init();
});
