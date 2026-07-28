// STT Engine - LingoBot2 Ver6.5β
// ARCHITECTURE: MediaRecorder (browser built-in recording) + /api/stt (Gemini transcription)
//   Web Speech API is NOT used — it connects to Google STT servers which are
//   unreachable from some networks (Vietnam etc.), causing consistent "network" errors.
//
// KEY FIXES in Ver6.5β:
//   1. Button state always matches actual state (button.classList = ground truth)
//   2. toggleListening() checks button CSS class, NOT isListening flag
//   3. 20-second forced stop if VU meter is active (MAX_RECORD_MS = 20000)
//   4. Manual stop button ALWAYS works — pressing ⏹️ calls stop() unconditionally
//   5. No auto-retry loops — errors fail clearly with helpful message
//   6. Ambient VU (real audio level) when standby
//   7. Recording VU (real audio level from same stream) while recording
window.LingoSTT = {
    isListening:   false,
    mediaRecorder: null,
    audioChunks:   [],
    micStream:     null,

    // Ambient VU (standby — getUserMedia)
    ambientStream:   null,
    ambientContext:  null,
    ambientAnalyser: null,
    ambientInterval: null,

    // Recording VU (same stream as MediaRecorder — real audio level)
    recContext:   null,
    recAnalyser:  null,
    recInterval:  null,

    // ── TIMERS ──
    maxTimer: null,
    MAX_RECORD_MS: 20000,   // 20秒で強制停止

    // 無音検出
    SILENCE_MS: 4000,       // 発話後4秒無音で自動停止

    // =============================================
    // 初期化
    // =============================================
    init() {
        const btn = document.getElementById("micBtn");
        if (btn) {
            btn.addEventListener("click", () => this.toggleListening());
        }
        setTimeout(() => this.startAmbientVU(), 600);
        window.LingoLog?.add("Khởi tạo STT Engine (LingoBot2 Ver6.5β - MediaRecorder + Gemini STT) thành công.");
    },

    getRecognitionLang() {
        const t = window.LingoApp?.targetLang ?? "jp 日本語";
        if (t.includes("日本語") || t.includes("jp")) return "ja-JP";
        if (t.includes("English") || t.includes("us")) return "en-US";
        if (t.includes("Việt") || t.includes("vn"))    return "vi-VN";
        return "ja-JP";
    },

    getApiKey() { return window.LingoApp?.apiKey || ""; },

    // =============================================
    // VU ヘルパー
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
        if (l) { l.textContent = label;  l.style.color = labelColor  || "#94a3b8"; }
        if (s) { s.textContent = status; s.style.color = statusColor || "#cbd5e1"; }
    },

    // =============================================
    // Ambient VU (スタンバイ)
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
                const avg = data.reduce((a, b) => a + b, 0) / data.length;
                this.setVULevel(Math.min(100, Math.round(avg * 2.5)));
            }, 80);
        } catch (e) {
            this.setVUStatus("🎙️ MIC", "#94a3b8", "スタンバイ中", "#cbd5e1");
        }
    },

    stopAmbientVU() {
        if (this.ambientInterval) { clearInterval(this.ambientInterval);   this.ambientInterval = null; }
        if (this.ambientAnalyser) { try { this.ambientAnalyser.disconnect(); } catch(e){} this.ambientAnalyser = null; }
        if (this.ambientContext)  { try { this.ambientContext.close();       } catch(e){} this.ambientContext  = null; }
        if (this.ambientStream)   { this.ambientStream.getTracks().forEach(t => t.stop()); this.ambientStream = null; }
    },

    // =============================================
    // 録音時 VU + 動的無音検出
    // MediaRecorder と同じストリームを使うためリアルな音量が取れる
    // =============================================
    startRecordingVU(stream) {
        this.stopRecordingVU();
        try {
            this.recContext  = new (window.AudioContext || window.webkitAudioContext)();
            this.recAnalyser = this.recContext.createAnalyser();
            this.recAnalyser.fftSize = 256;
            const src = this.recContext.createMediaStreamSource(stream);
            src.connect(this.recAnalyser);
            const data = new Uint8Array(this.recAnalyser.frequencyBinCount);

            // 動的閾値
            let baselineSum = 0, baselineCount = 0, baseline = -1;
            const BASELINE_FRAMES = 5; // 5×80ms = 400ms で計測
            let silentMs = 0, hasSpoken = false;

            this.recInterval = setInterval(() => {
                if (!this.isListening) return;
                this.recAnalyser.getByteFrequencyData(data);
                const avg   = data.reduce((a, b) => a + b, 0) / data.length;
                const level = Math.min(100, Math.round(avg * 2.5));
                this.setVULevel(level);

                // ベースライン計測フェーズ
                if (baselineCount < BASELINE_FRAMES) {
                    baselineSum += avg;
                    baselineCount++;
                    if (baselineCount === BASELINE_FRAMES) {
                        baseline = baselineSum / BASELINE_FRAMES;
                    }
                    return;
                }

                const silenceThr = Math.max(6, baseline * 2.0 + 3);
                const speechThr  = Math.max(12, baseline * 2.8);

                if (avg >= speechThr) {
                    hasSpoken = true;
                    silentMs  = 0;
                    this.setVUStatus("🔴 REC", "#ef4444", "発話中…", "#22c55e");
                } else if (avg < silenceThr && hasSpoken) {
                    silentMs += 80;
                    const remain = Math.max(0, (this.SILENCE_MS - silentMs) / 1000).toFixed(0);
                    this.setVUStatus("🔴 REC", "#ef4444", `無音 ${remain}秒で停止`, "#f97316");
                    if (silentMs >= this.SILENCE_MS) {
                        window.LingoLog?.add(`⏱️ 無音${this.SILENCE_MS/1000}秒経過 → 自動停止`);
                        this.stop("無音AUTO-OFF");
                    }
                } else if (avg < silenceThr) {
                    this.setVUStatus("🔴 REC", "#ef4444", "話してください…", "#f97316");
                } else {
                    silentMs = Math.max(0, silentMs - 40);
                    if (hasSpoken) this.setVUStatus("🔴 REC", "#ef4444", "録音中…", "#f97316");
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
    // ── CRITICAL FIX: ボタンのCSS class を判定のground truth として使う ──
    // isListening フラグではなくボタンの見た目で判断することで
    // リトライ中のフラグ不整合によるバグを防ぐ
    // =============================================
    toggleListening() {
        const micBtn  = document.getElementById("micBtn");
        const isInRecordingMode = micBtn?.classList.contains("recording");

        if (isInRecordingMode || this.isListening) {
            // ⏹️ が表示中 → どんな状態でも必ず停止
            this.stop("ユーザー手動停止");
        } else {
            // 🎙️ が表示中 → 録音開始
            this.start();
        }
    },

    // =============================================
    // UI → 録音中状態にセット
    // =============================================
    setUIRecording(lang) {
        const micBtn    = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");
        const iconEl    = document.getElementById("micIconSymbol");
        if (micBtn)    micBtn.classList.add("recording");
        if (iconEl)    iconEl.textContent = "⏹️";
        if (chatInput) {
            chatInput.classList.add("mic-active");
            chatInput.placeholder = `🎙️ 話してください… [${lang}] (20秒で自動停止)`;
            chatInput.value = "";
        }
        this.setVUStatus("🔴 REC", "#ef4444", "話してください…", "#f97316");
    },

    // =============================================
    // UI → スタンバイ状態にリセット
    // =============================================
    setUIStandby() {
        const micBtn    = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");
        const iconEl    = document.getElementById("micIconSymbol");
        if (micBtn)    { micBtn.classList.remove("recording"); micBtn.style.transform = ""; }
        if (iconEl)    iconEl.textContent = "🎙️";
        if (chatInput) {
            chatInput.classList.remove("mic-active");
            chatInput.style.borderColor = "";
            const dict = window.LingoApp?.i18n?.[window.LingoApp?.uiLang] || {};
            chatInput.placeholder = dict.placeholder || "メッセージを入力するか、マイクで話してください…";
        }
        this.setVULevel(0);
    },

    // =============================================
    // 録音開始
    // =============================================
    async start() {
        if (this.isListening) return;

        // Ambient VU を停止してマイクを解放
        this.stopAmbientVU();
        await new Promise(r => setTimeout(r, 120));

        // マイク権限取得
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch(e) {
            window.LingoLog?.add(`❌ マイクアクセス拒否: ${e.message}`);
            this.setVUStatus("🎙️ MIC", "#ef4444", "マイク拒否", "#ef4444");
            setTimeout(() => this.startAmbientVU(), 500);
            return;
        }

        this.micStream   = stream;
        this.audioChunks = [];
        this.isListening = true;

        const lang = this.getRecognitionLang();
        this.setUIRecording(lang);
        this.startRecordingVU(stream);

        window.LingoLog?.add(`🎙️ 録音開始 [${lang}] [MediaRecorder — 最大${this.MAX_RECORD_MS/1000}秒]`);

        // MediaRecorder 設定
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm";

        try {
            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
        } catch(e) {
            this.mediaRecorder = new MediaRecorder(stream);
        }

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data?.size > 0) this.audioChunks.push(e.data);
        };

        this.mediaRecorder.onstop = async () => {
            window.LingoLog?.add("⏹️ MediaRecorder 停止 → WAV変換 → Gemini STT 送信");
            await this.transcribeAudio(lang);
        };

        this.mediaRecorder.start(200);

        // ── 20秒強制停止タイマー ──
        if (this.maxTimer) clearTimeout(this.maxTimer);
        this.maxTimer = setTimeout(() => {
            if (this.isListening) {
                window.LingoLog?.add(`⏱️ ${this.MAX_RECORD_MS/1000}秒経過 → 強制停止`);
                this.stop("20秒強制停止");
            }
        }, this.MAX_RECORD_MS);
    },

    // =============================================
    // 録音停止 (理由問わず確実に停止)
    // =============================================
    stop(reason = "") {
        if (reason) window.LingoLog?.add(`🛑 停止 [${reason}]`);

        this.isListening = false;

        // タイマークリア
        if (this.maxTimer) { clearTimeout(this.maxTimer); this.maxTimer = null; }

        // VU停止
        this.stopRecordingVU();

        // MediaRecorder 停止 → onstop で transcribe が呼ばれる
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            try { this.mediaRecorder.stop(); } catch(e) {}
        } else if (this.audioChunks.length > 0 && reason !== "エラー") {
            // 既に停止済みで chunk がある場合は直接 transcribe
            const lang = this.getRecognitionLang();
            this.transcribeAudio(lang);
        }

        // マイクストリーム解放
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }

        // UI 即リセット (ここが重要 — エラー時も確実にボタンを戻す)
        this.setUIStandby();

        // Ambient VU 再開 (少し待ってから)
        setTimeout(() => this.startAmbientVU(), 500);
    },

    // =============================================
    // WebM → WAV 変換 (Gemini 互換フォーマット)
    // =============================================
    async convertToWav(inputBlob) {
        const TARGET_SR = 16000;
        try {
            const arrayBuffer = await inputBlob.arrayBuffer();
            const tmpCtx = new AudioContext();
            let audioBuffer;
            try { audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer); }
            finally { tmpCtx.close(); }

            const numSamples = Math.ceil(audioBuffer.duration * TARGET_SR);
            const offCtx = new OfflineAudioContext(1, numSamples, TARGET_SR);
            const src = offCtx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(offCtx.destination);
            src.start(0);
            const rendered = await offCtx.startRendering();
            const samples  = rendered.getChannelData(0);

            const dataLen = samples.length * 2;
            const buf  = new ArrayBuffer(44 + dataLen);
            const view = new DataView(buf);
            const ws   = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };

            ws(0, "RIFF"); view.setUint32(4, 36 + dataLen, true);
            ws(8, "WAVE"); ws(12, "fmt ");
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true); view.setUint16(22, 1, true);
            view.setUint32(24, TARGET_SR, true); view.setUint32(28, TARGET_SR * 2, true);
            view.setUint16(32, 2, true); view.setUint16(34, 16, true);
            ws(36, "data"); view.setUint32(40, dataLen, true);

            let off = 44;
            for (let i = 0; i < samples.length; i++) {
                const s = Math.max(-1, Math.min(1, samples[i]));
                view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                off += 2;
            }
            const wavBlob = new Blob([buf], { type: "audio/wav" });
            window.LingoLog?.add(`🔄 WAV変換: ${Math.round(wavBlob.size/1024)}KB (16kHz mono PCM)`);
            return wavBlob;
        } catch(e) {
            window.LingoLog?.add(`⚠️ WAV変換失敗 (${e.message}) → 元のまま送信`);
            return inputBlob;
        }
    },

    // =============================================
    // Gemini STT 文字起こし
    // =============================================
    async transcribeAudio(lang) {
        if (this.audioChunks.length === 0) {
            window.LingoLog?.add("⚠️ 録音データなし → スキップ");
            const ci = document.getElementById("chatInput");
            if (ci) ci.placeholder = "メッセージを入力するか、マイクで話してください…";
            return;
        }

        const rawMime = this.audioChunks[0]?.type || "audio/webm";
        const rawBlob = new Blob(this.audioChunks, { type: rawMime });
        this.audioChunks = [];

        const chatInput = document.getElementById("chatInput");
        if (chatInput) chatInput.placeholder = "🤔 音声解析中… (Gemini STT)";
        this.setVUStatus("🤔 STT", "#6366f1", "Gemini解析中…", "#6366f1");

        const wavBlob = await this.convertToWav(rawBlob);
        const apiKey  = this.getApiKey();

        window.LingoLog?.add(`📤 Gemini STT 送信 [${Math.round(wavBlob.size/1024)}KB, ${lang}]`);

        try {
            const headers = { "Content-Type": "audio/wav" };
            if (apiKey) headers["X-Api-Key"] = apiKey;

            const res  = await fetch(`/api/stt?lang=${lang}`, {
                method: "POST", headers, body: wavBlob
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

            const text = (data.text || "").trim();
            if (text) {
                if (chatInput) {
                    chatInput.value = text;
                    chatInput.style.borderColor = "#22c55e";
                    chatInput.placeholder = "メッセージを入力するか、マイクで話してください…";
                    setTimeout(() => { if (chatInput) chatInput.style.borderColor = ""; }, 900);
                }
                window.LingoLog?.add(`✅ Gemini STT 完了 [${data.model || "?"}]: "${text}"`);
                this.setVUStatus("🎙️ MIC", "#22c55e", "認識完了！", "#22c55e");
                setTimeout(() => this.setVUStatus("🎙️ MIC", "#22c55e", "スタンバイ中", "#94a3b8"), 2500);
            } else {
                window.LingoLog?.add("🔇 音声なし / 聞き取れませんでした。");
                if (chatInput) chatInput.placeholder = "メッセージを入力するか、マイクで話してください…";
                this.setVUStatus("🎙️ MIC", "#94a3b8", "スタンバイ中", "#cbd5e1");
            }
        } catch(e) {
            window.LingoLog?.add(`❌ Gemini STT エラー: ${e.message}`);
            if (chatInput) chatInput.placeholder = "STTエラー。テキスト入力をご利用ください。";
            this.setVUStatus("🎙️ MIC", "#ef4444", "STTエラー", "#ef4444");
            setTimeout(() => this.setVUStatus("🎙️ MIC", "#94a3b8", "スタンバイ中", "#cbd5e1"), 3000);
        }
    },

    // =============================================
    // 発音練習用 STT
    // =============================================
    async listenForPronunciation(targetText, callback) {
        this.stopAmbientVU();
        await new Promise(r => setTimeout(r, 100));

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch(e) {
            window.LingoLog?.add(`⚠️ 発音マイクエラー: ${e.message}`);
            if (callback) callback("", e.message);
            setTimeout(() => this.startAmbientVU(), 400);
            return;
        }

        const lang     = this.getRecognitionLang();
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus" : "audio/webm";

        let chunks = [];
        let pronRec;
        try { pronRec = new MediaRecorder(stream, { mimeType }); }
        catch(e) { pronRec = new MediaRecorder(stream); }

        // 無音検出
        const pCtx  = new (window.AudioContext || window.webkitAudioContext)();
        const pAnal = pCtx.createAnalyser();
        pAnal.fftSize = 256;
        pCtx.createMediaStreamSource(stream).connect(pAnal);
        const pData = new Uint8Array(pAnal.frequencyBinCount);
        let silMs = 0, spoken = false, baseSamples = [], baseVal = -1;

        const silInterval = setInterval(() => {
            pAnal.getByteFrequencyData(pData);
            const avg = pData.reduce((a, b) => a + b, 0) / pData.length;
            if (baseVal < 0) {
                baseSamples.push(avg);
                if (baseSamples.length >= 5) baseVal = baseSamples.reduce((a,b)=>a+b,0)/5;
                return;
            }
            const thr = Math.max(8, baseVal * 2.5 + 4);
            if (avg >= thr * 1.5) { spoken = true; silMs = 0; }
            else if (avg < thr && spoken) {
                silMs += 80;
                if (silMs >= 1500) finishPron();
            } else { silMs = Math.max(0, silMs - 40); }
        }, 80);

        const maxT  = setTimeout(() => finishPron(), 10000);
        let finished = false;

        const finishPron = async () => {
            if (finished) return;
            finished = true;
            clearInterval(silInterval); clearTimeout(maxT);
            if (pronRec.state !== "inactive") pronRec.stop();
            else await sendPronAudio();
        };

        const sendPronAudio = async () => {
            stream.getTracks().forEach(t => t.stop());
            try { pAnal.disconnect(); pCtx.close(); } catch(e) {}
            setTimeout(() => this.startAmbientVU(), 400);
            if (chunks.length === 0) { if (callback) callback("", "no audio"); return; }
            const rawBlob = new Blob(chunks, { type: mimeType });
            const wavBlob = await this.convertToWav(rawBlob);
            const apiKey  = this.getApiKey();
            const headers = { "Content-Type": "audio/wav" };
            if (apiKey) headers["X-Api-Key"] = apiKey;
            try {
                const res  = await fetch(`/api/stt?lang=${lang}`, { method:"POST", headers, body: wavBlob });
                const data = await res.json();
                if (callback) callback(data.text || "", data.error || null);
            } catch(e) { if (callback) callback("", e.message); }
        };

        pronRec.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
        pronRec.onstop = sendPronAudio;
        pronRec.start(200);
        window.LingoLog?.add(`🎙️ 発音録音開始 [${lang}]`);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoSTT.init();
});
