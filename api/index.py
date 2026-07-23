import os
import json
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
            # Sort candidate models preferring flash / 2.5 / 2.0
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
                "maxOutputTokens": 1200
            }
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        logs = []
        
        # 1. Try Primary Models: 3.6-flash -> 3.5-flash
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
                        return jsonify({
                            "reply": reply_text,
                            "used_model": model,
                            "display_model": model,
                            "logs": logs
                        })
                else:
                    logs.append(f"Mô hình {model} bận/báo lỗi ({res.status_code}): {res.text[:150]}")
            except Exception as e:
                logs.append(f"Lỗi kết nối mô hình {model}: {str(e)}")

        # 2. Dynamic Discovery & Fallback if 3.6-flash & 3.5-flash fail
        logs.append("gemini-3.6-flash và 3.5-flash bận. Đang điều tra các mô hình Gemini khả dụng...")
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
            except Exception as e:
                logs.append(f"Lỗi mô hình {model}: {str(e)}")

        return jsonify({
            "error": "Tất cả mô hình Gemini đều không thể phản hồi. Vui lòng kiểm tra lại Google API Key.",
            "logs": logs
        }), 502

    except Exception as ex:
        return jsonify({"error": f"Lỗi máy chủ: {str(ex)}"}), 500


@app.route("/api/tts", methods=["POST"])
def tts():
    try:
        data = request.get_json() or {}
        api_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        if api_key == "demo_skipped":
            api_key = os.environ.get("GOOGLE_API_KEY", "")

        text = data.get("text", "").strip()
        voice_name = data.get("voice_name", "ja-JP-Chirp3-HD-F")
        
        if not text:
            return jsonify({"error": "Nội dung văn bản trống"}), 400

        # Extract language code e.g., ja-JP, en-US, vi-VN
        parts = voice_name.split("-")
        lang_code = f"{parts[0]}-{parts[1]}" if len(parts) >= 2 else "ja-JP"
        
        # Build priority list starting strictly with user-selected voice_name
        fallback_voices = [voice_name]
        
        # Add fallback chain for language
        if "ja-JP" in lang_code:
            fallback_voices += ["ja-JP-Chirp3-HD-F", "ja-JP-Chirp3-HD-M", "ja-JP-Neural2-B", "ja-JP-Neural2-C", "ja-JP-Wavenet-B", "ja-JP-Standard-B"]
        elif "en-US" in lang_code:
            fallback_voices += ["en-US-Chirp3-HD-F", "en-US-Chirp3-HD-M", "en-US-Neural2-F", "en-US-Wavenet-F", "en-US-Standard-F"]
        else:
            fallback_voices += ["vi-VN-Neural2-A", "vi-VN-Wavenet-A", "vi-VN-Standard-A"]

        # Deduplicate preserving strict user selection priority
        seen = set()
        dedup_voices = []
        for v in fallback_voices:
            if v not in seen:
                seen.add(v)
                dedup_voices.append(v)

        if api_key:
            url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
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
                except Exception as e:
                    print(f"TTS voice {v_name} error:", e)
                    continue

        return jsonify({
            "fallback_browser": True,
            "text": text,
            "lang": lang_code
        })

    except Exception as ex:
        return jsonify({"error": f"Lỗi TTS: {str(ex)}"}), 500


@app.route("/api/summary", methods=["POST"])
def summary():
    try:
        data = request.get_json() or {}
        api_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        if api_key == "demo_skipped":
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
- Ngôn ngữ nhận xét: {user_lang}

Hội thoại:
{json.dumps(messages, ensure_ascii=False, indent=2)}

Xuất báo cáo chi tiết bằng Markdown bao gồm:
1. **Tổng quan buổi học**
2. **Điểm mạnh người học**
3. **Các lỗi ngữ pháp / từ vựng cần lưu ý** (Câu người học đã nói, cách sửa chuẩn, giải thích bằng {user_lang})
4. **Lời khuyên nâng trình độ CEFR**"""

        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2000}
        }

        for model in PRIMARY_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=25)
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
