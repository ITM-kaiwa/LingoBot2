import os
import json
import re
import time
import random
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

try:
    import google.auth.transport.requests
    from google.oauth2 import service_account
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.abspath(os.path.join(BASE_DIR, "../public"))

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path="")
CORS(app)

# High-quota, lightweight models prioritized first to prevent 429 quota exhaustion
PRIMARY_MODELS = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-1.5-pro"
]

SCENARIO_FALLBACK_REPLIES = {
    "空港のチェックイン会話": [
        "かしこまりました。パスポートとお手荷物を確認させていただきますね。ご搭乗券を発行いたします。",
        "承知いたしました。窓側のお席と通路側のお席のどちらがご希望でしょうか？",
        "パスポートのご提示ありがとうございます。手荷物を計量器の上にお載せいただけますか？"
    ],
    "ホテルの宿泊手続き会話": [
        "いらっしゃいませ。ご宿泊の予約確認をさせていただきます。お名前とお電話番号をお伺いできますか？",
        "かしこまりました。お部屋のお鍵をお渡しいたします。朝食は7時からご利用いただけます。",
        "ご予約ありがとうございます。チェックインの手続きをいたしますので、こちらの芳名帳にご記入ください。"
    ],
    "自己紹介の会話": [
        "はじめまして！お会いできて嬉しいです。趣味や普段されていることについて教えていただけますか？",
        "こんにちは！どうぞよろしくお願いします。最近興味を持っていることは何ですか？"
    ],
    "道案内の会話": [
        "その場所でしたら、この道を真っ直ぐ進んで最初の信号を右に曲がったところにありますよ。",
        "分かりやすい道順をお教えしますね。駅から徒歩で約5分ほどで到着します。"
    ],
    "買い物の会話": [
        "いらっしゃいませ！何かお探しの商品はございますでしょうか？ご試着もしていただけますよ。",
        "ありがとうございます。お会計は現金とクレジットカードのどちらをご利用になられますか？"
    ]
}

DEFAULT_FALLBACK_REPLIES = [
    "承知いたしました！ご要望について詳しくお聞かせいただけますか？",
    "はい、かしこまりました。続いてご不明な点や気になることはございますか？",
    "ありがとうございます！その件について詳しく確認させていただきますね。"
]

def get_smart_fallback_reply(scenario_name):
    """Generate instant role response when Google API Quota limit (429) occurs"""
    for key, replies in SCENARIO_FALLBACK_REPLIES.items():
        if key in scenario_name or scenario_name in key:
            return random.choice(replies)
    return random.choice(DEFAULT_FALLBACK_REPLIES)

def resolve_api_key(client_key):
    """
    Priority:
    1. If client explicitly provided a valid key (>5 chars), use client_key.
    2. Otherwise, read GOOGLE_API_KEY from Environment Variable if set.
    """
    if client_key and isinstance(client_key, str) and len(client_key.strip()) > 5:
        return client_key.strip()
    
    env_key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if env_key:
        return env_key
        
    return ""

