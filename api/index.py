import os
import json
import re
import base64
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.abspath(os.path.join(BASE_DIR, "../public"))

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path="")
CORS(app)

# Priority fallback models: 3.6-flash -> 3.5-flash
PRIMARY_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash"
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

def discover_available_gemini_models(api_key):
    """Dynamically discover available Gemini models if primary models are busy/unavailable"""
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            models_data = res.json().get("models", [])
            candidate_models = []
            for m in models_data:
                name = m.get("name", "").replace("models/", "")
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods and "gemini" in name.lower():
                    if name not in PRIMARY_MODELS:
                        candidate_models.append(name)
            candidate_models.sort(key=lambda x: (0 if "flash" in x else 1, 0 if "2.5" in x else 1))
            return candidate_models
    except Exception as e:
        print("Model discovery error:", e)
    return ["gemini-2.5-flash", "gemini-2.0-flash"]


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json() or {}
        api_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        
        if not api_key or api_key == "demo_skipped":
            api_key = os.environ.get("GOOGLE_API_KEY", "")

        if not api_key:
            return jsonify({
                "error": "Google API Keyが設定されていません。Gemini AIを使用するにはAPI Keyを入力してください。",
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
        
        # 1. Try Primary Models: 3.6-flash -> 3.5-flash
        for model in PRIMARY_MODELS:
            logs.append(f"Đang thử mô hình: {model}...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=22)
                if res.status_code == 200:
                    res_data = res.json()
                    candidates = res_data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        reply_text = "".join([p.get("text", "") for p in parts])
                        logs.append(f"Thành công với mô hình: {model}")
                        return jsonify({
                            "reply": reply_text,
                            "used_model": model,
                            "display_model": model,
                            "logs": logs
                        })
                else:
                    err_msg = res.text
                    sec = parse_retry_seconds(err_msg)
                    if sec and not extracted_retry_sec:
                        extracted_retry_sec = sec
                    logs.append(f"Mô hình {model} bận ({res.status_code}): {err_msg[:150]}")
            except Exception as e:
                logs.append(f"Lỗi kết nối mô hình {model}: {str(e)}")

        # 2. Dynamic Discovery & Fallback
        logs.append("gemini-3.6-flash và 3.5-flash bận. Đang điều tra các mô hình Gemini khả dụng...")
        discovered_models = discover_available_gemini_models(api_key)
        
        for model in discovered_models:
            logs.append(f"Đang thử mô hình khám phá: {model}...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=20)
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
            "error": "Tất cả mô hình Gemini đều đang bận hoặc quá tải.",
            "retry_seconds": extracted_retry_sec or 15,
            "logs": logs
        }), 429

    except Exception as ex:
        return jsonify({"error": f"Lỗi máy chủ: {str(ex)}"}), 500


@app.route("/api/tts", methods=["POST"])
def tts():
    try:
        data = request.get_json() or {}
        api_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        if not api_key or api_key == "demo_skipped":
            api_key = os.environ.get("GOOGLE_API_KEY", "")

        text = data.get("text", "").strip()
        voice_name = data.get("voice_name", "ja-JP-Chirp3-HD-F")
        
        if not text:
            return jsonify({"error": "Nội dung văn bản trống"}), 400

        parts = voice_name.split("-")
        lang_code = f"{parts[0]}-{parts[1]}" if len(parts) >= 2 else "ja-JP"
        
        # Build priority list starting strictly with user-selected voice_name
        fallback_voices = [voice_name]
        
        # Note: Chirp 3 HD requires OAuth2 tokens and returns 401 with API Key.
        # Fall back immediately to Neural2 / WaveNet / Standard which support API Key authentication!
        if "ja-JP" in lang_code:
            fallback_voices += ["ja-JP-Neural2-B", "ja-JP-Neural2-C", "ja-JP-Wavenet-B", "ja-JP-Standard-B"]
        elif "en-US" in lang_code:
            fallback_voices += ["en-US-Neural2-F", "en-US-Wavenet-F", "en-US-Standard-F"]
        else:
            fallback_voices += ["vi-VN-Neural2-A", "vi-VN-Wavenet-A", "vi-VN-Standard-A"]

        # Deduplicate preserving strict priority
        seen = set()
        dedup_voices = []
        for v in fallback_voices:
            if v not in seen:
                seen.add(v)
                dedup_voices.append(v)

        if not api_key:
            print("Google Cloud TTS API Error: No Google API Key provided!")
            return jsonify({"error": "Google API Key missing for TTS", "fallback_browser": True}), 400

        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
        last_error = ""

        for v_name in dedup_voices:
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
                res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=12)
                if res.status_code == 200:
                    res_json = res.json()
                    audio_base64 = res_json.get("audioContent", "")
                    if audio_base64:
                        return jsonify({
                            "audio_url": f"data:audio/mp3;base64,{audio_base64}",
                            "model_used": v_name
                        })
                else:
                    err_msg = res.text[:180]
                    # If 401 occurs (Chirp3-HD requiring OAuth2 instead of API Key), log and smoothly continue to Neural2
                    if res.status_code == 401 and "Chirp" in v_name:
                        print(f"TTS Note: {v_name} requires OAuth2 token. Falling back to Neural2...")
                        last_error = "Chirp 3 HD requires OAuth2, fallback to Neural2"
                    else:
                        last_error = f"HTTP {res.status_code}: {err_msg}"
                        print(f"TTS voice {v_name} error: {last_error}")
            except Exception as e:
                last_error = str(e)
                print(f"TTS voice {v_name} exception:", e)
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
        api_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        if not api_key or api_key == "demo_skipped":
            api_key = os.environ.get("GOOGLE_API_KEY", "")

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
