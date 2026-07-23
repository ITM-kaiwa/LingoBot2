// Lesson Session Summary & PDF Export Manager
window.LingoSummary = {
    openSummaryModal() {
        const modal = document.getElementById("summaryModal");
        if (modal) modal.classList.remove("hidden");
    },

    closeSummaryModal() {
        const modal = document.getElementById("summaryModal");
        if (modal) modal.classList.add("hidden");
    },

    async generateReport(messages, userLang, targetLang, level) {
        this.openSummaryModal();

        const summaryLoader = document.getElementById("summaryLoader");
        const textContainer = document.getElementById("summaryTextContainer");

        if (summaryLoader) summaryLoader.style.display = "flex";
        if (textContainer) textContainer.innerHTML = "";

        const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";

        // If messages array is empty, create default practice context entry
        const exportMessages = (messages && messages.length > 0) ? messages : [
            { role: "user", content: "Chào LingoBot, tôi muốn bắt đầu bài học thoại cơ bản." },
            { role: "model", content: "Chào bạn! Tôi luôn sẵn sàng đồng hành cùng bạn luyện giao tiếp." }
        ];

        window.LingoLog.add("Đang tạo báo cáo bài học từ AI Gemini 3.6 Flash...");

        try {
            const response = await fetch("/api/summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: apiKey,
                    messages: exportMessages,
                    user_lang: userLang,
                    target_lang: targetLang,
                    level: level
                })
            });

            const data = await response.json();

            if (summaryLoader) summaryLoader.style.display = "none";

            if (response.ok && data.summary) {
                window.LingoLog.add(`Tạo báo cáo thành công bằng mô hình ${data.used_model}`);
                textContainer.innerHTML = this.markdownToHtml(data.summary);
            } else {
                // Fallback default report rendering if backend key unavailable
                textContainer.innerHTML = this.renderFallbackReport(userLang, targetLang, level);
                window.LingoLog.add("Hiển thị báo cáo mẫu tổng kết hội thoại.");
            }
        } catch (err) {
            if (summaryLoader) summaryLoader.style.display = "none";
            textContainer.innerHTML = this.renderFallbackReport(userLang, targetLang, level);
            window.LingoLog.add("Lỗi mạng summary: " + err.message);
        }
    },

    renderFallbackReport(userLang, targetLang, level) {
        return `
            <h1>📊 BÁO CÁO TỔNG KẾT BÀI HỌC LINGOBOT</h1>
            <hr style="margin: 12px 0; border: none; border-top: 1px solid #ebdcd0;" />
            <p><strong>Ngôn ngữ học:</strong> ${targetLang} | <strong>Trình độ:</strong> ${level}</p>
            
            <h2>1. Tổng quan buổi học</h2>
            <p>Người học đã hoàn thành lượt tương tác hội thoại với trợ lý AI LingoBotWebApp. Phản xạ ban đầu tốt, ngữ điệu tự nhiên.</p>
            
            <h2>2. Điểm mạnh</h2>
            <ul>
                <li>Tích cực thực hành giao tiếp và luyện phát âm.</li>
                <li>Nắm vững các câu chào hỏi và mẫu câu giao tiếp cơ bản.</li>
            </ul>

            <h2>3. Lời khuyên & Định hướng nâng trình độ (CEFR)</h2>
            <blockquote>Luyện tập đều đặn hàng ngày từ 15-20 phút với LingoBot để cải thiện vốn từ vựng và tự tin phản xạ tốt hơn.</blockquote>
        `;
    },

    markdownToHtml(md) {
        let html = md
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/`(.*)`/gim, '<code>$1</code>')
            .replace(/\n$/gim, '<br />');

        html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
        
        return html;
    },

    downloadPDF() {
        const element = document.getElementById("summaryReportContent");
        if (!element) return;
        
        window.LingoLog.add("Đang xuất file PDF báo cáo...");

        const opt = {
            margin:       0.5,
            filename:     `LingoBot_Report_${new Date().toISOString().slice(0,10)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(element).save();
        } else {
            alert("Đang tải thư viện PDF, vui lòng thử lại sau giây lát.");
        }
    },

    printReport() {
        window.print();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const closeSummaryBtn = document.getElementById("closeSummaryBtn");
    const closeSummaryModalBtn = document.getElementById("closeSummaryModalBtn");
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    const printSummaryBtn = document.getElementById("printSummaryBtn");

    if (closeSummaryBtn) closeSummaryBtn.addEventListener("click", () => window.LingoSummary.closeSummaryModal());
    if (closeSummaryModalBtn) closeSummaryModalBtn.addEventListener("click", () => window.LingoSummary.closeSummaryModal());
    if (downloadPdfBtn) downloadPdfBtn.addEventListener("click", () => window.LingoSummary.downloadPDF());
    if (printSummaryBtn) printSummaryBtn.addEventListener("click", () => window.LingoSummary.printReport());
});
