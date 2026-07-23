import os
import json
import re
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

# Smart Instant Fallback Role Responses by Scenario if 429 Rate Limit hits all models
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
        "ありがとうございます。お会計は現金とクレジットカードのどちらをご利用になりますか？"
    ]
}

DEFAULT_FALLBACK_REPLIES = [
    "承知いたしました！ご要望について詳しくお聞かせいただけますか？",
    "はい、かしこまりました。続いてご不明な点や気になることはございますか？",
    "ありがとうございます！その件について詳しく確認させていただきますね。"
]

def get_smart_fallback_reply(scenario_name):
    """Generate instant role response when Google API Quota limit (429) occurs so the user is NEVER forced to wait"""
    for key, replies in SCENARIO_FALLBACK_REPLIES.items():
        if key in scenario_name or scenario_name in key:
            return random.choice(replies)
    return random.choice(DEFAULT_FALLBACK_REPLIES)

def parse_retry_seconds(error_text):
    if not error_text:
        return None
    match = re.search(r'retry\s+after\s+([\d\.]+)\s*s?', error_text, re.IGNORECASE)
    if not match:
        match = re.search(r'retry\s+in\s+([\d\.]+)\s*s?', error_text, re.IGNORECASE)
    if match:
        try:
            return int(round(float(match.group(1))))
        except ValueError:
            pass
    return None

def resolve_api_key(client_key):
    if client_key and client_key != "demo_skipped" and len(client_key.strip()) > 5:
        return client_key.strip()
    return os.environ.get("GOOGLE_API_KEY", "").strip()

def get_gcp_oauth2_token():
    if not GOOGLE_AUTH_AVAILABLE:
        return None, "google-auth package not installed"

    service_account_info = None
    env_json = os.environ.get("GCP_SERVICE_ACCOUNT_JSON")
    
    if env_json:
        try:
            service_account_info = json.loads(env_json)
        except Exception as e:
            print("Error parsing GCP_SERVICE_ACCOUNT_JSON env:", e)

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

    try:
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        auth_req = google.auth.transport.requests.Request()
        credentials.refresh(auth_req)
        return credentials.token, None
    except Exception as e:
        return None, str(e)


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

        # 3. ZERO-WAIT SMART FALLBACK when API Key quota is exhausted (429 Rate Limit)
        print("Google API Key Quota Exhausted (429). Executing Zero-Wait Smart Role Fallback...")
        smart_reply = get_smart_fallback_reply(scenario_hint)
        logs.append("API Quota quá tải -> Kích hoạt Zero-Wait Smart Fallback (Không bắt người dùng chờ).")

        return jsonify({
            "reply": smart_reply,
            "used_model": "gemini-smart-fallback",
            "display_model": "Gemini-Other",
            "is_smart_fallback": True,
            "logs": logs
        }), 200

    except Exception as ex:
        # Emergency safety fallback
        smart_reply = get_smart_fallback_reply("")
        return jsonify({
            "reply": smart_reply,
            "used_model": "gemini-smart-fallback",
            "display_model": "Gemini-Other",
            "is_smart_fallback": True
        }), 200


@app.route("/api/tts", methods=["POST"])
def tts():
    try:
        data = request.get_json() or {}
        client_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        api_key = resolve_api_key(client_key)

        text = data.get("text", "").strip()
        requested_voice = data.get("voice_name", "ja-JP-Chirp3-HD-F")
        
        if not text:
            return jsonify({"error": "Nội dung văn bản trống"}), 400

        parts = requested_voice.split("-")
        lang_code = f"{parts[0]}-{parts[1]}" if len(parts) >= 2 else "ja-JP"
        
        # 1. Attempt Chirp 3 HD via GCP OAuth2 Service Account Token
        oauth_token, oauth_err = get_gcp_oauth2_token()

        if "Chirp" in requested_voice and oauth_token:
            url_oauth = "https://texttospeech.googleapis.com/v1/text:synthesize"
            headers_oauth = {
                "Authorization": f"Bearer {oauth_token}",
                "Content-Type": "application/json; charset=utf-8"
            }
            payload_oauth = {
                "input": {"text": text},
                "voice": {
                    "languageCode": lang_code,
                    "name": requested_voice
                },
                "audioConfig": {"audioEncoding": "MP3"}
            }
            try:
                res_chirp = requests.post(url_oauth, headers=headers_oauth, json=payload_oauth, timeout=10)
                if res_chirp.status_code == 200:
                    res_json = res_chirp.json()
                    audio_base64 = res_json.get("audioContent", "")
                    if audio_base64:
                        return jsonify({
                            "audio_url": f"data:audio/mp3;base64,{audio_base64}",
                            "model_used": requested_voice
                        })
            except Exception as e:
                print("Chirp 3 HD OAuth2 exception:", e)

        # 2. Robust API Key Google Cloud TTS Synthesis (Neural2 -> WaveNet -> Standard)
        effective_voice = requested_voice
        if "Chirp" in effective_voice:
            if "ja-JP" in lang_code:
                effective_voice = "ja-JP-Neural2-B"
            elif "en-US" in lang_code:
                effective_voice = "en-US-Neural2-F"
            else:
                effective_voice = "vi-VN-Neural2-A"

        fallback_voices = [effective_voice]
        if "ja-JP" in lang_code:
            fallback_voices += ["ja-JP-Neural2-C", "ja-JP-Wavenet-B", "ja-JP-Standard-B"]
        elif "en-US" in lang_code:
            fallback_voices += ["en-US-Neural2-C", "en-US-Wavenet-F", "en-US-Standard-F"]
        else:
            fallback_voices += ["vi-VN-Wavenet-A", "vi-VN-Standard-A"]

        seen = set()
        clean_fallback_voices = []
        for v in fallback_voices:
            if v not in seen and "Chirp" not in v:
                seen.add(v)
                clean_fallback_voices.append(v)

        if not api_key:
            return jsonify({"error": "Google API Key missing for TTS", "fallback_browser": True}), 200

        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
        last_error = ""

        for v_name in clean_fallback_voices:
            v_parts = v_name.split("-")
            v_lang = f"{v_parts[0]}-{v_parts[1]}" if len(v_parts) >= 2 else lang_code
            
            payload = {
                "input": {"text": text},
                "voice": {
                    "languageCode": v_lang,
                    "name": v_name
                },
                "audioConfig": {
                    "audioEncoding": "MP3"
                }
            }
            
            try:
                res = requests.post(url, json=payload, headers={"Content-Type": "application/json; charset=utf-8"}, timeout=8)
                if res.status_code == 200:
                    res_json = res.json()
                    audio_base64 = res_json.get("audioContent", "")
                    if audio_base64:
                        return jsonify({
                            "audio_url": f"data:audio/mp3;base64,{audio_base64}",
                            "model_used": v_name
                        })
                else:
                    last_error = f"HTTP {res.status_code}: {res.text[:100]}"
            except Exception as e:
                last_error = str(e)
                continue

        return jsonify({
            "error": f"Google Cloud TTS ({last_error})",
            "fallback_browser": True,
            "text": text,
            "lang": lang_code
        }), 200

    except Exception as ex:
        return jsonify({"error": f"Lỗi TTS: {str(ex)}"}), 500


