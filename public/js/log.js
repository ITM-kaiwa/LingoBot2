// System Logger Module - LingoBot2 Ver2.1 Implementation
window.LingoLog = {
    logs: [],
    
    init() {
        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.logs.push(`[${timeStr}] Khởi tạo hệ thống LingoBotWebApp thành công [Render Platform & EdgeTTS].`);
        this.render();
    },

    add(msg) {
        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const logLine = `[${timeStr}] ${msg}`;
        this.logs.push(logLine);
        console.log(`%c[LingoLog]`, "color: #ea580c; font-weight: bold;", logLine);
        this.render();
    },

    getClientDiagnostics() {
        const ua = navigator.userAgent;
        const platform = navigator.platform || "Unknown";
        const language = navigator.language || "Unknown";
        const languages = navigator.languages ? navigator.languages.join(", ") : language;
        const screenRes = `${window.screen.width}x${window.screen.height} (Color: ${window.screen.colorDepth}-bit)`;
        const viewportSize = `${window.innerWidth}x${window.innerHeight}`;
        const hardwareCores = navigator.hardwareConcurrency || "Unknown";
        const memory = navigator.deviceMemory ? `~${navigator.deviceMemory} GB` : "Unknown";
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const networkType = connection ? `${connection.effectiveType || ''} (${connection.saveData ? 'SaveData On' : 'Standard Network'})` : "Online";

        return `==================================================
🖥️ CLIENT SYSTEM & BROWSER DIAGNOSTICS:
- User-Agent: ${ua}
- Platform / OS: ${platform}
- Browser Language: ${language} (Preferred: ${languages})
- Screen Resolution: ${screenRes}
- Viewport Size: ${viewportSize}
- Hardware: ${hardwareCores} Cores | Memory: ${memory}
- Network Status: ${networkType}
- Timezone: ${timeZone}
- App Version: LingoBot2 Ver2.1 (Render & EdgeTTS)
==================================================`;
    },

    render() {
        const consoleEl = document.getElementById("logOutput");
        if (consoleEl) {
            const diagHeader = this.getClientDiagnostics();
            consoleEl.textContent = diagHeader + "\n" + this.logs.join("\n");
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    },

    openModal() {
        const modal = document.getElementById("logModal");
        if (modal) {
            modal.classList.remove("hidden");
            this.render();
            this.add("Đã mở Cửa sổ Nhật ký hệ thống (System Logs Modal).");
        }
    },

    closeModal() {
        const modal = document.getElementById("logModal");
        if (modal) {
            modal.classList.add("hidden");
        }
    },

    copy() {
        const consoleEl = document.getElementById("logOutput");
        const fullLogs = consoleEl ? consoleEl.textContent : this.getClientDiagnostics() + "\n" + this.logs.join("\n");
        
        navigator.clipboard.writeText(fullLogs).then(() => {
            alert("Đã sao chép toàn bộ Nhật ký hệ thống & Thông tin cấu hình máy vào Khay nhớ tạm (Clipboard)!\n(システムログとPC診断情報をクリップボードにコピーしました)");
        }).catch(err => {
            alert("Lỗi khi sao chép log: " + err.message);
        });
    },

    download() {
        const consoleEl = document.getElementById("logOutput");
        const fullLogs = consoleEl ? consoleEl.textContent : this.getClientDiagnostics() + "\n" + this.logs.join("\n");
        
        const blob = new Blob([fullLogs], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `lingobot_system_logs_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.add("Đã tải xuống tệp Nhật ký hệ thống (.txt).");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoLog.init();
});
