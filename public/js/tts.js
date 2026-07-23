// TTS Engine Module - LingoBot2 Ver1.50 Implementation
window.LingoTTS = {
    audioElement: null,
    isPlaying: false,

    // Abbreviated TTS Model map for header badge
    ttsBadgeMap: {
        "browser-native": "Web-Speech",
        "ja-JP-Chirp3-HD-F": "JP-Chirp(♀)",
        "ja-JP-Chirp3-HD-M": "JP-Chirp(♂)",
        "en-US-Chirp3-HD-F": "EN-Chirp(♀)",
        "en-US-Chirp3-HD-M": "EN-Chirp(♂)",
        "ja-JP-Neural2-B": "JP-Neural2(♂)",
        "en-US-Neural2-F": "EN-Neural2(♀)",
        "vi-VN-Neural2-A": "VN-Neural2(♀)"
    },

    updateActiveTtsBadge(modelValue) {
        const badgeEl = document.getElementById("activeTtsBadge");
        if (!badgeEl) return;
        const abbr = this.ttsBadgeMap[modelValue] || modelValue;
        badgeEl.textContent = abbr;

        if (modelValue === "browser-native") {
            badgeEl.style.background = "#fef3c7";
            badgeEl.style.color = "#d97706";
            badgeEl.style.borderColor = "#fde68a";
        } else {
            badgeEl.style.background = "#e0f2fe";
            badgeEl.style.color = "#0284c7";
            badgeEl.style.borderColor = "#bae6fd";
        }
    },

    stop() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.audioElement = null;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        this.isPlaying = false;
        
        // Reset all play buttons UI
        const dict = window.LingoApp ? (window.LingoApp.i18n[window.LingoApp.uiLang] || window.LingoApp.i18n["tiếng Việt"]) : { btnPlay: "▶ Phát" };
        document.querySelectorAll(".btn-play, .btn-sample-play").forEach(btn => {
            btn.classList.remove("playing");
            btn.textContent = dict.btnPlay || "▶ Phát";
        });
        window.LingoLog.add("Đã dừng phát âm thanh.");
    },

    async playText(text, playBtnElement = null) {
        if (!text) return;
        this.stop();

        const dict = window.LingoApp ? (window.LingoApp.i18n[window.LingoApp.uiLang] || window.LingoApp.i18n["tiếng Việt"]) : { btnPlay: "▶ Phát", btnStop: "⏹ STOP" };

        if (playBtnElement) {
            playBtnElement.classList.add("playing");
            playBtnElement.textContent = dict.btnStop || "⏹ STOP";
        }

        const ttsSelect = document.getElementById("ttsModelSelect");
        const selectedVoice = ttsSelect ? ttsSelect.value : "ja-JP-Chirp3-HD-F";
        this.updateActiveTtsBadge(selectedVoice);

        // Clean text for TTS (remove ruby markings)
        const cleanText = text.replace(/[\u3400-\u4dbf\u4e00-\u9fff]+（([\u3040-\u309f\u30a0-\u30ff\s]+)）/g, '$1')
                             .replace(/\(.*?\)/g, '')
                             .replace(/【.*?】/g, '');

        // -------------------------------------------------------------------
        # OPTION A: User Explicitly Selected "Browser Native (Web Speech API)"
        // -------------------------------------------------------------------
        if (selectedVoice === "browser-native") {
            window.LingoLog.add(`Phát âm thanh [Voice: ブラウザ標準音声 (Web Speech API)]: "${cleanText.substring(0, 30)}..."`);
            this.playBrowserNativeSpeech(cleanText, playBtnElement);
            return;
        }

        // -------------------------------------------------------------------
        # OPTION B: Cloud TTS API Call via Vercel Backend (/api/tts)
        // -------------------------------------------------------------------
        window.LingoLog.add(`Yêu cầu Google Cloud TTS [Voice: ${selectedVoice}]: "${cleanText.substring(0, 30)}..."`);

        try {
            const reqPayload = {
                text: cleanText,
                voice_name: selectedVoice
            };

            const apiKey = window.LingoApp ? window.LingoApp.getApiKey() : "";
            if (apiKey && apiKey.trim().length > 5) {
                reqPayload.api_key = apiKey.trim();
            }

            const response = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqPayload)
            });

            const data = await response.json();

            if (data.audio_url) {
                this.audioElement = new Audio(data.audio_url);
                this.isPlaying = true;
                
                if (playBtnElement) {
                    playBtnElement._cachedAudioUrl = data.audio_url;
                }

                this.audioElement.onended = () => {
                    this.isPlaying = false;
                    if (playBtnElement) {
                        playBtnElement.classList.remove("playing");
                        playBtnElement.textContent = dict.btnPlay || "▶ Phát";
                    }
                };
                
                this.audioElement.onerror = () => {
                    window.LingoLog.add("Lỗi phát tệp Audio HTML5 -> Chuyển sang Web SpeechSynthesis trình duyệt dự phòng...");
                    this.playBrowserNativeSpeech(cleanText, playBtnElement);
                };

                await this.audioElement.play();
                window.LingoLog.add(`Phát âm thanh Google Cloud TTS thành công! [Model: ${data.model_used || selectedVoice}]`);
            } else if (data.fallback_browser) {
                window.LingoLog.add(`Google Cloud TTS API (${data.error || 'Yêu cầu dự phòng'}). Chuyển sang Web SpeechSynthesis trình duyệt dự phòng...`);
                this.playBrowserNativeSpeech(cleanText, playBtnElement);
            } else {
                window.LingoLog.add(`Lỗi TTS: ${data.error}. Chuyển sang Web SpeechSynthesis trình duyệt dự phòng...`);
                this.playBrowserNativeSpeech(cleanText, playBtnElement);
            }
        } catch (err) {
            window.LingoLog.add(`Lỗi kết nối TTS: ${err.message}. Chuyển sang Web SpeechSynthesis trình duyệt dự phòng...`);
            this.playBrowserNativeSpeech(cleanText, playBtnElement);
        }
    },

    playBrowserNativeSpeech(text, playBtnElement = null) {
        if (!('speechSynthesis' in window)) {
            alert("Trình duyệt của bạn không hỗ trợ Web SpeechSynthesis API.");
            if (playBtnElement) {
                const dict = window.LingoApp ? (window.LingoApp.i18n[window.LingoApp.uiLang] || window.LingoApp.i18n["tiếng Việt"]) : { btnPlay: "▶ Phát" };
                playBtnElement.classList.remove("playing");
                playBtnElement.textContent = dict.btnPlay || "▶ Phát";
            }
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        const targetLang = window.LingoApp ? window.LingoApp.targetLang : "jp 日本語";
        if (targetLang.includes("日本語")) utterance.lang = "ja-JP";
        else if (targetLang.includes("English")) utterance.lang = "en-US";
        else utterance.lang = "vi-VN";

        utterance.rate = 0.95;
        
        utterance.onend = () => {
            this.isPlaying = false;
            if (playBtnElement) {
                const dict = window.LingoApp ? (window.LingoApp.i18n[window.LingoApp.uiLang] || window.LingoApp.i18n["tiếng Việt"]) : { btnPlay: "▶ Phát" };
                playBtnElement.classList.remove("playing");
                playBtnElement.textContent = dict.btnPlay || "▶ Phát";
            }
        };

        utterance.onerror = (e) => {
            console.error("SpeechSynthesis error:", e);
            this.isPlaying = false;
            if (playBtnElement) {
                const dict = window.LingoApp ? (window.LingoApp.i18n[window.LingoApp.uiLang] || window.LingoApp.i18n["tiếng Việt"]) : { btnPlay: "▶ Phát" };
                playBtnElement.classList.remove("playing");
                playBtnElement.textContent = dict.btnPlay || "▶ Phát";
            }
        };

        this.isPlaying = true;
        window.speechSynthesis.speak(utterance);
    },

    downloadAudio(text, cachedUrl = null) {
        if (cachedUrl && cachedUrl.startsWith("data:audio")) {
            const a = document.createElement("a");
            a.href = cachedUrl;
            a.download = `lingobot_tts_${Date.now()}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.LingoLog.add("Đã tải xuống tệp âm thanh MP3.");
        } else {
            alert("Tệp âm thanh MP3 chỉ khả dụng khi phát bằng Google Cloud TTS.\n(音声MP3ファイルはGoogle Cloud TTS再生時のみダウンロード可能です)");
        }
    }
};