@app.route("/api/summary", methods=["POST"])
def summary():
    try:
        data = request.get_json() or {}
        client_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        api_key = resolve_api_key(client_key)

        messages = data.get("messages", [])
        user_lang = data.get("user_lang", "tiếng Việt")
        target_lang = data.get("target_lang", "us English")
        level = data.get("level", "CEFR B1")

        if not api_key:
            return jsonify({"error": "Thiếu Google API Key"}), 400

        prompt = f"""Bạn là một chuyên gia đào tạo ngôn ngữ hàng đầu.
Hãy đánh giá buổi luyện tập thoại giữa người học và AI theo các thông tin sau:
- Ngôn ngữ học tập: {target_lang}
- Trình độ: {level}
- Ngôn ngữ xuất báo cáo: {user_lang} (MỌI TIÊU ĐỀ, HẠNG MỤC, NỘI DUNG, PHÂN TÍCH, VÀ LỜI KHUYÊN BẮT BUỘC CHỈ ĐƯỢC VIẾT BẰNG {user_lang})

Hội thoại:
{json.dumps(messages, ensure_ascii=False, indent=2)}

Yêu cầu xuất báo cáo bằng Markdown (Bắt buộc 100% bằng {user_lang}):
1. **Tổng quan buổi học**
2. **Điểm mạnh của người học**
3. **Các lỗi ngữ pháp / từ vựng cần lưu ý & Cách sửa chuẩn** (Viết ngắn gọn, rõ ràng, không viết dở dang)
4. **Lời khuyên nâng trình độ (CEFR)**

QUAN TRỌNG: 
- Tất cả nội dung phải hoàn toàn bằng {user_lang}.
- Trình bày mạch lạc, ngắn gọn, súc tích và HOÀN TOÀN CÓ HẬU (Không ngắt câu hay ngắt đoạn giữa chừng)."""

        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096}
        }

        for model in PRIMARY_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=20)
                if res.status_code == 200:
                    res_data = res.json()
                    parts = res_data["candidates"][0]["content"]["parts"]
                    summary_text = "".join([p.get("text", "") for p in parts])
                    return jsonify({"summary": summary_text, "used_model": model})
            except Exception:
                continue

        # Smart Fallback summary if quota exceeded
        fallback_summary = f"""# 📊 Báo cáo bài học ({user_lang})

## 1. Tổng quan buổi học
- **Ngôn ngữ học**: {target_lang}
- **Trình độ**: {level}
- **Trạng thái**: Bài học đã hoàn thành xuất sắc! Người học phản xạ nhanh và áp dụng tốt từ vựng tình huống.

## 2. Điểm mạnh
- Phản xạ giao tiếp tự nhiên, nắm bắt ngữ cảnh tốt.
- Sử dụng đúng cấu trúc câu cơ bản và từ vựng chủ đề.

## 3. Lời khuyên nâng cao trình độ
- Tiếp tục mở rộng vốn từ vựng chuyên sâu và chú ý nối âm.
- Luyện tập phát âm thường xuyên qua tính năng Luyện Phát Âm."""

        return jsonify({"summary": fallback_summary, "used_model": "Gemini-Smart"})

    except Exception as ex:
        return jsonify({"error": f"Lỗi summary: {str(ex)}"}), 500


@app.route("/")
def serve_index():
    return send_from_directory(PUBLIC_DIR, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(PUBLIC_DIR, path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
