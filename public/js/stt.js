// Web Speech STT Engine - LingoBot2 Ver6.3β
// KEY FIXES:
//   1. WebM → WAV conversion before sending to Gemini (guaranteed compatibility)
//   2. Dynamic silence threshold (adapts to ambient noise level)
//   3. "hasSpoken" gate: auto-stop only triggers AFTER user speaks
window.LingoSTT = {
    isListening:   false,
    mediaRecorder: null,
    audioChunks:   [],
    micStream:     null,

    // Ambient VU (standby)
    ambientStream:   null,
    ambientContext:  null,
    ambientAnalyser: null,
    ambientInterval: null,

    // Recording VU + silence detection
    recContext:   null,
    recAnalyser:  null,
    recInterval:  null,

    SILENCE_MS:    3000,   // 無音判定時間
    MAX_RECORD_MS: 30000,  // 最大録音時間
    maxTimer:      null,

    // =============================================
    // 初期化
    // =============================================
    init() {
        const micBtn = document.getElementById("micBtn");
        if (micBtn) micBtn.addEventListener("click", () => this.toggleListening());
        setTimeout(() => this.startAmbientVU(), 600);
        window.LingoLog?.add("Khởi tạo STT Engine (LingoBot2 Ver6.3β - WAV Convert + Smart Silence) thành công.");
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
        if (this.ambientInterval) { clearInterval(this.ambientInterval); this.ambientInterval = null; }
        if (this.ambientAnalyser) { try { this.ambientAnalyser.disconnect(); } catch(e){} this.ambientAnalyser = null; }
        if (this.ambientContext)  { try { this.ambientContext.close();      } catch(e){} this.ambientContext  = null; }
        if (this.ambientStream)   { this.ambientStream.getTracks().forEach(t => t.stop()); this.ambientStream = null; }
    },

    // =============================================
    // 録音時 VU + 動的閾値 無音検出
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

            // 動的閾値のための変数
            let baselineSum   = 0;
            let baselineCount = 0;
            let baseline      = -1;          // -1 = まだ計測中
            const BASELINE_FRAMES = 6;       // 6×80ms = 480ms で計測
            let silentMs  = 0;
            let hasSpoken = false;           // ユーザーが一度でも発話したか
            const MIN_RECORDING_MS = 600;    // 最低録音時間
            let recordingMs = 0;

            this.recInterval = setInterval(() => {
                this.recAnalyser.getByteFrequencyData(data);
                const avg   = data.reduce((a, b) => a + b, 0) / data.length;
                const level = Math.min(100, Math.round(avg * 2.5));
                this.setVULevel(level);
                recordingMs += 80;

                // ── フェーズ1: ベースライン計測 (最初の480ms) ──
                if (baselineCount < BASELINE_FRAMES) {
                    baselineSum += avg;
                    baselineCount++;
                    if (baselineCount === BASELINE_FRAMES) {
                        baseline = baselineSum / BASELINE_FRAMES;
                        window.LingoLog?.add(`📊 環境音ベースライン: ${baseline.toFixed(1)} (動的無音閾値 = ${(baseline * 2.5 + 4).toFixed(1)})`);
                    }
                    return; // ベースライン計測中は無音判定しない
                }

                // ── フェーズ2: 動的無音検出 ──
                // 閾値: ベースラインの2.5倍 + 4 (最低でも8)
                const silenceThreshold = Math.max(8, baseline * 2.5 + 4);
                // 発話判定: ベースラインの4倍 以上なら "発話あり"
                const speechThreshold  = Math.max(15, baseline * 4.0);

                if (avg >= speechThreshold) {
                    hasSpoken = true;
                    silentMs  = 0; // 発話中はリセット
                    this.setVUStatus("🔴 REC", "#ef4444", "発話検出！", "#22c55e");
                } else if (avg < silenceThreshold) {
                    if (hasSpoken && recordingMs >= MIN_RECORDING_MS) {
                        silentMs += 80;
                        // 残り秒数表示
                        const remaining = ((this.SILENCE_MS - silentMs) / 1000).toFixed(1);
                        this.setVUStatus("🔴 REC", "#ef4444", `無音 ${remaining}秒で停止`, "#f97316");
                        if (silentMs >= this.SILENCE_MS) {
                            window.LingoLog?.add(`⏱️ 無音${this.SILENCE_MS/1000}秒経過 → 自動停止`);
                            this.stop("無音AUTO-OFF");
                        }
                    } else if (!hasSpoken) {
                        this.setVUStatus("🔴 REC", "#ef4444", "話してください…", "#f97316");
                    }
                } else {
                    // 閾値の間: 発話後のフェードアウト中などはリセットしない
                    silentMs = Math.max(0, silentMs - 40);
                    if (hasSpoken) {
                        this.setVUStatus("🔴 REC", "#ef4444", "録音中…", "#f97316");
                    }
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
        if (this.isListening) this.stop("ユーザー手動停止");
        else                  this.start();
    },

    // =============================================
    // 録音開始
    // =============================================
    async start() {
        if (this.isListening) return;
        this.stopAmbientVU();
        await new Promise(r => setTimeout(r, 100));

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
        this.startRecordingVU(stream);

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
        this.setVUStatus("🔴 REC", "#ef4444", "話してください…", "#f97316");

        const lang     = this.getRecognitionLang();
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";

        try {
            this.mediaRecorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
        } catch(e) {
            this.mediaRecorder = new MediaRecorder(stream);
        }

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data?.size > 0) this.audioChunks.push(e.data);
        };
        this.mediaRecorder.onstop = async () => {
            window.LingoLog?.add("⏹️ MediaRecorder 停止 → WAV変換 → Gemini STT");
            await this.transcribeAudio(lang);
        };
        this.mediaRecorder.start(200);

        window.LingoLog?.add(`🎙️ 録音開始 [言語: ${lang}] [MediaRecorder + Gemini STT]`);

        this.maxTimer = setTimeout(() => {
            window.LingoLog?.add(`⏱️ 最大録音時間(${this.MAX_RECORD_MS/1000}秒)超過 → 自動停止`);
            this.stop("最大時間超過");
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

        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            try { this.mediaRecorder.stop(); } catch(e) {}
        }

        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }

        const micBtn    = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");
        const iconEl    = document.getElementById("micIconSymbol");
        if (micBtn)  { micBtn.classList.remove("recording"); micBtn.style.transform = ""; }
        if (iconEl)  iconEl.textContent = "🎙️";
        if (chatInput) { chatInput.classList.remove("mic-active"); chatInput.style.borderColor = ""; }

        setTimeout(() => this.startAmbientVU(), 500);
    },

    // =============================================
    // WebM → WAV 変換 (Gemini互換フォーマット)
    // =============================================
    async convertToWav(inputBlob) {
        const TARGET_SAMPLE_RATE = 16000; // STT最適: 16kHz モノラル
        try {
            const arrayBuffer = await inputBlob.arrayBuffer();
            const tmpCtx = new AudioContext();
            let audioBuffer;
            try {
                audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer);
            } finally {
                tmpCtx.close();
            }

            // OfflineAudioContext でリサンプリング (16kHz モノラル)
            const numSamples = Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE);
            const offlineCtx = new OfflineAudioContext(1, numSamples, TARGET_SAMPLE_RATE);
            const src = offlineCtx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(offlineCtx.destination);
            src.start(0);
            const rendered = await offlineCtx.startRendering();
            const samples  = rendered.getChannelData(0);

            // PCM 16bit WAV エンコード
            const dataLen  = samples.length * 2;
            const buf      = new ArrayBuffer(44 + dataLen);
            const view     = new DataView(buf);
            const ws = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };

            ws(0,  "RIFF"); view.setUint32(4,  36 + dataLen, true);
            ws(8,  "WAVE"); ws(12, "fmt ");
            view.setUint32(16, 16, true);
            view.setUint16(20,  1, true);               // PCM
            view.setUint16(22,  1, true);               // モノラル
            view.setUint32(24, TARGET_SAMPLE_RATE, true);
            view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
            view.setUint16(32,  2, true);               // ブロックアライン
            view.setUint16(34, 16, true);               // 16bit
            ws(36, "data"); view.setUint32(40, dataLen, true);

            let off = 44;
            for (let i = 0; i < samples.length; i++) {
                const s = Math.max(-1, Math.min(1, samples[i]));
                view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                off += 2;
            }

            const wavBlob = new Blob([buf], { type: "audio/wav" });
            window.LingoLog?.add(`🔄 WAV変換完了: ${Math.round(wavBlob.size/1024)}KB (16kHz mono PCM)`);
            return wavBlob;
        } catch(e) {
            window.LingoLog?.add(`⚠️ WAV変換失敗: ${e.message} → 元のWebMで送信`);
            return inputBlob; // フォールバック: 元のまま送信
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
        if (chatInput) chatInput.placeholder = "🤔 音声を解析中… (Gemini STT)";
        this.setVUStatus("🤔 STT", "#6366f1", "Gemini解析中…", "#6366f1");

        // WebM → WAV 変換 (Gemini は WAV を確実にサポート)
        const sendBlob = await this.convertToWav(rawBlob);
        const sendMime = sendBlob.type || "audio/wav";
        const langKey  = lang || this.getRecognitionLang();
        const apiKey   = this.getApiKey();

        window.LingoLog?.add(`📤 Gemini STT 送信: ${Math.round(sendBlob.size/1024)}KB [${sendMime}]`);

        try {
            const headers = { "Content-Type": sendMime };
            if (apiKey) headers["X-Api-Key"] = apiKey;

            const res = await fetch(`/api/stt?lang=${langKey}`, {
                method: "POST", headers, body: sendBlob
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }

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
    // 発音練習用録音
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

        let chunks = [];
        let pronRec;
        try { pronRec = new MediaRecorder(stream, { mimeType }); }
        catch(e) { pronRec = new MediaRecorder(stream); }

        // 無音検出 (発音練習用は簡易版)
        const pCtx  = new (window.AudioContext || window.webkitAudioContext)();
        const pAnal = pCtx.createAnalyser();
        pAnal.fftSize = 256;
        const pSrc  = pCtx.createMediaStreamSource(stream);
        pSrc.connect(pAnal);
        const pData = new Uint8Array(pAnal.frequencyBinCount);
        let silentMs = 0, hasSpoken = false;
        let baseSamples = [], baseVal = -1;

        const silInterval = setInterval(() => {
            pAnal.getByteFrequencyData(pData);
            const avg = pData.reduce((a, b) => a + b, 0) / pData.length;
            if (baseVal < 0) {
                baseSamples.push(avg);
                if (baseSamples.length >= 5) baseVal = baseSamples.reduce((a,b)=>a+b,0)/baseSamples.length;
                return;
            }
            const thr = Math.max(8, baseVal * 2.5 + 4);
            if (avg >= thr * 1.5) { hasSpoken = true; silentMs = 0; }
            else if (avg < thr && hasSpoken) {
                silentMs += 80;
                if (silentMs >= 1500) finishPron();
            } else { silentMs = Math.max(0, silentMs - 40); }
        }, 80);

        const maxT  = setTimeout(() => finishPron(), 10000);
        let finished = false;

        const finishPron = async () => {
            if (finished) return;
            finished = true;
            clearInterval(silInterval);
            clearTimeout(maxT);
            if (pronRec.state !== "inactive") pronRec.stop();
            else await sendPronAudio();
        };

        const sendPronAudio = async () => {
            stream.getTracks().forEach(t => t.stop());
            try { pAnal.disconnect(); pCtx.close(); } catch(e) {}
            setTimeout(() => this.startAmbientVU(), 400);

            if (chunks.length === 0) { if (callback) callback("", "no audio"); return; }

            const rawBlob  = new Blob(chunks, { type: mimeType });
            const wavBlob  = await this.convertToWav(rawBlob);
            const apiKey   = this.getApiKey();
            const headers  = { "Content-Type": wavBlob.type || "audio/wav" };
            if (apiKey) headers["X-Api-Key"] = apiKey;

            try {
                const res  = await fetch(`/api/stt?lang=${lang}`, { method:"POST", headers, body: wavBlob });
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
