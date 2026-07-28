// Web Speech STT Engine & Pronunciation Analyzer - LingoBot2 Ver6.1β
// ROOT CAUSE FIX: getUserMedia (VU) stream was conflicting with SpeechRecognition's
// internal stream, causing immediate "network" errors on recognition.start().
// Solution: Separate Ambient VU mode (getUserMedia) vs Recording mode (onsound* events).
//   - STANDBY: getUserMedia for real VU level display
//   - RECORDING: release getUserMedia → SpeechRecognition gets exclusive mic access
//                onsoundstart/onsoundend drive VU bar animation instead
window.LingoSTT = {
    recognition:  null,
    isListening:  false,
    silenceTimer: null,
    retryCount:   0,
    lastNetworkErrTime: 0,

    // ── Ambient VU meter (standby mode, getUserMedia) ──
    ambientStream:   null,
    ambientContext:  null,
    ambientAnalyser: null,
    ambientInterval: null,

    // ── Recording VU animation (recording mode, CSS-driven) ──
    vuAnimInterval: null,
    vuLevel: 0,
    vuDirection: 1,

    // =============================================
    // 初期化
    // =============================================
    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.setVUStatus("非対応", "#ef4444", "STT非対応ブラウザ");
            window.LingoLog?.add("⚠️ このブラウザはSpeechRecognitionに対応していません。Google Chromeをご利用ください。");
            return;
        }

        const micBtn = document.getElementById("micBtn");
        if (micBtn) micBtn.addEventListener("click", () => this.toggleListening());

        // スタンバイ時のVU: ページ読み込み後に ambient 監視を開始
        setTimeout(() => this.startAmbientVU(), 800);

        window.LingoLog?.add("Khởi tạo Web Speech STT Engine (LingoBot2 Ver6.1β - Ambient VU + Exclusive Mic Fix) thành công.");
    },

    // =============================================
    // VUバー共通ヘルパー
    // =============================================
    setVULevel(pct) {
        const bar = document.getElementById("vuMeterBar");
        if (!bar) return;
        bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        if (pct > 60)      bar.style.background = "linear-gradient(90deg,#f97316,#ef4444)";
        else if (pct > 20) bar.style.background = "linear-gradient(90deg,#22c55e,#f97316)";
        else if (pct > 0)  bar.style.background = "linear-gradient(90deg,#3b82f6,#22c55e)";
        else               bar.style.background = "linear-gradient(90deg,#3b82f6,#22c55e)";
    },

    setVUStatus(labelText, labelColor, statusText, statusColor) {
        const label  = document.getElementById("vuMeterLabel");
        const status = document.getElementById("vuMeterStatus");
        if (label)  { label.textContent = labelText;  label.style.color  = labelColor || "#94a3b8"; }
        if (status) { status.textContent = statusText; status.style.color = statusColor || labelColor || "#cbd5e1"; }
    },

    // =============================================
    // Ambient VU (スタンバイ時) — getUserMedia使用
    // 録音開始前に必ず stopAmbientVU() を呼ぶこと
    // =============================================
    async startAmbientVU() {
        this.stopAmbientVU(); // 重複防止
        try {
            this.ambientStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.ambientContext  = new (window.AudioContext || window.webkitAudioContext)();
            this.ambientAnalyser = this.ambientContext.createAnalyser();
            this.ambientAnalyser.fftSize = 256;
            const src = this.ambientContext.createMediaStreamSource(this.ambientStream);
            src.connect(this.ambientAnalyser);

            const data = new Uint8Array(this.ambientAnalyser.frequencyBinCount);
            this.setVUStatus("🎙️ MIC", "#22c55e", "スタンバイ中", "#94a3b8");

            this.ambientInterval = setInterval(() => {
                if (this.isListening) return; // 録音中は更新しない
                this.ambientAnalyser.getByteFrequencyData(data);
                const avg   = data.reduce((a, b) => a + b, 0) / data.length;
                const level = Math.min(100, Math.round(avg * 2.5));
                this.setVULevel(level);
            }, 80);

            window.LingoLog?.add("✅ Ambient VUモニター開始 (マイク権限確認済み)");
        } catch (e) {
            // 未許可または他のエラー → 静かに無視 (録音ボタンを押せば改めて許可を求める)
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
    // 録音中VU アニメーション (CSSドリブン)
    // onsoundstart / onsoundend で起動・停止
    // =============================================
    startRecordingVUAnim(highEnergy = false) {
        this.stopRecordingVUAnim();
        const target = highEnergy ? 70 : 35;
        this.vuLevel = 5;
        this.vuDirection = 1;
        this.vuAnimInterval = setInterval(() => {
            this.vuLevel += this.vuDirection * (Math.random() * 8 + 3);
            if (this.vuLevel >= target + Math.random() * 20) this.vuDirection = -1;
            if (this.vuLevel <= 5) this.vuDirection = 1;
            this.vuLevel = Math.max(3, Math.min(100, this.vuLevel));
            this.setVULevel(this.vuLevel);
        }, 80);
    },

    stopRecordingVUAnim() {
        if (this.vuAnimInterval) { clearInterval(this.vuAnimInterval); this.vuAnimInterval = null; }
        this.setVULevel(0);
    },

    // =============================================
    // 言語設定取得
    // =============================================
    getRecognitionLang() {
        const t = window.LingoApp?.targetLang ?? "jp 日本語";
        if (t.includes("日本語") || t.includes("jp")) return "ja-JP";
        if (t.includes("English") || t.includes("us")) return "en-US";
        if (t.includes("Việt") || t.includes("vn"))    return "vi-VN";
        return "ja-JP";
    },

    // =============================================
    // 録音切替
    // =============================================
    toggleListening() {
        if (this.isListening) {
            this.stop("ユーザー手動停止");
        } else {
            this.retryCount = 0;
            this.start();
        }
    },

    // =============================================
    // 3秒無音タイマー
    // =============================================
    resetSilenceTimer() {
        this.clearSilenceTimer();
        this.silenceTimer = setTimeout(() => {
            window.LingoLog?.add("⏱️ 無音3秒経過 → 自動停止");
            this.stop("3秒無音AUTO-OFF");
        }, 3000);
    },

    clearSilenceTimer() {
        if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
    },

    // =============================================
    // STT 開始
    // =============================================
    async start() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        // --- 既存の認識を停止 ---
        if (this.recognition) {
            try { this.recognition.abort(); } catch(e) {}
            this.recognition = null;
            await new Promise(r => setTimeout(r, 100));
        }

        // ─────────────────────────────────────────────────
        // 重要: Ambient VU (getUserMedia) を必ず先に停止する
        // これにより SpeechRecognition がマイクを独占できる
        // getUserMedia と SpeechRecognition の同時使用が
        // "network" エラーの根本原因
        // ─────────────────────────────────────────────────
        this.stopAmbientVU();
        await new Promise(r => setTimeout(r, 150)); // ストリーム解放を待つ

        // マイク権限を確認 (ユーザーに許可ダイアログを表示する役割も)
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            tempStream.getTracks().forEach(t => t.stop()); // 即座に解放
        } catch(e) {
            window.LingoLog?.add(`❌ マイクアクセス拒否: ${e.message}`);
            this.setVUStatus("🎙️ MIC", "#ef4444", "マイクアクセス拒否", "#ef4444");
            this.startAmbientVU(); // ambient再開
            return;
        }

        const lang = this.getRecognitionLang();
        this.isListening = true;

        // UI更新
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

        this.setVUStatus("🔴 REC", "#ef4444", "待機中…", "#f97316");
        this.setVULevel(0);

        window.LingoLog?.add(`🎙️ 録音開始 [言語: ${lang}] — 発話後3秒無音で自動停止`);

        // SpeechRecognition 設定
        this.recognition = new SpeechRecognition();
        this.recognition.continuous      = false; // falseで確実停止
        this.recognition.interimResults  = true;
        this.recognition.maxAlternatives = 1;
        this.recognition.lang            = lang;

        let finalTranscript   = "";

        // ── 音声検出イベントでVUアニメーション制御 ──
        this.recognition.onsoundstart = () => {
            window.LingoLog?.add("🔊 音声入力検出 (soundstart)");
            this.setVUStatus("🔴 REC", "#ef4444", "音声検出中…", "#22c55e");
            this.startRecordingVUAnim(false);
            this.resetSilenceTimer();
        };

        this.recognition.onspeechstart = () => {
            window.LingoLog?.add("🗣️ 発話検出 (speechstart)");
            this.setVUStatus("🔴 REC", "#ef4444", "発話中…", "#22c55e");
            this.startRecordingVUAnim(true); // より活発なアニメーション
        };

        this.recognition.onspeechend = () => {
            window.LingoLog?.add("🔇 発話終了 (speechend)");
            this.setVUStatus("🔴 REC", "#ef4444", "解析中…", "#f97316");
            this.stopRecordingVUAnim();
        };

        this.recognition.onsoundend = () => {
            this.stopRecordingVUAnim();
            this.resetSilenceTimer();
        };

        // ── 認識結果 ──
        this.recognition.onresult = (event) => {
            this.resetSilenceTimer();
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += text;
                } else {
                    interim += text;
                }
            }

            const display = finalTranscript || interim;
            if (chatInput && display) {
                chatInput.value = display;
                chatInput.style.borderColor = "#22c55e";
                setTimeout(() => { if (chatInput) chatInput.style.borderColor = ""; }, 600);
            }

            if (finalTranscript)   window.LingoLog?.add(`✅ 音声認識(確定): "${finalTranscript}"`);
            else if (interim)      window.LingoLog?.add(`🔄 認識中(暫定): "${interim}"`);
        };

        // ── エラー処理 ──
        this.recognition.onerror = (event) => {
            const err = event.error;
            window.LingoLog?.add(`⚠️ STTエラー: ${err}`);

            if (err === "network") {
                const now = Date.now();
                if (this.retryCount < 2 && (now - this.lastNetworkErrTime) > 1500) {
                    this.retryCount++;
                    this.lastNetworkErrTime = now;
                    window.LingoLog?.add(`🔄 Networkエラー: 自動リトライ ${this.retryCount}/2 回目 (0.8秒後)...`);
                    this.isListening = false;
                    this.stopRecordingVUAnim();
                    // 認識を一旦止めてからリトライ (abort→ delay → start)
                    try { this.recognition.abort(); } catch(e) {}
                    setTimeout(() => {
                        if (!this.isListening) this.start();
                    }, 800);
                    return;
                }
                window.LingoLog?.add("❌ Networkエラーが解消しません。インターネット接続・Googleアクセスをご確認ください。");
                this.setVUStatus("🎙️ MIC", "#ef4444", "接続エラー", "#ef4444");
            }

            if (err === "no-speech") {
                window.LingoLog?.add("🔇 音声なし (no-speech)");
            }

            if (err !== "aborted") {
                this.stop(`エラー停止: ${err}`);
            }
        };

        // ── セッション終了 ──
        this.recognition.onend = () => {
            window.LingoLog?.add(`🔚 SpeechRecognition.onend — isListening: ${this.isListening}, transcript: "${finalTranscript}"`);

            if (this.isListening) {
                if (finalTranscript) {
                    // 認識完了 → 停止
                    this.stop("発話認識完了");
                } else {
                    // 認識なし → 継続
                    window.LingoLog?.add("🔄 認識継続のため再起動...");
                    setTimeout(() => {
                        if (this.isListening && this.recognition) {
                            try { this.recognition.start(); }
                            catch(e) { this.stop(`再起動失敗: ${e.message}`); }
                        }
                    }, 150);
                }
            }
        };

        // 開始タイムアウト (8秒で強制停止)
        this.clearSilenceTimer();
        this.silenceTimer = setTimeout(() => {
            window.LingoLog?.add("⏱️ 8秒間音声なし → 強制停止");
            this.stop("8秒タイムアウト");
        }, 8000);

        // SpeechRecognition 起動
        try {
            this.recognition.start();
            window.LingoLog?.add("▶️ SpeechRecognition.start() 呼び出し完了");
        } catch (e) {
            window.LingoLog?.add(`❌ STT起動失敗: ${e.message}`);
            this.stop(`起動エラー: ${e.message}`);
        }
    },

    // =============================================
    // STT 停止 (確実にマイク解放 + Ambient VU再開)
    // =============================================
    stop(reason = "") {
        if (reason) window.LingoLog?.add(`🛑 マイク停止 [理由: ${reason}]`);

        this.isListening = false;
        this.clearSilenceTimer();
        this.stopRecordingVUAnim();

        if (this.recognition) {
            try { this.recognition.abort(); } catch(e) {}
            this.recognition = null;
        }

        // UI 元に戻す
        const micBtn    = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");
        const iconEl    = document.getElementById("micIconSymbol");

        if (micBtn)  { micBtn.classList.remove("recording"); micBtn.style.transform = ""; }
        if (iconEl)  iconEl.textContent = "🎙️";
        if (chatInput) {
            chatInput.classList.remove("mic-active");
            chatInput.style.borderColor = "";
            const dict = window.LingoApp?.i18n?.[window.LingoApp?.uiLang] || {};
            chatInput.placeholder = dict.placeholder || "メッセージを入力するか、マイクで話してください…";
        }

        if (chatInput?.value?.trim()) {
            window.LingoLog?.add(`📝 入力欄テキスト: "${chatInput.value}"`);
        }

        // Ambient VU を少し遅れて再開 (SpeechRecognition がマイクを完全解放するのを待つ)
        setTimeout(() => this.startAmbientVU(), 400);
    },

    // =============================================
    // 発音練習用STT
    // =============================================
    async listenForPronunciation(targetText, callback) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            if (callback) callback(targetText, "Not supported");
            return;
        }

        // Ambient VU を一時停止してマイクを解放
        this.stopAmbientVU();
        await new Promise(r => setTimeout(r, 150));

        // 権限確認
        let pronStream = null;
        try {
            pronStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            pronStream.getTracks().forEach(t => t.stop()); // 即解放
        } catch(e) {
            window.LingoLog?.add(`⚠️ 発音練習マイクエラー: ${e.message}`);
            if (callback) callback(targetText, e.message);
            this.startAmbientVU();
            return;
        }

        const pronRec = new SpeechRecognition();
        pronRec.continuous      = false;
        pronRec.interimResults  = true;
        pronRec.maxAlternatives = 1;

        let recLang = "ja-JP";
        const tl = window.LingoApp?.targetLang ?? "jp 日本語";
        if (tl.includes("English") || tl.includes("us")) recLang = "en-US";
        if (tl.includes("Việt") || tl.includes("vn"))    recLang = "vi-VN";
        pronRec.lang = recLang;

        window.LingoLog?.add(`🎙️ 発音録音開始 [言語: ${recLang}] — "${targetText}"`);

        let capturedText = "";
        let hasFinished  = false;
        let pronTimer    = setTimeout(() => finishPron(), 10000);

        const finishPron = (err = null) => {
            if (hasFinished) return;
            hasFinished = true;
            clearTimeout(pronTimer);
            try { pronRec.abort(); } catch(e) {}
            window.LingoLog?.add(`✅ 発音録音完了: "${capturedText || "(なし)"}"`);
            if (callback) callback(capturedText || "", err);
            setTimeout(() => this.startAmbientVU(), 400);
        };

        pronRec.onsoundstart  = () => { clearTimeout(pronTimer); pronTimer = setTimeout(() => finishPron(), 5000); };
        pronRec.onspeechend   = () => { clearTimeout(pronTimer); pronTimer = setTimeout(() => finishPron(), 1500); };

        pronRec.onresult = (e) => {
            let txt = "";
            for (let i = e.resultIndex; i < e.results.length; ++i) txt += e.results[i][0].transcript;
            if (txt) capturedText = txt;
        };
        pronRec.onerror = (e) => {
            window.LingoLog?.add(`⚠️ 発音録音エラー: ${e.error}`);
            finishPron(e.error);
        };
        pronRec.onend = () => finishPron();

        try {
            pronRec.start();
        } catch(e) {
            window.LingoLog?.add(`❌ 発音録音起動失敗: ${e.message}`);
            finishPron(e.message);
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoSTT.init();
});
