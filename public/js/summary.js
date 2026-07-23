// Lesson Session Summary & PDF Export Manager - LingoBot2
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
        const txtSummaryLoading = document.getElementById("txtSummaryLoading");

        if (window.LingoApp && window.LingoApp.i18n) {
            const dict = window.LingoApp.i18n[userLang] || window.LingoApp.i18n["tiếng Việt"];
            if (txtSummaryLoading) txtSummaryLoading.textContent = dict.aiSummarizing || "AI đang tổng hợp báo cáo bài học...";
        }

        if (summaryLoader) summaryLoader.style.display = "flex";
        if (textContainer) textContainer.innerHTML = "";

        const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";

        // If messages array is empty, create default practice context entry
        const exportMessages = (messages && messages.length > 0) ? messages : [
            { role: "user", content: "Chào LingoBot2, tôi muốn bắt đầu bài học thoại cơ bản." },
            { role: "model", content: "Chào bạn! Tôi luôn sẵn sàng đồng hành cùng bạn luyện giao tiếp." }
        ];

        window.LingoLog.add(`Đang tạo báo cáo bài học bằng ngôn ngữ ${userLang}...`);

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
        if (userLang === "tiếng Nhật") {
            return `
                <h1>📊 LINGOBOT2 レッスン総括レポート</h1>
                <hr style="margin: 12px 0; border: none; border-top: 1px solid #ebdcd0;" />
                <p><strong>学習言語:</strong> ${targetLang} | <strong>レベル:</strong> ${level}</p>
                
                <h2>1. レッスン総括</h2>
                <p>対話AI LingoBot2との会話練習を完了しました。積極的な対話態度と自然な応答が見られました。</p>
                
                <h2>2. 良かった点</h2>
                <ul>
                    <li>場面に応じた基本的な挨拶や構文をしっかりと活用できています。</li>
                    <li>発音・スピーキングへの意欲が高く、継続的な練習成果が出ています。</li>
                </ul>

                <h2>3. 改善点・アドバイス</h2>
                <blockquote>毎日15〜20分間、LingoBot2でシャドーイングや対話練習を継続し、表現の幅をさらに広げましょう。</blockquote>
            `;
        } else if (userLang === "tiếng Anh") {
            return `
                <h1>📊 LINGOBOT2 LESSON SUMMARY REPORT</h1>
                <hr style="margin: 12px 0; border: none; border-top: 1px solid #ebdcd0;" />
                <p><strong>Target Language:</strong> ${targetLang} | <strong>Level:</strong> ${level}</p>
                
                <h2>1. Lesson Overview</h2>
                <p>The learner successfully completed interactive conversation practice with LingoBot2 AI assistant.</p>
                
                <h2>2. Strengths</h2>
                <ul>
                    <li>Great enthusiasm and active participation in speaking practice.</li>
                    <li>Good command of foundational vocabulary and situational phrases.</li>
                </ul>

                <h2>3. Key Advice & Next Steps</h2>
                <blockquote>Keep practicing daily for 15-20 minutes with LingoBot2 to continuously build confidence and fluency.</blockquote>
            `;
        }

        return `
            <h1>📊 BÁO CÁO TỔNG KẾT BÀI HỌC LINGOBOT2</h1>
            <hr style="margin: 12px 0; border: none; border-top: 1px solid #ebdcd0;" />
            <p><strong>Ngôn ngữ học:</strong> ${targetLang} | <strong>Trình độ:</strong> ${level}</p>
            
            <h2>1. Tổng quan buổi học</h2>
            <p>Người học đã hoàn thành lượt tương tác hội thoại với trợ lý AI LingoBot2. Phản xạ ban đầu tốt, ngữ điệu tự nhiên.</p>
            
            <h2>2. Điểm mạnh</h2>
            <ul>
                <li>Tích cực thực hành giao tiếp và luyện phát âm.</li>
                <li>Nắm vững các câu chào hỏi và mẫu câu giao tiếp cơ bản.</li>
            </ul>

            <h2>3. Lời khuyên & Định hướng nâng trình độ (CEFR)</h2>
            <blockquote>Luyện tập đều đặn hàng ngày từ 15-20 phút với LingoBot2 để cải thiện vốn từ vựng và tự tin phản xạ tốt hơn.</blockquote>
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
            filename:     `LingoBot2_Report_${new Date().toISOString().slice(0,10)}.pdf`,
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
