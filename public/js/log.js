// System Log Manager - Records execution events, fallback models, TTS status
window.LingoLog = {
    logs: [],
    
    init() {
        this.logOutput = document.getElementById("logOutput");
        this.add("Khởi tạo hệ thống LingoBotWebApp thành công.");
    },

    add(msg, data = null) {
        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        let logLine = `[${timeStr}] ${msg}`;
        if (data) {
            logLine += ` | Details: ${typeof data === 'object' ? JSON.stringify(data) : data}`;
        }
        this.logs.push(logLine);
        console.log(logLine);
        this.render();
    },

    render() {
        if (this.logOutput) {
            this.logOutput.textContent = this.logs.join("\n");
            this.logOutput.scrollTop = this.logOutput.scrollHeight;
        }
    },

    openModal() {
        const logModal = document.getElementById("logModal");
        if (logModal) {
            logModal.classList.remove("hidden");
            this.add("Đã mở Cửa sổ Nhật ký hệ thống (System Logs Modal).");
        }
    },

    closeModal() {
        const logModal = document.getElementById("logModal");
        if (logModal) {
            logModal.classList.add("hidden");
        }
    },

    copy() {
        navigator.clipboard.writeText(this.logs.join("\n"))
            .then(() => alert("Đã sao chép toàn bộ nhật ký vào Clipboard!"))
            .catch(err => alert("Không thể sao chép: " + err));
    },

    download() {
        const blob = new Blob([this.logs.join("\n")], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `LingoBot_Log_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoLog.init();
    
    const robotLogBtn = document.getElementById("robotLogBtn");
    const openLogBtn = document.getElementById("openLogBtn");
    const closeLogBtn = document.getElementById("closeLogBtn");
    const closeLogModalBtn = document.getElementById("closeLogModalBtn");
    const copyLogBtn = document.getElementById("copyLogBtn");
    const downloadLogBtn = document.getElementById("downloadLogBtn");

    if (robotLogBtn) robotLogBtn.addEventListener("click", () => window.LingoLog.openModal());
    if (openLogBtn) openLogBtn.addEventListener("click", () => window.LingoLog.openModal());
    if (closeLogBtn) closeLogBtn.addEventListener("click", () => window.LingoLog.closeModal());
    if (closeLogModalBtn) closeLogModalBtn.addEventListener("click", () => window.LingoLog.closeModal());
    if (copyLogBtn) copyLogBtn.addEventListener("click", () => window.LingoLog.copy());
    if (downloadLogBtn) downloadLogBtn.addEventListener("click", () => window.LingoLog.download());
});
