// Speech-To-Text (STT) Manager using Browser Web Speech API
window.LingoSTT = {
    recognition: null,
    isRecording: false,

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.LingoLog.add("Trình duyệt không hỗ trợ Web Speech API (STT).");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateMicUI(true);
            window.LingoLog.add("Đã bắt đầu ghi âm Micro (STT)...");
        };

        this.recognition.onresult = (event) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            const chatInput = document.getElementById("chatInput");
            if (chatInput) {
                chatInput.value = transcript;
            }
        };

        this.recognition.onerror = (event) => {
            window.LingoLog.add("Lỗi ghi âm STT: " + event.error);
            this.stop();
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            this.updateMicUI(false);
            window.LingoLog.add("Đã hoàn tất / dừng ghi âm Micro.");
        };
    },

    toggle() {
        if (!this.recognition) {
            alert("Trình duyệt không hỗ trợ chuyển giọng nói thành văn bản (Speech Recognition).");
            return;
        }

        if (this.isRecording) {
            this.stop();
        } else {
            this.start();
        }
    },

    start() {
        if (this.recognition && !this.isRecording) {
            const targetSelect = document.getElementById("targetLangSelect");
            const targetVal = targetSelect ? targetSelect.value : "us English";
            if (targetVal.includes("日本語")) this.recognition.lang = "ja-JP";
            else if (targetVal.includes("English")) this.recognition.lang = "en-US";
            else this.recognition.lang = "vi-VN";

            try {
                this.recognition.start();
            } catch (e) {
                window.LingoLog.add("Lỗi khởi chạy STT: " + e.message);
            }
        }
    },

    stop() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    },

    // Requirement 2: Mic icon symbol changes while speaking/recording
    updateMicUI(active) {
        const micBtn = document.getElementById("micBtn");
        const micIconSymbol = document.getElementById("micIconSymbol");

        if (micBtn) {
            if (active) {
                micBtn.classList.add("recording");
                if (micIconSymbol) micIconSymbol.textContent = "🔴"; // Changes to recording red dot
                micBtn.title = "Đang lắng nghe giọng nói của bạn... Nhấn để dừng";
            } else {
                micBtn.classList.remove("recording");
                if (micIconSymbol) micIconSymbol.textContent = "🎙️"; // Restores to microphone icon
                micBtn.title = "Nói bằng Micro";
            }
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoSTT.init();
    const micBtn = document.getElementById("micBtn");
    if (micBtn) {
        micBtn.addEventListener("click", () => window.LingoSTT.toggle());
    }
});
