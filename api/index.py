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

# Model Fallback Chain prioritizing gemini-3.6-flash followed by gemini-3.5-flash and modern models
FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash"
]

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json() or {}
        api_key = data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        
        if not api_key or api_key == "demo_skipped":
            api_key = os.environ.get("GOOGLE_API_KEY", "")

        if not api_key:
            return jsonify({
                "error": "Lỗi: Chưa cung cấp Google API Key. Vui lòng nhập API Key hoặc cài đặt khóa để sử dụng Gemini.",
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
        last_error = None

        for model in FALLBACK_MODELS:
            logs.append(f"Đang thử mô hình: {model}...")
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
                        logs.append(f"Thành công với mô hình: {model}")
                        return jsonify({
                            "reply": reply_text,
                            "used_model": model,
                            "logs": logs
                        })
                    else:
                        logs.append(f"Mô hình {model} không trả về phản hồi hợp lệ.")
                else:
                    err_msg = res.text[:200]
                    logs.append(f"Mô hình {model} báo lỗi ({res.status_code}): {err_msg}")
                    last_error = f"HTTP {res.status_code}: {err_msg}"
            except Exception as e:
                logs.append(f"Lỗi kết nối mô hình {model}: {str(e)}")
                last_error = str(e)

        return jsonify({
            "error": "Tất cả mô hình AI (bao gồm gemini-3.6-flash & gemini-3.5-flash) đều không phản hồi. Vui lòng kiểm tra Google API Key.",
            "logs": logs,
            "details": last_error
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
        voice_name = data.get("voice_name", "ja-JP-Neural2-B")
        
        if not text:
            return jsonify({"error": "Nội dung văn bản trống"}), 400

        lang_code = voice_name.split("-")[0] + "-" + voice_name.split("-")[1] if len(voice_name.split("-")) >= 2 else "ja-JP"
        
        if api_key:
            url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
            payload = {
                "input": {"text": text},
                "voice": {
                    "languageCode": lang_code,
                    "name": voice_name
                },
                "audioConfig": {
                    "audioEncoding": "MP3",
                    "speakingRate": 1.0,
                    "pitch": 0
                }
            }
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
            if res.status_code == 200:
                res_json = res.json()
                audio_base64 = res_json.get("audioContent", "")
                return jsonify({
                    "audio_url": f"data:audio/mp3;base64,{audio_base64}",
                    "model_used": voice_name
                })

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

        for model in FALLBACK_MODELS:
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
