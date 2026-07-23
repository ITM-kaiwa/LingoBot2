import os
import json
import re
import base64
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

# Priority model cascade for avoiding 429 Rate Limits
PRIMARY_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro"
]

def parse_retry_seconds(error_text):
    """Extract retry seconds from Google API error text e.g., 'Please retry after 15.2s' or 'retry in 20 seconds'"""
    if not error_text:
        return None
    match = re.search(r'retry\s+after\s+([\d\.]+)\s*s?', error_text, re.IGNORECASE)
    if not match:
        match = re.search(r'retry\s+in\s+([\d\.]+)\s*s?', error_text, re.IGNORECASE)
    if not match:
        match = re.search(r'wait\s+([\d\.]+)\s*s?', error_text, re.IGNORECASE)
    
    if match:
        try:
            val = float(match.group(1))
            return int(round(val))
        except ValueError:
            pass
    return None

def resolve_api_key(client_key):
    """Priority: 1. User hand-entered key -> 2. Vercel/Server Environment Variable (GOOGLE_API_KEY)"""
    if client_key and client_key != "demo_skipped" and len(client_key.strip()) > 5:
        return client_key.strip()
    return os.environ.get("GOOGLE_API_KEY", "").strip()

def get_gcp_oauth2_token():
    """dynamically load GCP Service Account JSON from Env or local file and generate OAuth2 Bearer token"""
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
                    print(f"Loaded GCP Service Account JSON from file: {path}")
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
        print("Error refreshing GCP OAuth2 token:", e)
        return None, str(e)


def discover_available_gemini_models(api_key):
    """Dynamically discover available Gemini models if primary models are busy/unavailable"""
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        res = requests.get(url, timeout=8)
        if res.status_code == 200:
            models_data = res.json().get("models", [])
            candidate_models = []
            for m in models_data:
                name = m.get("name", "").replace("models/", "")
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods and "gemini" in name.lower():
                    if name not in PRIMARY_MODELS:
                        candidate_models.append(name)
            candidate_models.sort(key=lambda x: (0 if "flash" in x else 1, 0 if "2." in x else 1))
            return candidate_models
    except Exception as e:
        print("Model discovery error:", e)
    return ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json() or {}
        client_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        
        api_key = resolve_api_key(client_key)

        if not api_key:
            return jsonify({
                "error": "Google API Key chưa được cài đặt ở môi trường Vercel và chưa được nhập từ giao diện. Vui lòng nhập Google Gemini API Key để bắt đầu.",
                "api_key_required": True,
                "logs": ["API Key missing"]
            }), 400

        messages = data.get("messages", [])
        system_instruction = data.get("system_instruction", "")

        formatted_contents = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            text_content = msg.get("content", "")
            formatted_contents.append({
                "role": role,
                "parts": [{"text": text_content}]
            })

        payload = {
            "contents": formatted_contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 4096
            }
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        logs = []
        extracted_retry_sec = None
        
        # 1. Broad Primary Model Cascade: 3.6-flash -> 3.5-flash -> 1.5-flash -> 2.5-flash -> 2.0-flash -> 1.5-pro
        for model in PRIMARY_MODELS:
            logs.append(f"Đang thử mô hình: {model}...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=18)
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
                    err_msg = res.text
                    sec = parse_retry_seconds(err_msg)
                    if sec and not extracted_retry_sec:
                        extracted_retry_sec = sec
                    logs.append(f"Mô hình {model} bận ({res.status_code}): {err_msg[:100]}")
            except Exception as e:
                logs.append(f"Lỗi kết nối mô hình {model}: {str(e)}")

        # 2. Dynamic Discovery & Fallback
        logs.append("Tất cả mô hình chính bận. Đang điều tra các mô hình Gemini khả dụng khác...")
        discovered_models = discover_available_gemini_models(api_key)
        
        for model in discovered_models:
            logs.append(f"Đang thử mô hình khám phá: {model}...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=15)
                if res.status_code == 200:
                    res_data = res.json()
                    candidates = res_data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        reply_text = "".join([p.get("text", "") for p in parts])
                        logs.append(f"Thành công với mô hình khám phá: {model} (Gemini-Other)")
                        return jsonify({
                            "reply": reply_text,
                            "used_model": model,
                            "display_model": "Gemini-Other",
                            "logs": logs
                        })
                else:
                    sec = parse_retry_seconds(res.text)
                    if sec and not extracted_retry_sec:
                        extracted_retry_sec = sec
            except Exception as e:
                logs.append(f"Lỗi mô hình {model}: {str(e)}")

        return jsonify({
            "error": "Tất cả mô hình Gemini đều đang bận hoặc quá tải do quá nhiều lượt truy cập.",
            "retry_seconds": extracted_retry_sec or 15,
            "logs": logs
        }), 429

    except Exception as ex:
        return jsonify({"error": f"Lỗi máy chủ: {str(ex)}"}), 500


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
            print(f"Calling Chirp 3 HD ({requested_voice}) via GCP Service Account OAuth2 Token...")
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
                res_chirp = requests.post(url_oauth, headers=headers_oauth, json=payload_oauth, timeout=12)
                if res_chirp.status_code == 200:
                    res_json = res_chirp.json()
                    audio_base64 = res_json.get("audioContent", "")
                    if audio_base64:
                        print(f"Successfully synthesized Chirp 3 HD voice: {requested_voice}")
                        return jsonify({
                            "audio_url": f"data:audio/mp3;base64,{audio_base64}",
                            "model_used": requested_voice
                        })
            except Exception as e:
                print("Chirp 3 HD OAuth2 request exception:", e)

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
                res = requests.post(url, json=payload, headers={"Content-Type": "application/json; charset=utf-8"}, timeout=12)
                if res.status_code == 200:
                    res_json = res.json()
                    audio_base64 = res_json.get("audioContent", "")
                    if audio_base64:
                        print(f"Successfully synthesized Google Cloud TTS using {v_name}")
                        return jsonify({
                            "audio_url": f"data:audio/mp3;base64,{audio_base64}",
                            "model_used": v_name
                        })
                else:
                    last_error = f"HTTP {res.status_code}: {res.text[:150]}"
            except Exception as e:
                last_error = str(e)
                continue

        return jsonify({
            "error": f"Không thể tổng hợp Google Cloud TTS ({last_error})",
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
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
            if res.status_code == 200:
                res_data = res.json()
                parts = res_data["candidates"][0]["content"]["parts"]
                summary_text = "".join([p.get("text", "") for p in parts])
                return jsonify({"summary": summary_text, "used_model": model})

        return jsonify({"error": "Không thể tổng kết báo cáo"}), 502

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
