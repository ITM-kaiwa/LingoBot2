// Lesson Summary & Advice Report Generator Module - LingoBot2 Ver4.6 Implementation
window.LingoSummary = {
    currentReportMarkdown: "",

    async generateReport(messages, uiLang, targetLang, level) {
        this.openSummaryModal();
        const loader = document.getElementById("summaryLoader");
        const textContainer = document.getElementById("summaryTextContainer");

        if (loader) loader.style.display = "flex";
        if (textContainer) textContainer.innerHTML = "";

        window.LingoLog.add("Gửi yêu cầu tổng hợp Báo cáo bài học tới API /api/summary...");

        try {
            const reqPayload = {
                messages: messages,
                ui_lang: uiLang,
                target_lang: targetLang,
                level: level
            };

            const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";
            if (apiKey && apiKey.length > 5) reqPayload.api_key = apiKey;

            const response = await fetch("/api/summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqPayload)
            });

            const data = await response.json();
            if (loader) loader.style.display = "none";

            if (data.summary) {
                this.currentReportMarkdown = data.summary;
                const htmlContent = this.markdownToHtml(data.summary);
                if (textContainer) textContainer.innerHTML = htmlContent;
                window.LingoLog.add(`Tổng hợp Báo cáo bài học thành công [Model: ${data.used_model || 'Local'}]`);
            } else {
                const fallbackHtml = this.getFallbackSummaryHtml(uiLang, targetLang, level);
                if (textContainer) textContainer.innerHTML = fallbackHtml;
                window.LingoLog.add("Dùng Báo cáo bài học chuẩn dự phòng.");
            }
        } catch (err) {
            if (loader) loader.style.display = "none";
            const fallbackHtml = this.getFallbackSummaryHtml(uiLang, targetLang, level);
            if (textContainer) textContainer.innerHTML = fallbackHtml;
            window.LingoLog.add("Lỗi kết nối summary API -> Dùng Báo cáo bài học chuẩn dự phòng.");
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

    markdownToHtml(mdText) {
        if (!mdText) return "";
        let html = mdText
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n/gim, '<br><br>')
            .replace(/\n/gim, '<br>');

        return html;
    },

    getFallbackSummaryHtml(uiLang, targetLang, level) {
        if (uiLang === "tiếng Nhật") {
            return `<h1>📊 レッスン総括レポート＆アドバイス</h1>
<h2>1. レッスン概要</h2>
<ul>
  <li><strong>学習言語</strong>: ${targetLang}</li>
  <li><strong>レベル</strong>: ${level}</li>
  <li><strong>状態</strong>: レッスンが正常に完了しました！素晴らしい積極性で会話を継続できました。</li>
</ul>
<h2>2. 良かった点</h2>
<ul>
  <li>状況に応じた自然な受け答えができており、フレーズの活用がスムーズです。</li>
  <li>対話を積極的に維持しようとする素晴らしい姿勢が見られます。</li>
</ul>
<h2>3. 今後に向けたアドバイス</h2>
<ul>
  <li>新しい語彙や表現を積極的に取り入れ、表現の幅を広げましょう。</li>
  <li>発音練習モードを活用して、シャドーイングを繰り返し行いましょう。</li>
</ul>`;
        } else if (uiLang === "tiếng Anh") {
            return `<h1>📊 Lesson Summary & Advice Report</h1>
<h2>1. Overview</h2>
<ul>
  <li><strong>Target Language</strong>: ${targetLang}</li>
  <li><strong>Level</strong>: ${level}</li>
  <li><strong>Status</strong>: Lesson completed successfully with great active engagement!</li>
</ul>
<h2>2. Strengths</h2>
<ul>
  <li>Natural responses appropriate for the selected scenario.</li>
  <li>Strong willingness to communicate and maintain dialogue flow.</li>
</ul>
<h2>3. Key Improvements & Advice</h2>
<ul>
  <li>Keep expanding your active vocabulary and refined grammar patterns.</li>
  <li>Practice regularly in Pronunciation mode using shadowing techniques.</li>
</ul>`;
        } else {
            return `<h1>📊 Báo cáo & Lời khuyên tổng kết bài học</h1>
<h2>1. Tổng quan buổi học</h2>
<ul>
  <li><strong>Ngôn ngữ học</strong>: ${targetLang}</li>
  <li><strong>Trình độ</strong>: ${level}</li>
  <li><strong>Trạng thái</strong>: Bài học đã hoàn thành xuất sắc! Người học phản xạ nhanh và chủ động giao tiếp.</li>
</ul>
<h2>2. Điểm mạnh</h2>
<ul>
  <li>Phản xạ giao tiếp tự nhiên, nắm bắt ngữ cảnh tốt.</li>
  <li>Sử dụng đúng cấu trúc câu cơ bản và từ vựng chủ đề.</li>
</ul>
<h2>3. Lời khuyên nâng cao trình độ</h2>
<ul>
  <li>Tiếp tục mở rộng vốn từ vựng chuyên sâu và chú ý nối âm.</li>
  <li>Luyện tập phát âm thường xuyên qua tính năng Luyện Phát Âm.</li>
</ul>`;
        }
    },

    printReport() {
        const reportEl = document.getElementById("summaryReportContent");
        if (!reportEl) return;
        const win = window.open('', '', 'height=700,width=900');
        win.document.write('<html><head><title>Báo cáo bài học - LingoBot2</title>');
        win.document.write('<style>body{font-family:sans-serif; padding:20px; color:#1c1917;} h1{color:#ea580c;} h2{color:#0284c7; border-bottom:1px solid #ddd; padding-bottom:4px;}</style>');
        win.document.write('</head><body>');
        win.document.write(reportEl.innerHTML);
        win.document.write('</body></html>');
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
        window.LingoLog.add("In Báo cáo tổng kết bài học.");
    },

    downloadPDF() {
        const reportEl = document.getElementById("summaryReportContent");
        if (!reportEl) return;
        if (typeof html2pdf !== 'undefined') {
            const opt = {
                margin:       10,
                filename:     `lingobot_summary_${Date.now()}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(reportEl).save();
            window.LingoLog.add("Tải xuống PDF Báo cáo bài học.");
        } else {
            alert("Thư viện html2pdf chưa tải xong, vui lòng thử lại sau giây lát.");
        }
    }
};