def get_gcp_oauth2_token():
    """
    Robustly parses GCP_SERVICE_ACCOUNT_JSON from Vercel Environment Variable
    and generates OAuth2 access token using google-auth library.
    """
    service_account_info = None
    env_json = os.environ.get("GCP_SERVICE_ACCOUNT_JSON")
    
    if env_json:
        cleaned_json = env_json.strip()
        if (cleaned_json.startswith("'") and cleaned_json.endswith("'")) or (cleaned_json.startswith('"') and cleaned_json.endswith('"')):
            cleaned_json = cleaned_json[1:-1].strip()

        try:
            service_account_info = json.loads(cleaned_json)
        except Exception as e1:
            try:
                fixed_str = cleaned_json.replace('\\n', '\n')
                service_account_info = json.loads(fixed_str)
            except Exception as e2:
                print("Error parsing GCP_SERVICE_ACCOUNT_JSON env:", e1, e2)

    if not service_account_info:
        possible_paths = [
            os.path.join(BASE_DIR, "gcp_key.json"),
            os.path.join(BASE_DIR, "../gcp_key.json"),
            os.path.join(BASE_DIR, "service_account.json"),
            os.path.join(BASE_DIR, "../service_account.json")
        ]
        for path in possible_paths:
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        service_account_info = json.load(f)
                    break
                except Exception as e:
                    print(f"Error reading file {path}:", e)

    if not service_account_info:
        return None, "GCP Service Account JSON not configured"

    if GOOGLE_AUTH_AVAILABLE:
        try:
            credentials = service_account.Credentials.from_service_account_info(
                service_account_info,
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            auth_req = google.auth.transport.requests.Request()
            credentials.refresh(auth_req)
            return credentials.token, None
        except Exception as e:
            print("OAuth2 Token generation via google-auth failed:", e)

    return None, "Unable to refresh OAuth2 token"


def discover_available_gemini_models(api_key):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        res = requests.get(url, timeout=6)
        if res.status_code == 200:
            models_data = res.json().get("models", [])
            candidate_models = []
            for m in models_data:
                name = m.get("name", "").replace("models/", "")
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods and "gemini" in name.lower():
                    if name not in PRIMARY_MODELS:
                        candidate_models.append(name)
            return candidate_models
    except Exception as e:
        print("Model discovery error:", e)
    return ["gemini-1.5-flash", "gemini-2.0-flash"]


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json() or {}
        client_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        
        api_key = resolve_api_key(client_key)

        if not api_key:
            return jsonify({
                "error": "Google API Key chưa được cài đặt ở môi trường Vercel và chưa được nhập từ giao diện.",
                "api_key_required": True,
                "logs": ["API Key missing"]
            }), 400

        messages = data.get("messages", [])
        system_instruction = data.get("system_instruction", "")

        formatted_contents = []
        scenario_hint = ""
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            text_content = msg.get("content", "")
            formatted_contents.append({
                "role": role,
                "parts": [{"text": text_content}]
            })

        if system_instruction:
            match = re.search(r'Tình huống:\s*([^\n]+)', system_instruction)
            if match:
                scenario_hint = match.group(1).strip()

        payload = {
            "contents": formatted_contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 2048
            }
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        logs = []
        
        # 1. Try Primary Models in high-quota order
        for model in PRIMARY_MODELS:
            logs.append(f"Đang thử mô hình: {model}...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=12)
                if res.status_code == 200:
                    res_data = res.json()
                    candidates = res_data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        reply_text = "".join([p.get("text", "") for p in parts])
                        logs.append(f"Thành công với mô hình: {model}")
                        
                        display_name = model
                        if model not in ["gemini-3.6-flash", "gemini-3.5-flash"]:
                            display_name = "Gemini-Other"

                        return jsonify({
                            "reply": reply_text,
                            "used_model": model,
                            "display_model": display_name,
                            "logs": logs
                        })
                else:
                    logs.append(f"Mô hình {model} phản hồi HTTP {res.status_code}")
            except Exception as e:
                logs.append(f"Lỗi kết nối mô hình {model}: {str(e)}")

        # 2. Dynamic Discovery Fallback
        discovered_models = discover_available_gemini_models(api_key)
        for model in discovered_models:
            logs.append(f"Đang thử mô hình khám phá: {model}...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=10)
                if res.status_code == 200:
                    res_data = res.json()
                    candidates = res_data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        reply_text = "".join([p.get("text", "") for p in parts])
                        return jsonify({
                            "reply": reply_text,
                            "used_model": model,
                            "display_model": "Gemini-Other",
                            "logs": logs
                        })
            except Exception as e:
                continue

        # 3. ZERO-WAIT LOCAL FALLBACK: Display "Local" tag with retry seconds
        print("Google API Key Quota Exhausted (429). Executing Zero-Wait Local Fallback [Display Model: Local (要リトライ 15s)]...")
        smart_reply = get_smart_fallback_reply(scenario_hint)
        logs.append("API Quota quá tải -> Kích hoạt Zero-Wait Local Fallback (Hiển thị nhãn: Local - 要リトライ 15s).")

        return jsonify({
            "reply": smart_reply,
            "used_model": "local-fallback",
            "display_model": "Local",
            "retry_after_seconds": 15,
            "is_smart_fallback": True,
            "logs": logs
        }), 200

    except Exception as ex:
        smart_reply = get_smart_fallback_reply("")
        return jsonify({
            "reply": smart_reply,
            "used_model": "local-fallback",
            "display_model": "Local",
            "retry_after_seconds": 15,
            "is_smart_fallback": True
        }), 200


@app.route("/api/tts", methods=["POST"])
def tts():
    """
    Robust Google Cloud TTS Endpoint (Ver1.50)
    Supports:
    1. Browser Native Fallback signal if requested or if cloud synthesis fails
    2. OAuth2 Token (GCP_SERVICE_ACCOUNT_JSON) for Chirp 3 HD & Neural2 voices.
    3. API Key fallback for Neural2, WaveNet, Standard voices.
    """
    try:
        data = request.get_json() or {}
        client_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        
        text = data.get("text", "").strip()
        requested_voice = data.get("voice_name", "ja-JP-Chirp3-HD-F")

        # Instant return if user explicitly selected Browser Native TTS
        if requested_voice == "browser-native":
            return jsonify({
                "fallback_browser": True,
                "reason": "User selected Browser Native TTS",
                "text": text
            }), 200

        if not text:
            return jsonify({"error": "Nội dung văn bản trống"}), 400

        parts = requested_voice.split("-")
        lang_code = f"{parts[0]}-{parts[1]}" if len(parts) >= 2 else "ja-JP"
        
        candidate_voices = [requested_voice]
        
        if "ja-JP" in lang_code:
            if "M" in requested_voice or "Male" in requested_voice or "B" in requested_voice:
                candidate_voices += ["ja-JP-Neural2-B", "ja-JP-Neural2-C", "ja-JP-Wavenet-B", "ja-JP-Wavenet-D", "ja-JP-Standard-B"]
            else:
                candidate_voices += ["ja-JP-Neural2-F", "ja-JP-Neural2-B", "ja-JP-Wavenet-A", "ja-JP-Wavenet-C", "ja-JP-Standard-A"]
        elif "en-US" in lang_code:
            if "M" in requested_voice or "Male" in requested_voice or "D" in requested_voice:
                candidate_voices += ["en-US-Neural2-D", "en-US-Neural2-J", "en-US-Wavenet-D", "en-US-Standard-D"]
            else:
                candidate_voices += ["en-US-Neural2-F", "en-US-Neural2-C", "en-US-Wavenet-F", "en-US-Standard-F"]
        else:
            candidate_voices += ["vi-VN-Neural2-A", "vi-VN-Wavenet-A", "vi-VN-Standard-A"]

        seen = set()
        clean_candidate_voices = []
        for v in candidate_voices:
            if v not in seen:
                seen.add(v)
                clean_candidate_voices.append(v)

        last_error = ""

        # METHOD 1: Try OAuth2 Token (GCP_SERVICE_ACCOUNT_JSON)
        oauth_token, oauth_err = get_gcp_oauth2_token()

        if oauth_token:
            url_oauth = "https://texttospeech.googleapis.com/v1/text:synthesize"
            headers_oauth = {
                "Authorization": f"Bearer {oauth_token}",
                "Content-Type": "application/json; charset=utf-8"
            }

            for v_name in clean_candidate_voices:
                v_parts = v_name.split("-")
                v_lang = f"{v_parts[0]}-{v_parts[1]}" if len(v_parts) >= 2 else lang_code
                payload_oauth = {
                    "input": {"text": text},
                    "voice": {
                        "languageCode": v_lang,
                        "name": v_name
                    },
                    "audioConfig": {"audioEncoding": "MP3"}
                }
                try:
                    res_oauth = requests.post(url_oauth, headers=headers_oauth, json=payload_oauth, timeout=10)
                    if res_oauth.status_code == 200:
                        res_json = res_oauth.json()
                        audio_base64 = res_json.get("audioContent", "")
                        if audio_base64:
                            print(f"Google Cloud TTS OAuth2 Success! Voice: {v_name}")
                            return jsonify({
                                "audio_url": f"data:audio/mp3;base64,{audio_base64}",
                                "model_used": v_name,
                                "provider": "Google Cloud TTS (Service Account OAuth2)"
                            })
                    else:
                        last_error = f"OAuth2 HTTP {res_oauth.status_code}: {res_oauth.text[:100]}"
                except Exception as e:
                    last_error = str(e)
                    continue

        # METHOD 2: API Key Fallback (Supports Neural2, WaveNet, Standard)
        api_key = resolve_api_key(client_key)

        if api_key:
            url_key = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
            for v_name in clean_candidate_voices:
                if "Chirp" in v_name:
                    continue
                v_parts = v_name.split("-")
                v_lang = f"{v_parts[0]}-{v_parts[1]}" if len(v_parts) >= 2 else lang_code
                payload_key = {
                    "input": {"text": text},
                    "voice": {
                        "languageCode": v_lang,
                        "name": v_name
                    },
                    "audioConfig": {"audioEncoding": "MP3"}
                }
                try:
                    res_key = requests.post(url_key, json=payload_key, headers={"Content-Type": "application/json; charset=utf-8"}, timeout=8)
                    if res_key.status_code == 200:
                        res_json = res_key.json()
                        audio_base64 = res_json.get("audioContent", "")
                        if audio_base64:
                            print(f"Google Cloud TTS API Key Fallback Success! Voice: {v_name}")
                            return jsonify({
                                "audio_url": f"data:audio/mp3;base64,{audio_base64}",
                                "model_used": v_name,
                                "provider": "Google Cloud TTS (API Key)"
                            })
                    else:
                        last_error = f"API Key HTTP {res_key.status_code}: {res_key.text[:100]}"
                except Exception as e:
                    last_error = str(e)
                    continue

        # Controlled return triggering Browser Native Fallback without throwing 500
        return jsonify({
            "error": f"Google Cloud TTS ({last_error or 'Cần OAuth2/API Key'})",
            "fallback_browser": True,
            "text": text,
            "lang": lang_code
        }), 200

    except Exception as ex:
        return jsonify({
            "fallback_browser": True,
            "error": f"Lỗi TTS: {str(ex)}"
        }), 200


@app.route("/api/summary", methods=["POST"])
def summary():
    try:
        data = request.get_json() or {}
        client_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        api_key = resolve_api_key(client_key)

        messages = data.get("messages", [])
        ui_lang = data.get("ui_lang") or data.get("user_lang") or "tiếng Nhật"
        target_lang = data.get("target_lang", "jp 日本語")
        level = data.get("level", "Sơ cấp (CEFR A1, A2)")

        if "Nhật" in ui_lang or "Japan" in ui_lang or "jp" in ui_lang.lower():
            system_prompt = f"""あなたはプロの言語学習コーチです。
ユーザーとAIの会話履歴を分析し、以下のフォーマットで学習総括レポートを作成してください。
【厳格な規則】タイトル、見出し、本文、アドバイス、全ての記述を必ず【日本語】のみで作成してください。

会話履歴:
{json.dumps(messages, ensure_ascii=False, indent=2)}

出力フォーマット (全文章を日本語で記述):
# 📊 レッスン総括レポート＆アドバイス

## 1. レッスン概要
- **学習言語**: {target_lang}
- **レベル**: {level}
- **状態**: レッスンが正常に完了しました！素晴らしい積極性で会話を継続できました。

## 2. 良かった点
- 状況に応じた自然な受け答えができており、フレーズの活用がスムーズです。
- 相手の質問に対して意欲的に返答し、会話を継続する姿勢が見られます。

## 3. 改善点・表現のアドバイス
- より自然な文法や語彙表現に磨きをかけましょう。

## 4. 今後に向けた学習アドバイス
- 新しい表現を積極的に取り入れ、発音練習モードで繰り返しシャドーイングを行いましょう。"""

            fallback_summary = f"""# 📊 レッスン総括レポート＆アドバイス

## 1. レッスン概要
- **学習言語**: {target_lang}
- **レベル**: {level}
- **状態**: レッスンが正常に完了しました！素晴らしい積極性で会話を継続できました。

## 2. 良かった点
- 状況に応じた自然な受け答えができており、フレーズの活用がスムーズです。
- 対話を積極的に維持しようとする素晴らしい姿勢が見られます。

## 3. 今後に向けたアドバイス
- 新しい語彙や表現を積極的に取り入れ、表現の幅を広げましょう。
- 発音練習モードを活用して、シャドーイングを繰り返し行いましょう。"""

        elif "Anh" in ui_lang or "English" in ui_lang or "en" in ui_lang.lower():
            system_prompt = f"""You are a professional language learning coach.
Analyze the conversation history and generate a structured summary report in ENGLISH ONLY.

Conversation History:
{json.dumps(messages, ensure_ascii=False, indent=2)}

Format (STRICTLY IN ENGLISH ONLY):
# 📊 Lesson Summary & Advice Report

## 1. Overview
- **Target Language**: {target_lang}
- **Level**: {level}
- **Status**: Lesson completed successfully with great active engagement!

## 2. Strengths
- Natural responses appropriate for the selected scenario.
- Strong willingness to communicate and maintain dialogue flow.

## 3. Key Improvements & Advice
- Keep expanding your active vocabulary and refined grammar patterns.
- Practice regularly in Pronunciation mode using shadowing techniques."""

            fallback_summary = f"""# 📊 Lesson Summary & Advice Report

## 1. Overview
- **Target Language**: {target_lang}
- **Level**: {level}
- **Status**: Lesson completed successfully with great active engagement!

## 2. Strengths
- Natural responses appropriate for the selected scenario.
- Strong willingness to communicate and maintain dialogue flow.

## 3. Key Improvements & Advice
- Keep expanding your active vocabulary and refined grammar patterns.
- Practice regularly in Pronunciation mode using shadowing techniques."""

        else:
            system_prompt = f"""Bạn là một chuyên gia đào tạo ngôn ngữ hàng đầu.
Hãy đánh giá buổi luyện tập thoại giữa người học và AI theo thông tin sau.
MỌI TIÊU ĐỀ, HẠNG MỤC, NỘI DUNG, VÀ LỜI KHUYÊN BẮT BUỘC CHỈ ĐƯỢC VIẾT BẰNG tiếng Việt.

Hội thoại:
{json.dumps(messages, ensure_ascii=False, indent=2)}

Yêu cầu xuất báo cáo bằng Markdown (100% bằng tiếng Việt):
# 📊 Báo cáo & Lời khuyên tổng kết bài học

## 1. Tổng quan buổi học
- **Ngôn ngữ học**: {target_lang}
- **Trình độ**: {level}
- **Trạng thái**: Bài học đã hoàn thành xuất sắc! Người học phản xạ nhanh và chủ động giao tiếp.

## 2. Điểm mạnh
- Phản xạ giao tiếp tự nhiên, nắm bắt ngữ cảnh tốt.
- Sử dụng đúng cấu trúc câu cơ bản và từ vựng chủ đề.

## 3. Lời khuyên nâng cao trình độ
- Tiếp tục mở rộng vốn từ vựng chuyên sâu và chú ý nối âm.
- Luyện tập phát âm thường xuyên qua tính năng Luyện Phát Âm."""

            fallback_summary = f"""# 📊 Báo cáo & Lời khuyên tổng kết bài học

## 1. Tổng quan buổi học
- **Ngôn ngữ học**: {target_lang}
- **Trình độ**: {level}
- **Trạng thái**: Bài học đã hoàn thành xuất sắc! Người học phản xạ nhanh và chủ động giao tiếp.

## 2. Điểm mạnh
- Phản xạ giao tiếp tự nhiên, nắm bắt ngữ cảnh tốt.
- Sử dụng đúng cấu trúc câu cơ bản và từ vựng chủ đề.

## 3. Lời khuyên nâng cao trình độ
- Tiếp tục mở rộng vốn từ vựng chuyên sâu và chú ý nối âm.
- Luyện tập phát âm thường xuyên qua tính năng Luyện Phát Âm."""

        if not api_key:
            return jsonify({"summary": fallback_summary, "used_model": "Local"}), 200

        payload = {
            "contents": [{"role": "user", "parts": [{"text": system_prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096}
        }

        for model in PRIMARY_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
                if res.status_code == 200:
                    res_data = res.json()
                    candidates = res_data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        summary_text = "".join([p.get("text", "") for p in parts])
                        if summary_text and len(summary_text.strip()) > 30:
                            return jsonify({"summary": summary_text, "used_model": model})
            except Exception as e:
                print(f"Summary generation error with {model}:", e)
                continue

        return jsonify({"summary": fallback_summary, "used_model": "Local"}), 200

    except Exception as ex:
        print("Summary endpoint exception:", ex)
        return jsonify({"summary": "Lỗi kết nối summary.", "used_model": "Local"}), 200


@app.route("/")
def serve_index():
    return send_from_directory(PUBLIC_DIR, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(PUBLIC_DIR, path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
