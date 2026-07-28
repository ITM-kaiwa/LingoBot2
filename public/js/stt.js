// STT Engine - LingoBot2 Ver6.4β
// PRIMARY STT: Web Speech API (browser built-in, no Gemini quota usage)
//   - Releases getUserMedia (Ambient VU) completely before recognition.start()
//     to eliminate the stream conflict that caused "network" errors in earlier versions.
//   - VU animation during recording driven by onsoundstart/onspeechstart events.
//   - 3s silence auto-stop via onspeechend + timer.
//   - 8s no-speech timeout if user never speaks.
// AMBIENT VU: real getUserMedia level display when NOT recording.
// PRONUNCIATION: same Web Speech API, separate SpeechRecognition instance.
window.LingoSTT = {
    recognition: null,
    isListening:  false,
    retryCount:   0,
    lastNetworkErrTime: 0,

    // Ambient VU
    ambientStream:   null,
    ambientContext:  null,
    ambientAnalyser: null,
    ambientInterval: null,

    // VU animation (recording mode — CSS driven)
    vuAnimInterval: null,

    // Timers
    silenceTimer:  null,   // fires SILENCE_MS after speech ends
    noSpeechTimer: null,   // fires NO_SPEECH_MS if user never speaks
    SILENCE_MS:       3000,
    NO_SPEECH_MS:     8000,

    // =============================================
    // 初期化
    // =============================================
    init() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            this.setVUStatus("🎙️ MIC", "#ef4444", "STT非対応ブラウザ", "#ef4444");
            window.LingoLog?.add("⚠️ Web Speech API 非対応ブラウザ。Google Chrome をお使いください。");
            return;
        }
        const btn = document.getElementById("micBtn");
        if (btn) btn.addEventListener("click", () => this.toggleListening());
        setTimeout(() => this.startAmbientVU(), 600);
        window.LingoLog?.add("Khởi tạo STT Engine (LingoBot2 Ver6.4β - Web Speech API + Smart VU) thành công.");
    },

    // =============================================
    // 言語・キー
    // =============================================
    getRecognitionLang() {
        const t = window.LingoApp?.targetLang ?? "jp 日本語";
        if (t.includes("日本語") || t.includes("jp")) return "ja-JP";
        if (t.includes("English") || t.includes("us")) return "en-US";
        if (t.includes("Việt") || t.includes("vn"))    return "vi-VN";
        return "ja-JP";
    },

    // =============================================
    // VU バー共通
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
    // Ambient VU (スタンバイ時 — getUserMedia使用)
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
    // 録音中 VU アニメーション (CSS ドリブン)
    // SpeechRecognition はマイクを内部管理するため
    // getUserMedia を別途使えないため CSS アニメーションで代替
    // =============================================
    startVUAnim(highEnergy = false) {
        this.stopVUAnim();
        const maxLv = highEnergy ? 88 : 35;
        let lv = 5, dir = 1;
        this.vuAnimInterval = setInterval(() => {
            lv += dir * (Math.random() * 9 + 2);
            if (lv >= maxLv) dir = -1;
            if (lv <=  3)    dir =  1;
            lv = Math.max(3, Math.min(100, lv));
            this.setVULevel(lv);
        }, 80);
    },

    stopVUAnim() {
        if (this.vuAnimInterval) { clearInterval(this.vuAnimInterval); this.vuAnimInterval = null; }
    },

    // =============================================
    // タイマー管理
    // =============================================
    clearAllTimers() {
        if (this.silenceTimer)  { clearTimeout(this.silenceTimer);  this.silenceTimer  = null; }
        if (this.noSpeechTimer) { clearTimeout(this.noSpeechTimer); this.noSpeechTimer = null; }
    },

    resetSilenceTimer() {
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
            window.LingoLog?.add(`⏱️ 発話終了後 ${this.SILENCE_MS/1000}秒 → 自動停止`);
            this.stop("無音AUTO-OFF");
        }, this.SILENCE_MS);
    },

    // =============================================
    // 録音切替
    // =============================================
    toggleListening() {
        if (this.isListening) this.stop("ユーザー手動停止");
        else { this.retryCount = 0; this.start(); }
    },

    // =============================================
    // 録音開始 (Web Speech API)
    // =============================================
    async start() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR || this.isListening) return;

        // ── CRITICAL: Ambient VU を停止してマイクを完全解放 ──
        // getUserMedia ストリームが残っていると SpeechRecognition が
        // network エラーを出す競合が起きるため、必ず先に解放する
        this.stopAmbientVU();
        await new Promise(r => setTimeout(r, 250));  // 解放完了を待つ

        // マイク権限確認 (ユーザーへ許可ダイアログ表示)
        try {
            const tmpStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            tmpStream.getTracks().forEach(t => t.stop()); // 即座に解放
        } catch(e) {
            window.LingoLog?.add(`❌ マイクアクセス拒否: ${e.message}`);
            this.setVUStatus("🎙️ MIC", "#ef4444", "マイク拒否", "#ef4444");
            setTimeout(() => this.startAmbientVU(), 500);
            return;
        }

        await new Promise(r => setTimeout(r, 100)); // 解放後の安定待ち

        const lang = this.getRecognitionLang();
        this.isListening = true;
        this.clearAllTimers();

        // UI 更新
        const micBtn    = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");
        const iconEl    = document.getElementById("micIconSymbol");
        if (micBtn)    micBtn.classList.add("recording");
        if (iconEl)    iconEl.textContent = "⏹️";
        if (chatInput) {
            chatInput.classList.add("mic-active");
            chatInput.placeholder = "🎙️ 話してください… (発話後3秒で自動停止)";
            chatInput.value = "";
        }
        this.setVUStatus("🔴 REC", "#ef4444", "待機中…", "#f97316");
        this.startVUAnim(false); // 待機中は控えめなアニメーション

        window.LingoLog?.add(`🎙️ 録音開始 [${lang}] [Web Speech API]`);

        // ── SpeechRecognition 設定 ──
        if (this.recognition) { try { this.recognition.abort(); } catch(e) {} }
        this.recognition = new SR();
        this.recognition.lang             = lang;
        this.recognition.continuous       = false;
        this.recognition.interimResults   = true;
        this.recognition.maxAlternatives  = 1;

        let finalText = "";

        // 8秒無音タイムアウト (ユーザーが一度も話さなかった場合)
        this.noSpeechTimer = setTimeout(() => {
            window.LingoLog?.add("⏱️ 8秒間無音 → 自動停止");
            this.stop("8秒タイムアウト");
        }, this.NO_SPEECH_MS);

        // ── イベント ──
        this.recognition.onsoundstart = () => {
            window.LingoLog?.add("🔊 音声検出 (soundstart)");
            if (this.noSpeechTimer) { clearTimeout(this.noSpeechTimer); this.noSpeechTimer = null; }
            this.setVUStatus("🔴 REC", "#ef4444", "音声検出…", "#22c55e");
        };

        this.recognition.onspeechstart = () => {
            window.LingoLog?.add("🗣️ 発話開始 (speechstart)");
            this.setVUStatus("🔴 REC", "#ef4444", "発話中…", "#22c55e");
            this.startVUAnim(true); // 発話中は活発なアニメーション
        };

        this.recognition.onspeechend = () => {
            window.LingoLog?.add("🔇 発話終了 (speechend) → 3秒カウントダウン");
            this.setVUStatus("🔴 REC", "#ef4444", "解析中…", "#f97316");
            this.stopVUAnim();
            this.setVULevel(0);
            this.resetSilenceTimer(); // 3秒後に自動停止
        };

        this.recognition.onsoundend = () => { this.stopVUAnim(); };

        this.recognition.onresult = (event) => {
            this.clearAllTimers();
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalText += text;
                else interim += text;
            }
            const display = finalText || interim;
            if (chatInput && display) {
                chatInput.value = display;
                chatInput.style.borderColor = "#22c55e";
                setTimeout(() => { if (chatInput) chatInput.style.borderColor = ""; }, 700);
            }
            if (finalText) window.LingoLog?.add(`✅ STT確定: "${finalText}"`);
            else if (interim) window.LingoLog?.add(`🔄 STT中間: "${interim}"`);
        };

        this.recognition.onerror = (event) => {
            const err = event.error;
            window.LingoLog?.add(`⚠️ STTエラー: ${err}`);

            if (err === "network") {
                const now = Date.now();
                // 1回だけ自動リトライ
                if (this.retryCount < 1 && (now - this.lastNetworkErrTime) > 2000) {
                    this.retryCount++;
                    this.lastNetworkErrTime = now;
                    window.LingoLog?.add("🔄 Networkエラー: 1秒後にリトライ...");
                    this.isListening = false;
                    this.stopVUAnim();
                    try { this.recognition.abort(); } catch(e) {}
                    setTimeout(() => { if (!this.isListening) this.start(); }, 1000);
                    return;
                }
                window.LingoLog?.add("❌ Googleブラウザ音声認識サーバーへの接続に失敗しました。ネットワーク環境をご確認ください。");
                this.setVUStatus("⚠️ ERR", "#ef4444", "接続失敗", "#ef4444");
            } else if (err === "no-speech") {
                window.LingoLog?.add("🔇 no-speech: 声が検出できませんでした");
            }

            if (err !== "aborted") this.stop(`エラー停止: ${err}`);
        };

        this.recognition.onend = () => {
            window.LingoLog?.add(`🔚 SpeechRecognition.onend (isListening=${this.isListening})`);
            if (!this.isListening) return;

            if (finalText) {
                this.stop("認識完了");
            } else {
                // テキスト未確定 → 継続リスニング
                window.LingoLog?.add("🔄 再起動 (テキスト未確定)...");
                setTimeout(() => {
                    if (this.isListening && this.recognition) {
                        try { this.recognition.start(); }
                        catch(e) { this.stop(`再起動失敗: ${e.message}`); }
                    }
                }, 100);
            }
        };

        // ── 起動 ──
        try {
            this.recognition.start();
            window.LingoLog?.add("▶️ SpeechRecognition.start() 呼び出し");
        } catch(e) {
            window.LingoLog?.add(`❌ SpeechRecognition 起動失敗: ${e.message}`);
            this.stop(`起動エラー: ${e.message}`);
        }
    },

    // =============================================
    // 録音停止
    // =============================================
    stop(reason = "") {
        if (reason) window.LingoLog?.add(`🛑 停止 [${reason}]`);

        this.isListening = false;
        this.clearAllTimers();
        this.stopVUAnim();

        if (this.recognition) {
            try { this.recognition.abort(); } catch(e) {}
            this.recognition = null;
        }

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
        // SpeechRecognition がマイクを解放するまで少し待ってから Ambient VU 再開
        setTimeout(() => this.startAmbientVU(), 500);
    },

    // =============================================
    // 発音練習用 STT (別インスタンス)
    // =============================================
    async listenForPronunciation(targetText, callback) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { if (callback) callback(targetText, "Not supported"); return; }

        this.stopAmbientVU();
        await new Promise(r => setTimeout(r, 250));

        try {
            const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
            tmp.getTracks().forEach(t => t.stop());
        } catch(e) {
            window.LingoLog?.add(`⚠️ 発音マイクエラー: ${e.message}`);
            if (callback) callback("", e.message);
            setTimeout(() => this.startAmbientVU(), 400);
            return;
        }
        await new Promise(r => setTimeout(r, 100));

        const lang   = this.getRecognitionLang();
        const pronRec = new SR();
        pronRec.lang            = lang;
        pronRec.continuous      = false;
        pronRec.interimResults  = true;
        pronRec.maxAlternatives = 1;

        let captured  = "";
        let finished  = false;
        let pronTimer = setTimeout(() => finishPron(), 10000);

        const finishPron = () => {
            if (finished) return;
            finished = true;
            clearTimeout(pronTimer);
            try { pronRec.abort(); } catch(e) {}
            window.LingoLog?.add(`✅ 発音STT完了: "${captured || "(なし)"}"`);
            if (callback) callback(captured || "", null);
            setTimeout(() => this.startAmbientVU(), 400);
        };

        pronRec.onspeechend = () => {
            clearTimeout(pronTimer);
            pronTimer = setTimeout(() => finishPron(), 1500);
        };

        pronRec.onresult = (e) => {
            let txt = "";
            for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
            if (txt) captured = txt;
        };

        pronRec.onerror = (e) => {
            window.LingoLog?.add(`⚠️ 発音STTエラー: ${e.error}`);
            finishPron();
        };

        pronRec.onend = () => finishPron();

        try {
            pronRec.start();
            window.LingoLog?.add(`🎙️ 発音STT開始 [${lang}]`);
        } catch(e) {
            window.LingoLog?.add(`❌ 発音STT起動失敗: ${e.message}`);
            finishPron();
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoSTT.init();
});
