// System Execution & Environment Diagnostic Logger - LingoBot2 Ver1.30 Implementation
window.LingoLog = {
    logs: [],

    init() {
        this.captureSystemDiagnostics();
        this.add("Khởi tạo hệ thống LingoBotWebApp thành công.");
    },

    captureSystemDiagnostics() {
        try {
            const ua = navigator.userAgent || "Unknown UA";
            const platform = navigator.platform || "Unknown Platform";
            const lang = navigator.language || "Unknown Lang";
            const languages = (navigator.languages || [lang]).join(", ");
            const screenRes = `${window.screen.width}x${window.screen.height} (Color: ${window.screen.colorDepth}-bit)`;
            const viewportSize = `${window.innerWidth}x${window.innerHeight}`;
            const isOnline = navigator.onLine ? "Online" : "Offline";
            const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : "Unknown Cores";
            const memory = navigator.deviceMemory ? `~${navigator.deviceMemory} GB` : "Unknown Memory";
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown TZ";

            let connectionInfo = "Standard Network";
            if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
                const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                connectionInfo = `Type: ${conn.effectiveType || "N/A"}, RTT: ${conn.rtt || "N/A"}ms, Downlink: ${conn.downlink || "N/A"}Mbps`;
            }

            const sysInfoBlock = [
                "==================================================",
                "🖥️ CLIENT SYSTEM & BROWSER DIAGNOSTICS:",
                `- User-Agent: ${ua}`,
                `- Platform / OS: ${platform}`,
                `- Browser Language: ${lang} (Preferred: ${languages})`,
                `- Screen Resolution: ${screenRes}`,
                `- Viewport Size: ${viewportSize}`,
                `- Hardware: ${cores} | Memory: ${memory}`,
                `- Network Status: ${isOnline} (${connectionInfo})`,
                `- Timezone: ${tz}`,
                "=================================================="
            ].join("\n");

            this.logs.push(sysInfoBlock);
        } catch (e) {
            console.error("Error capturing system diagnostics:", e);
        }
    },

    add(message) {
        const timestamp = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        const logLine = `[${timestamp}] ${message}`;
        this.logs.push(logLine);
        console.log(logLine);

        const logOutput = document.getElementById("logOutput");
        if (logOutput) {
            logOutput.textContent = this.logs.join("\n");
            logOutput.scrollTop = logOutput.scrollHeight;
        }
    },

    openModal() {
        const modal = document.getElementById("logModal");
        const logOutput = document.getElementById("logOutput");
        if (logOutput) {
            logOutput.textContent = this.logs.join("\n");
            logOutput.scrollTop = logOutput.scrollHeight;
        }
        if (modal) {
            modal.classList.remove("hidden");
            this.add("Đã mở Cửa sổ Nhật ký hệ thống (System Logs Modal).");
        }
    },

    closeModal() {
        const modal = document.getElementById("logModal");
        if (modal) modal.classList.add("hidden");
    },

    copy() {
        const text = this.logs.join("\n");
        navigator.clipboard.writeText(text).then(() => {
            alert("Đã sao chép toàn bộ Nhật ký hệ thống vào bộ nhớ tạm! / システムログをクリップボードにコピーしました！");
        }).catch(err => {
            alert("Lỗi sao chép log: " + err);
        });
    },

    download() {
        const text = this.logs.join("\n");
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `LingoBot2_System_Log_${new Date().toISOString().slice(0,10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoLog.init();
});
