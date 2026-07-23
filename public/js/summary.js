// Lesson Summary Controller - LingoBot2 Ver1.25 Implementation
window.LingoSummary = {
    currentSummaryMarkdown: "",

    async generateReport(messages, uiLang, targetLang, level) {
        this.openSummaryModal();
        
        const loader = document.getElementById("summaryLoader");
        const container = document.getElementById("summaryTextContainer");
        
        if (loader) loader.classList.remove("hidden");
        if (container) container.innerHTML = "";

        window.LingoLog.add(`Đang tạo báo cáo bài học bằng ngôn ngữ UI: ${uiLang}...`);

        const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";

        try {
            const res = await fetch("/api/summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: apiKey,
                    messages: messages || [],
                    ui_lang: uiLang || "tiếng Nhật",
                    user_lang: uiLang || "tiếng Nhật",
                    target_lang: targetLang || "jp 日本語",
                    level: level || "Sơ cấp"
                })
            });

            const data = await res.json();
            
            if (loader) loader.classList.add("hidden");

            if (data.summary) {
                this.currentSummaryMarkdown = data.summary;
                const htmlContent = this.markdownToHtml(data.summary);
                if (container) container.innerHTML = htmlContent;
                window.LingoLog.add(`Tạo báo cáo thành công bằng mô hình: ${data.used_model || "Local"}`);
            } else {
                const err = data.error || "Không thể tạo báo cáo tổng kết.";
                if (container) container.innerHTML = `<p style="color:red; font-weight:bold;">Lỗi: ${err}</p>`;
                window.LingoLog.add("Lỗi tạo báo cáo: " + err);
            }
        } catch (e) {
            if (loader) loader.classList.add("hidden");
            if (container) container.innerHTML = `<p style="color:red; font-weight:bold;">Lỗi kết nối máy chủ: ${e.message}</p>`;
            window.LingoLog.add("Lỗi kết nối khi tạo báo cáo: " + e.message);
        }
    },

    openSummaryModal() {
        const modal = document.getElementById("summaryModal");
        if (modal) modal.classList.remove("hidden");
    },

    closeSummaryModal() {
        const modal = document.getElementById("summaryModal");
        if (modal) modal.classList.add("hidden");
    },

    printReport() {
        window.print();
    },

    downloadPDF() {
        const element = document.getElementById("summaryReportContent");
        if (!element) return;
        
        const opt = {
            margin:       0.5,
            filename:     `LingoBot2_Lesson_Report_${new Date().toISOString().slice(0,10)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        if (window.html2pdf) {
            window.html2pdf().set(opt).from(element).save();
        } else {
            alert("Thư viện PDF đang tải, vui lòng thử lại sau giây lát.");
        }
    },

    markdownToHtml(mdText) {
        if (!mdText) return "";
        let html = mdText
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/^\- (.*$)/gim, '<li>$1</li>');

        html = html.replace(/(<li>.*<\/li>)/gims, '<ul>$1<\/ul>');
        return html.replace(/\n/g, '<br>');
    }
};
