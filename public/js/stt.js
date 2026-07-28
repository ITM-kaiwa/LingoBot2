// Web Speech STT Engine - LingoBot2 Ver6.2β
// ARCHITECTURE CHANGE: Web Speech API (Google STT servers - unreachable from Vietnam)
//   → MediaRecorder (browser built-in) + /api/stt (Gemini multimodal transcription)
// This eliminates the "network" error caused by Chrome's dependence on Google STT servers.
//
// MODES:
//   STANDBY  : Ambient VU meter (getUserMedia → AudioContext → real volume display)
//   RECORDING: Same getUserMedia stream → MediaRecorder + AudioContext for real VU level
//   TRANSCRIBE: After stop, POST audio blob to /api/stt, display result in chat input
window.LingoSTT = {
    // Recording state
    isListening:   false,
    mediaRecorder: null,
    audioChunks:   [],
    micStream:     null,      // shared stream for VU + MediaRecorder

    // Ambient VU (standby, separate stream)
    ambientStream:   null,
    ambientContext:  null,
    ambientAnalyser: null,
    ambientInterval: null,

    // Recording VU (same stream as MediaRecorder)
    recContext:  null,
    recAnalyser: null,
    recInterval: null,

    // Silence detection
    silenceTimer:     null,
    SILENCE_MS:       3000,   // 3秒無音で自動停止
    MAX_RECORD_MS:    30000,  // 最大30秒録音
    maxTimer:         null,

    // =============================================
    // 初期化
    // =============================================
    init() {
        const micBtn = document.getElementById("micBtn");
        if (micBtn) micBtn.addEventListener("click", () => this.toggleListening());

        // ページ読み込み時に ambient VU 開始 (マイク権限確認も兼ねる)
        setTimeout(() => this.startAmbientVU(), 600);

        window.LingoLog?.add("Khởi tạo STT Engine (LingoBot2 Ver6.2β - MediaRecorder + Gemini STT) thành công.");
    },

    // =============================================
    // 言語設定
    // =============================================
    getRecognitionLang() {
        const t = window.LingoApp?.targetLang ?? "jp 日本語";
        if (t.includes("日本語") || t.includes("jp")) return "ja-JP";
        if (t.includes("English") || t.includes("us")) return "en-US";
        if (t.includes("Việt") || t.includes("vn"))    return "vi-VN";
        return "ja-JP";
    },

    // =============================================
    // API Key 取得
    // =============================================
    getApiKey() {
        return window.LingoApp?.apiKey || "";
    },

    // =============================================
    // VU バー更新
    // =============================================
    setVULevel(pct) {
        const bar = document.getElementById("vuMeterBar");
        if (!bar) return;
        const v = Math.min(100, Math.max(0, pct));
        bar.style.width = `${v}%`;
        if (v > 60)      bar.style.background = "linear-gradient(90deg,#f97316,#ef4444)";
        else if (v > 20) bar.style.background = "linear-gradient(90deg,#22c55e,#f97316)";
        else             bar.style.background = "linear-gradient(90deg,#3b82f6,#22c55e)";
    },

    setVUStatus(label, labelColor, status, statusColor) {
        const l = document.getElementById("vuMeterLabel");
        const s = document.getElementById("vuMeterStatus");
        if (l) { l.textContent = label;  l.style.color  = labelColor  || "#94a3b8"; }
        if (s) { s.textContent = status; s.style.color  = statusColor || "#cbd5e1"; }
    },

    // =============================================
    // Ambient VU (スタンバイ時) — getUserMedia 使用
    // =============================================
    async startAmbientVU() {
        this.stopAmbientVU();
        try {
            this.ambientStream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.ambientContext  = new (window.AudioContext || window.webkitAudioContext)();
            this.ambientAnalyser = this.ambientContext.createAnalyser();
            this.ambientAnalyser.fftSize = 256;
            const src = this.ambientContext.createMediaStreamSource(this.ambientStream);
            src.connect(this.ambientAnalyser);

            const data = new Uint8Array(this.ambientAnalyser.frequencyBinCount);
            this.setVUStatus("🎙️ MIC", "#22c55e", "スタンバイ中", "#94a3b8");

            this.ambientInterval = setInterval(() => {
                if (this.isListening) return;
                this.ambientAnalyser.getByteFrequencyData(data);
                const avg   = data.reduce((a, b) => a + b, 0) / data.length;
                const level = Math.min(100, Math.round(avg * 2.5));
                this.setVULevel(level);
            }, 80);
        } catch (e) {
            // 未許可でも静かに失敗
            this.setVUStatus("🎙️ MIC", "#94a3b8", "スタンバイ中", "#cbd5e1");
        }
    },

    stopAmbientVU() {
        if (this.ambientInterval) { clearInterval(this.ambientInterval); this.ambientInterval = null; }
        if (this.ambientAnalyser) { try { this.ambientAnalyser.disconnect(); } catch(e){} this.ambientAnalyser = null; }
        if (this.ambientContext)  { try { this.ambientContext.close();      } catch(e){} this.ambientContext  = null; }
        if (this.ambientStream)   { this.ambientStream.getTracks().forEach(t => t.stop()); this.ambientStream = null; }
    },

    // =============================================
    // 録音時 VU (MediaRecorder と同ストリーム)
    // =============================================
    startRecordingVU(stream) {
        this.stopRecordingVU();
        try {
            this.recContext  = new (window.AudioContext || window.webkitAudioContext)();
            this.recAnalyser = this.recContext.createAnalyser();
            this.recAnalyser.fftSize = 256;
            const src = this.recContext.createMediaStreamSource(stream);
            src.connect(this.recAnalyser);

            const data       = new Uint8Array(this.recAnalyser.frequencyBinCount);
            let silentFrames = 0;

            this.recInterval = setInterval(() => {
                this.recAnalyser.getByteFrequencyData(data);
                const avg   = data.reduce((a, b) => a + b, 0) / data.length;
                const level = Math.min(100, Math.round(avg * 2.5));
                this.setVULevel(level);

                // 無音検出: 音量が小さければカウント
                if (avg < 4) {
                    silentFrames++;
                    // 80ms × フレーム数 = 経過時間
                    if (silentFrames * 80 >= this.SILENCE_MS) {
                        silentFrames = 0;
                        window.LingoLog?.add(`⏱️ 無音${this.SILENCE_MS/1000}秒経過 → 自動停止`);
                        this.stop("無音AUTO-OFF");
                    }
                } else {
                    silentFrames = 0; // 音声あり → リセット
                }
            }, 80);
        } catch(e) {
            window.LingoLog?.add(`⚠️ 録音VU初期化エラー: ${e.message}`);
        }
    },

    stopRecordingVU() {
        if (this.recInterval)  { clearInterval(this.recInterval); this.recInterval = null; }
        if (this.recAnalyser)  { try { this.recAnalyser.disconnect(); } catch(e){} this.recAnalyser = null; }
        if (this.recContext)   { try { this.recContext.close();       } catch(e){} this.recContext   = null; }
        this.setVULevel(0);
    },

    // =============================================
    // 録音切替
    // =============================================
    toggleListening() {
        if (this.isListening) {
            this.stop("ユーザー手動停止");
        } else {
            this.start();
        }
    },

    // =============================================
    // 録音開始 (MediaRecorder)
    // =============================================
    async start() {
        if (this.isListening) return;

        // Ambient VU を停止してマイク解放
        this.stopAmbientVU();
        await new Promise(r => setTimeout(r, 100));

        // マイクストリーム取得
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch(e) {
            window.LingoLog?.add(`❌ マイクアクセス拒否: ${e.message}`);
            this.setVUStatus("🎙️ MIC", "#ef4444", "マイクアクセス拒否", "#ef4444");
            setTimeout(() => this.startAmbientVU(), 500);
            return;
        }

        this.micStream   = stream;
        this.audioChunks = [];
        this.isListening = true;

        // VU メーターを録音ストリームに接続 (リアルタイム音量)
        this.startRecordingVU(stream);

        // UI 更新
        const micBtn    = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");
        const iconEl    = document.getElementById("micIconSymbol");

        if (micBtn)  micBtn.classList.add("recording");
        if (iconEl)  iconEl.textContent = "⏹️";
        if (chatInput) {
            chatInput.classList.add("mic-active");
            chatInput.placeholder = "🎙️ 話してください… (発話後3秒で自動停止)";
            chatInput.value = "";
        }
        this.setVUStatus("🔴 REC", "#ef4444", "録音中…", "#f97316");

        const lang = this.getRecognitionLang();
        window.LingoLog?.add(`🎙️ 録音開始 [言語: ${lang}] [MediaRecorder + Gemini STT]`);

        // MediaRecorder 設定
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
                ? "audio/webm"
                : "audio/ogg;codecs=opus";

        try {
            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
        } catch(e) {
            this.mediaRecorder = new MediaRecorder(stream); // fallback
        }

        this.mediaRecorder.ondataavailable = (evt) => {
            if (evt.data && evt.data.size > 0) this.audioChunks.push(evt.data);
        };

        this.mediaRecorder.onstop = async () => {
            window.LingoLog?.add("⏹️ MediaRecorder 停止 → Gemini STT に送信");
            await this.transcribeAudio();
        };

        this.mediaRecorder.start(200); // 200ms ごとにチャンク収集

        // 最大録音時間 (30秒)
        this.maxTimer = setTimeout(() => {
            window.LingoLog?.add(`⏱️ 最大録音時間(${this.MAX_RECORD_MS/1000}秒)に達したため自動停止`);
            this.stop("最大録音時間超過");
        }, this.MAX_RECORD_MS);
    },

    // =============================================
    // 録音停止
    // =============================================
    stop(reason = "") {
        if (!this.isListening && !this.mediaRecorder) return;

        if (reason) window.LingoLog?.add(`🛑 録音停止 [理由: ${reason}]`);

        this.isListening = false;

        if (this.maxTimer) { clearTimeout(this.maxTimer); this.maxTimer = null; }

        this.stopRecordingVU();

        // MediaRecorder 停止 (onstop で transcribe が呼ばれる)
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            try { this.mediaRecorder.stop(); } catch(e) {}
        } else if (this.audioChunks.length > 0) {
            // すでに停止済みならそのまま transcribe
            this.transcribeAudio();
        }

        // マイクストリーム解放
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }

        // UI 復元
        const micBtn    = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");
        const iconEl    = document.getElementById("micIconSymbol");

        if (micBtn)  { micBtn.classList.remove("recording"); micBtn.style.transform = ""; }
        if (iconEl)  iconEl.textContent = "🎙️";
        if (chatInput) {
            chatInput.classList.remove("mic-active");
            chatInput.style.borderColor = "";
        }

        // Ambient VU 再開
        setTimeout(() => this.startAmbientVU(), 500);
    },

    // =============================================
    // Gemini STT 文字起こし
    // =============================================
    async transcribeAudio() {
        if (this.audioChunks.length === 0) {
            window.LingoLog?.add("⚠️ 録音データなし → 文字起こしをスキップ");
            const chatInput = document.getElementById("chatInput");
            if (chatInput) chatInput.placeholder = "メッセージを入力するか、マイクで話してください…";
            return;
        }

        const mimeType  = this.audioChunks[0]?.type || "audio/webm";
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];

        window.LingoLog?.add(`🔄 Gemini STT 送信中… [サイズ: ${Math.round(audioBlob.size / 1024)}KB, 形式: ${mimeType}]`);

        const chatInput = document.getElementById("chatInput");
        if (chatInput) {
            chatInput.placeholder = "🤔 音声を解析中… (Gemini STT)";
        }
        this.setVUStatus("🤔 STT", "#6366f1", "Gemini解析中…", "#6366f1");

        const lang   = this.getRecognitionLang();
        const apiKey = this.getApiKey();

        try {
            const headers = { "Content-Type": mimeType };
            if (apiKey) headers["X-Api-Key"] = apiKey;

            const res = await fetch(`/api/stt?lang=${lang}`, {
                method:  "POST",
                headers: headers,
                body:    audioBlob
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const text = (data.text || "").trim();

            if (text) {
                if (chatInput) {
                    chatInput.value = text;
                    chatInput.style.borderColor = "#22c55e";
                    chatInput.placeholder = "メッセージを入力するか、マイクで話してください…";
                    setTimeout(() => { if (chatInput) chatInput.style.borderColor = ""; }, 800);
                }
                window.LingoLog?.add(`✅ Gemini STT 完了 [モデル: ${data.model || "不明"}]: "${text}"`);
                this.setVUStatus("🎙️ MIC", "#22c55e", "認識完了！", "#22c55e");
                setTimeout(() => this.setVUStatus("🎙️ MIC", "#22c55e", "スタンバイ中", "#94a3b8"), 2000);
            } else {
                window.LingoLog?.add("🔇 音声なし、または聞き取れませんでした。");
                if (chatInput) chatInput.placeholder = "メッセージを入力するか、マイクで話してください…";
                this.setVUStatus("🎙️ MIC", "#94a3b8", "スタンバイ中", "#cbd5e1");
            }
        } catch(e) {
            window.LingoLog?.add(`❌ Gemini STT エラー: ${e.message}`);
            if (chatInput) chatInput.placeholder = "STTエラー。テキスト入力をお試しください。";
            this.setVUStatus("🎙️ MIC", "#ef4444", "STTエラー", "#ef4444");
            setTimeout(() => this.setVUStatus("🎙️ MIC", "#94a3b8", "スタンバイ中", "#cbd5e1"), 3000);
        }
    },

    // =============================================
    // 発音練習用録音 (同じ MediaRecorder 方式)
    // =============================================
    async listenForPronunciation(targetText, callback) {
        this.stopAmbientVU();
        await new Promise(r => setTimeout(r, 100));

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch(e) {
            window.LingoLog?.add(`⚠️ 発音録音マイクエラー: ${e.message}`);
            if (callback) callback("", e.message);
            setTimeout(() => this.startAmbientVU(), 400);
            return;
        }

        const lang     = this.getRecognitionLang();
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus" : "audio/webm";

        let chunks     = [];
        let pronRec;
        try {
            pronRec = new MediaRecorder(stream, { mimeType });
        } catch(e) {
            pronRec = new MediaRecorder(stream);
        }

        // 無音検出用 AudioContext
        const pContext  = new (window.AudioContext || window.webkitAudioContext)();
        const pAnalyser = pContext.createAnalyser();
        pAnalyser.fftSize = 256;
        const pSrc  = pContext.createMediaStreamSource(stream);
        pSrc.connect(pAnalyser);
        const pData = new Uint8Array(pAnalyser.frequencyBinCount);
        let silentMs = 0;
        let started  = false;

        const silInterval = setInterval(() => {
            pAnalyser.getByteFrequencyData(pData);
            const avg = pData.reduce((a, b) => a + b, 0) / pData.length;
            if (avg > 4) { started = true; silentMs = 0; }
            else if (started) { silentMs += 80; }
            if (silentMs >= 2000 && started) { finishPron(); }
        }, 80);

        // 最大8秒タイムアウト
        const maxT = setTimeout(() => finishPron(), 8000);
        let finished = false;

        const finishPron = async () => {
            if (finished) return;
            finished = true;
            clearInterval(silInterval);
            clearTimeout(maxT);

            if (pronRec.state !== "inactive") {
                pronRec.stop();
            } else {
                await sendPronAudio();
            }
        };

        const sendPronAudio = async () => {
            stream.getTracks().forEach(t => t.stop());
            try { pAnalyser.disconnect(); pContext.close(); } catch(e) {}
            setTimeout(() => this.startAmbientVU(), 400);

            if (chunks.length === 0) { if (callback) callback("", "no audio"); return; }

            const blob = new Blob(chunks, { type: mimeType });
            window.LingoLog?.add(`🎙️ 発音録音 → Gemini STT [${Math.round(blob.size/1024)}KB]`);

            try {
                const apiKey = this.getApiKey();
                const headers = { "Content-Type": mimeType };
                if (apiKey) headers["X-Api-Key"] = apiKey;

                const res = await fetch(`/api/stt?lang=${lang}`, {
                    method: "POST", headers, body: blob
                });
                const data = await res.json();
                if (callback) callback(data.text || "", data.error || null);
            } catch(e) {
                if (callback) callback("", e.message);
            }
        };

        pronRec.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
        pronRec.onstop = sendPronAudio;

        pronRec.start(200);
        window.LingoLog?.add(`🎙️ 発音録音開始 [言語: ${lang}]`);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoSTT.init();
});
