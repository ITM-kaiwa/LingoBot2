// Web Speech STT Engine & Pronunciation Analyzer - LingoBot2 Ver6.0β
// FIXED: continuous=false で確実停止, 音量VUメーター表示, 3秒無音AUTO-OFFの正確な実装
window.LingoSTT = {
    recognition: null,
    isListening: false,
    silenceTimer: null,
    audioContext: null,
    analyser: null,
    micStream: null,       // getUserMedia stream (VUメーター用)
    vuInterval: null,      // VUメーター更新インターバル
    retryCount: 0,
    lastNetworkErrTime: 0,

    // =============================================
    // 初期化: ボタンにイベントリスナーを追加
    // =============================================
    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.LingoLog?.add("⚠️ このブラウザはWeb Speech API (SpeechRecognition) に対応していません。Google Chromeをご利用ください。");
            return;
        }

        const micBtn = document.getElementById("micBtn");
        if (micBtn) {
            micBtn.addEventListener("click", () => this.toggleListening());
        }

        window.LingoLog?.add("Khởi tạo Web Speech STT Engine (LingoBot2 Ver6.0β - VU Meter & 3s Silence Auto-OFF) thành công.");
    },

    // =============================================
    // 言語設定取得
    // =============================================
    getRecognitionLang() {
        const targetLang = window.LingoApp?.targetLang ?? "jp 日本語";
        if (targetLang.includes("日本語") || targetLang.includes("jp")) return "ja-JP";
        if (targetLang.includes("English") || targetLang.includes("us"))  return "en-US";
        if (targetLang.includes("Việt") || targetLang.includes("vn"))     return "vi-VN";
        return "ja-JP";
    },

    // =============================================
    // マイクの録音切替
    // =============================================
    toggleListening() {
        if (this.isListening) {
            this.stop("ユーザーによる手動停止");
        } else {
            this.retryCount = 0;
            this.start();
        }
    },

    // =============================================
    // VUメーター: マイク音量をリアルタイム表示
    // =============================================
    async startVUMeter() {
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            const source = this.audioContext.createMediaStreamSource(this.micStream);
            source.connect(this.analyser);

            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            const micBtn = document.getElementById("micBtn");
            const vuBar = document.getElementById("vuMeterBar");
            const vuWrap = document.getElementById("vuMeterWrap");

            if (vuWrap) vuWrap.style.display = "flex";

            this.vuInterval = setInterval(() => {
                this.analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                const level = Math.min(100, Math.round(avg * 2.5));

                // VUバー更新
                if (vuBar) {
                    vuBar.style.width = `${level}%`;
                    vuBar.style.background = level > 60
                        ? `linear-gradient(90deg, #f97316, #ef4444)`
                        : level > 20
                            ? `linear-gradient(90deg, #22c55e, #f97316)`
                            : `linear-gradient(90deg, #3b82f6, #22c55e)`;
                }

                // マイクボタンのパルス強度を音量で変える
                if (micBtn && this.isListening) {
                    const scale = 1 + level * 0.002;
                    micBtn.style.transform = `scale(${scale})`;
                }

                // 音量が拾えていることをログに（1秒に1回程度）
                if (avg > 5) {
                    // 音声入力あり: サイレンスタイマーをリセット
                    this._soundDetectedAt = Date.now();
                }
            }, 80);

            return true;
        } catch (err) {
            window.LingoLog?.add(`⚠️ マイクアクセスエラー: ${err.message} — ブラウザのマイク許可設定をご確認ください。`);
            return false;
        }
    },

    // =============================================
    // VUメーター停止 & マイクストリーム解放
    // =============================================
    stopVUMeter() {
        if (this.vuInterval) {
            clearInterval(this.vuInterval);
            this.vuInterval = null;
        }
        if (this.analyser) {
            try { this.analyser.disconnect(); } catch(e) {}
            this.analyser = null;
        }
        if (this.audioContext) {
            try { this.audioContext.close(); } catch(e) {}
            this.audioContext = null;
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }

        const micBtn = document.getElementById("micBtn");
        if (micBtn) micBtn.style.transform = "";

        const vuWrap = document.getElementById("vuMeterWrap");
        const vuBar  = document.getElementById("vuMeterBar");
        if (vuWrap) vuWrap.style.display = "none";
        if (vuBar)  vuBar.style.width = "0%";
    },

    // =============================================
    // 3秒無音タイマー
    // =============================================
    resetSilenceTimer() {
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
            window.LingoLog?.add("⏱️ 無音3秒が経過したため、自動的にマイクをOFFにしました。");
            this.stop("3秒無音AUTO-OFF");
        }, 3000);
    },

    clearSilenceTimer() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    },

    // =============================================
    // STT開始
    // =============================================
    async start() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        // 既存の認識を安全に停止
        if (this.recognition) {
            try { this.recognition.abort(); } catch(e) {}
            this.recognition = null;
            await new Promise(r => setTimeout(r, 150));
        }

        // VUメーター起動（マイク権限確認も兼ねる）
        const hasMic = await this.startVUMeter();
        if (!hasMic) {
            window.LingoLog?.add("❌ マイクを起動できませんでした。ブラウザのマイク許可をご確認ください。");
            return;
        }

        const micBtn   = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");
        const lang     = this.getRecognitionLang();

        // 状態更新
        this.isListening = true;
        this.retryCount  = this.retryCount || 0;

        if (micBtn) {
            micBtn.classList.add("recording");
            const iconEl = document.getElementById("micIconSymbol");
            if (iconEl) iconEl.textContent = "⏹️";
        }
        if (chatInput) {
            chatInput.classList.add("mic-active");
            chatInput.placeholder = "🎙️ 話してください… (発話後3秒で自動停止)";
            chatInput.value = "";
        }

        window.LingoLog?.add(`🎙️ 録音開始 [言語: ${lang}] — 発話後3秒無音で自動停止`);

        // SpeechRecognition設定
        // IMPORTANT: continuous=false が最も安定。発話ごとに1回認識して止まる。
        this.recognition = new SpeechRecognition();
        this.recognition.continuous      = false;   // ← これが重要! trueにするとマイクが止まらない
        this.recognition.interimResults  = true;
        this.recognition.maxAlternatives = 1;
        this.recognition.lang            = lang;

        let finalTranscript   = "";
        let hasReceivedResult = false;

        // 結果受信
        this.recognition.onresult = (event) => {
            hasReceivedResult = true;
            this.resetSilenceTimer(); // 音声が来たらタイマーリセット

            let interimText = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += text;
                } else {
                    interimText += text;
                }
            }

            // リアルタイムでテキスト入力欄に反映
            const displayText = finalTranscript || interimText;
            if (chatInput && displayText) {
                chatInput.value = displayText;
                // 入力フィールドの変化を視覚的に示す
                chatInput.style.borderColor = "#22c55e";
                setTimeout(() => { chatInput.style.borderColor = ""; }, 500);
            }

            if (finalTranscript) {
                window.LingoLog?.add(`✅ 音声認識結果 (確定): "${finalTranscript}"`);
            } else if (interimText) {
                window.LingoLog?.add(`🔄 音声認識中 (暫定): "${interimText}"`);
            }
        };

        // エラー処理
        this.recognition.onerror = (event) => {
            const errName = event.error;
            window.LingoLog?.add(`⚠️ STTエラー: ${errName}`);

            // networkエラーは短時間内に2回まで自動リトライ
            if (errName === "network") {
                const now = Date.now();
                if (this.retryCount < 2 && (now - this.lastNetworkErrTime) > 2000) {
                    this.retryCount++;
                    this.lastNetworkErrTime = now;
                    window.LingoLog?.add(`🔄 Networkエラー: 自動リトライ ${this.retryCount}/2 回目...`);
                    this.stopVUMeter();
                    this.clearSilenceTimer();
                    this.isListening = false;
                    setTimeout(() => this.start(), 600);
                    return;
                }
                window.LingoLog?.add("❌ 音声認識のネットワークエラーが続いています。インターネット接続またはGoogleへのアクセスをご確認ください。");
            }

            // no-speech: 音声なし → 静かに停止
            if (errName === "no-speech") {
                window.LingoLog?.add("🔇 音声が検出されませんでした。");
            }

            if (errName !== "aborted") {
                this.stop(`エラー停止: ${errName}`);
            }
        };

        // 認識セッション終了 (continuous=false なので1発話ごとに呼ばれる)
        this.recognition.onend = () => {
            window.LingoLog?.add(`🔚 SpeechRecognition.onend 発火 — isListening: ${this.isListening}`);

            if (this.isListening) {
                // まだ聞く状態なら: finalTranscriptがあれば停止、なければ継続
                if (finalTranscript) {
                    // 認識できた → 停止
                    this.stop("発話認識完了");
                } else {
                    // まだ何も認識できていない → 再試行
                    window.LingoLog?.add("🔄 継続録音のため再起動...");
                    try {
                        setTimeout(() => {
                            if (this.isListening) this.recognition.start();
                        }, 100);
                    } catch(e) {
                        this.stop(`再起動失敗: ${e.message}`);
                    }
                }
            }
        };

        // 認識開始
        try {
            this.recognition.start();
            // 開始から音声なしの場合のための初期タイマー（8秒で強制停止）
            this.silenceTimer = setTimeout(() => {
                window.LingoLog?.add("⏱️ 8秒間音声なし → 自動停止");
                this.stop("8秒タイムアウト");
            }, 8000);
        } catch (e) {
            window.LingoLog?.add(`❌ STT起動失敗: ${e.message}`);
            this.stop(`起動エラー: ${e.message}`);
        }
    },

    // =============================================
    // STT停止 (確実にマイクを解放する)
    // =============================================
    stop(reason = "") {
        if (reason) window.LingoLog?.add(`🛑 マイク停止 [理由: ${reason}]`);

        // フラグを先に落とす (onend での無限ループ防止)
        this.isListening = false;

        this.clearSilenceTimer();
        this.stopVUMeter();

        // SpeechRecognition を停止
        if (this.recognition) {
            try { this.recognition.abort(); } catch(e) {}
            this.recognition = null;
        }

        // UI更新
        const micBtn    = document.getElementById("micBtn");
        const chatInput = document.getElementById("chatInput");
        const iconEl    = document.getElementById("micIconSymbol");

        if (micBtn) {
            micBtn.classList.remove("recording");
            micBtn.style.transform = "";
        }
        if (iconEl) iconEl.textContent = "🎙️";

        if (chatInput) {
            chatInput.classList.remove("mic-active");
            chatInput.style.borderColor = "";
            const dict = (window.LingoApp?.i18n?.[window.LingoApp?.uiLang]) || {};
            chatInput.placeholder = dict.placeholder || "メッセージを入力するか、マイクで話してください…";
        }

        // 入力されたテキストをログに記録
        const inputEl = document.getElementById("chatInput");
        if (inputEl?.value?.trim()) {
            window.LingoLog?.add(`📝 入力欄に反映されたテキスト: "${inputEl.value}"`);
        }
    },

    // =============================================
    // 発音練習用STT (別途管理)
    // =============================================
    async listenForPronunciation(targetText, callback) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.LingoLog?.add("⚠️ Web Speech API not supported for pronunciation analysis.");
            if (callback) callback(targetText, "Not supported");
            return;
        }

        let pronStream = null;
        try {
            pronStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch(e) {
            window.LingoLog?.add(`⚠️ 発音練習マイクアクセスエラー: ${e.message}`);
            if (callback) callback(targetText, e.message);
            return;
        }

        const pronRec = new SpeechRecognition();
        pronRec.continuous      = false;
        pronRec.interimResults  = true;
        pronRec.maxAlternatives = 1;

        let recLang = "ja-JP";
        const targetLangSelect = window.LingoApp?.targetLang ?? "jp 日本語";
        if (targetLangSelect.includes("English") || targetLangSelect.includes("us")) recLang = "en-US";
        if (targetLangSelect.includes("Việt") || targetLangSelect.includes("vn"))    recLang = "vi-VN";
        pronRec.lang = recLang;

        window.LingoLog?.add(`🎙️ 発音録音開始 [言語: ${recLang}] — "${targetText}"`);

        let capturedText  = "";
        let hasFinished   = false;
        let pronSilTimer  = null;

        const finishPron = (err = null) => {
            if (hasFinished) return;
            hasFinished = true;
            if (pronSilTimer) clearTimeout(pronSilTimer);
            try { pronRec.abort(); } catch(e) {}
            if (pronStream) pronStream.getTracks().forEach(t => t.stop());
            window.LingoLog?.add(`✅ 発音録音完了: "${capturedText || "(なし)"}"`);
            if (callback) callback(capturedText || "", err);
        };

        const resetPronSilence = () => {
            if (pronSilTimer) clearTimeout(pronSilTimer);
            pronSilTimer = setTimeout(() => {
                window.LingoLog?.add("⏱️ 発音練習: 無音3秒 → 自動停止");
                finishPron();
            }, 3000);
        };

        // 開始から8秒タイムアウト
        pronSilTimer = setTimeout(() => { finishPron(); }, 8000);

        pronRec.onresult = (event) => {
            resetPronSilence();
            let resultText = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                resultText += event.results[i][0].transcript;
            }
            if (resultText) capturedText = resultText;
        };

        pronRec.onerror = (event) => {
            window.LingoLog?.add(`⚠️ 発音録音エラー: ${event.error}`);
            finishPron(event.error);
        };

        pronRec.onend = () => {
            finishPron();
        };

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
