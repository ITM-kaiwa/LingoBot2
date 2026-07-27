import os
import json
import re
import time
import random
import base64
import asyncio
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

import edge_tts

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.abspath(os.path.join(BASE_DIR, "../public"))

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path="")
CORS(app)

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

SCENARIO_FALLBACK_REPLIES = {
    "自由会話": [
        "こんにちは！今日はどんなことについてお話ししましょうか？自由になんでも聞いたり話したりしてくださいね。",
        "お疲れ様です！最近楽しかったことや興味のあるトピックなど、何でも気軽に話しかけてください！",
        "何か話したいテーマはありますか？どんな日常の会話でも大歓迎ですよ。"
    ],
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

def sanitize_api_key(key):
    if not key or not isinstance(key, str):
        return ""
    return key.strip().strip('"').strip("'")

def get_env_api_key():
    return sanitize_api_key(os.environ.get("GOOGLE_API_KEY", ""))

def get_smart_fallback_reply(scenario_name):
    for key, replies in SCENARIO_FALLBACK_REPLIES.items():
        if key in scenario_name or scenario_name in key:
            return random.choice(replies)
    return random.choice(DEFAULT_FALLBACK_REPLIES)


def fetch_dynamic_gemini_models(api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    try:
        res = requests.get(url, timeout=7)
        if res.status_code in [400, 403]:
            return None, "Google API Key が無効です。"
        
        if res.status_code == 200:
            models_data = res.json().get("models", [])
            valid_chat_models = []

            for m in models_data:
                name = m.get("name", "").replace("models/", "")
                methods = m.get("supportedGenerationMethods", [])
                name_lower = name.lower()
                
                if any(excluded in name_lower for excluded in ["embedding", "-tts", "imagen", "veo", "aqa", "bison"]):
                    continue

                if "generateContent" in methods and "gemini" in name_lower:
                    valid_chat_models.append(name)

            def model_priority(m_name):
                m_lower = m_name.lower()
                if "2.5-flash" in m_lower: return 0
                if "2.0-flash" in m_lower: return 1
                if "1.5-flash" in m_lower: return 2
                if "flash" in m_lower: return 3
                if "pro" in m_lower: return 4
                return 5

            valid_chat_models.sort(key=model_priority)
            return valid_chat_models, None
        else:
            return None, f"HTTP Error {res.status_code}"

    except Exception as e:
        return None, str(e)


def execute_gemini_chat(api_key, formatted_contents, system_instruction, scenario_hint):
    """
    Helper function to execute Gemini chat API with dynamic model discovery.
    """
    dynamic_models, key_err = fetch_dynamic_gemini_models(api_key)
    if key_err:
        return None, key_err

    fallback_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
    target_models = dynamic_models if dynamic_models else fallback_models

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
    for model in target_models:
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
                    display_name = model if "flash" in model.lower() else "Gemini-Other"
                    return {
                        "reply": reply_text,
                        "used_model": model,
                        "display_model": display_name,
                        "logs": logs
                    }, None
        except Exception as e:
            logs.append(f"Lỗi kết nối mô hình {model}: {str(e)}")

    return None, "Quota or model connectivity error"


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Ver2.2 API Key Priority Logic:
    1. Priority #1: Try Server Environment Variable `GOOGLE_API_KEY`.
    2. Priority #2: Only if Env Key is unconfigured or fails (400/403/Quota), fallback to Client User-Input Key.
    """
    try:
        data = request.get_json() or {}
        raw_client_key = sanitize_api_key(data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", ""))
        env_key = get_env_api_key()

        messages = data.get("messages", [])
        system_instruction = data.get("system_instruction", "")

        scenario_hint = ""
        if system_instruction:
            match = re.search(r'Tình huống:\s*([^\n]+)', system_instruction)
            if match:
                scenario_hint = match.group(1).strip()

        formatted_contents = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            text_content = msg.get("content", "")
            formatted_contents.append({
                "role": role,
                "parts": [{"text": text_content}]
            })

        # Step 1: Try Environment Variable Key First
        if env_key:
            res_data, env_err = execute_gemini_chat(env_key, formatted_contents, system_instruction, scenario_hint)
            if res_data:
                res_data["key_source"] = "env"
                return jsonify(res_data), 200

        # Step 2: Try Client UI Input Key if Env Key is missing or failed
        if raw_client_key:
            res_data, client_err = execute_gemini_chat(raw_client_key, formatted_contents, system_instruction, scenario_hint)
            if res_data:
                res_data["key_source"] = "client"
                return jsonify(res_data), 200
            elif client_err and "無効" in client_err:
                smart_reply = get_smart_fallback_reply(scenario_hint)
                return jsonify({
                    "reply": smart_reply,
                    "used_model": "local-fallback",
                    "display_model": "Local",
                    "api_key_invalid": True,
                    "is_smart_fallback": True,
                    "error": "Google API Key が無効です。画面上部で新しいキーを入力してください。"
                }), 200

        # Step 3: Neither key is valid/configured -> Return Local Fallback & Prompt for UI Key Input
        smart_reply = get_smart_fallback_reply(scenario_hint)
        return jsonify({
            "reply": smart_reply,
            "used_model": "local-fallback",
            "display_model": "Local",
            "api_key_required": True,
            "is_smart_fallback": True,
            "info": "環境変数の API Key が未設定またはエラーとなりました。画面上部の入力欄に Google API Key を入力してください。"
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


EDGE_TTS_VOICE_MAP = {
    "ja-JP-Chirp3-HD-F": "ja-JP-NanamiNeural",
    "ja-JP-Chirp3-HD-M": "ja-JP-KeitaNeural",
    "ja-JP-Neural2-B": "ja-JP-KeitaNeural",
    "ja-JP": "ja-JP-NanamiNeural",

    "en-US-Chirp3-HD-F": "en-US-JennyNeural",
    "en-US-Chirp3-HD-M": "en-US-GuyNeural",
    "en-US-Neural2-F": "en-US-JennyNeural",
    "en-US": "en-US-JennyNeural",

    "vi-VN-Neural2-A": "vi-VN-HoaiMyNeural",
    "vi-VN": "vi-VN-HoaiMyNeural"
}

async def generate_edge_tts_audio_base64(text, voice_name):
    edge_voice = EDGE_TTS_VOICE_MAP.get(voice_name)
    if not edge_voice:
        if "ja" in voice_name or "JP" in voice_name:
            edge_voice = "ja-JP-NanamiNeural"
        elif "en" in voice_name or "US" in voice_name:
            edge_voice = "en-US-JennyNeural"
        else:
            edge_voice = "vi-VN-HoaiMyNeural"

    communicate = edge_tts.Communicate(text, edge_voice)
    audio_data = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data.extend(chunk["data"])

    b64_str = base64.b64encode(audio_data).decode("utf-8")
    return f"data:audio/mp3;base64,{b64_str}", edge_voice


@app.route("/api/tts", methods=["POST"])
def tts():
    try:
        data = request.get_json() or {}
        text = data.get("text", "").strip()
        requested_voice = data.get("voice_name", "ja-JP-Chirp3-HD-F")

        if requested_voice == "browser-native":
            return jsonify({
                "fallback_browser": True,
                "reason": "User selected General (Web Speech API)",
                "text": text
            }), 200

        if not text:
            return jsonify({"error": "Nội dung văn bản trống"}), 400

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            audio_url, edge_voice_used = loop.run_until_complete(
                generate_edge_tts_audio_base64(text, requested_voice)
            )
            loop.close()

            return jsonify({
                "audio_url": audio_url,
                "model_used": f"EdgeTTS ({edge_voice_used})",
                "provider": "Microsoft Edge TTS"
            }), 200

        except Exception as tts_err:
            return jsonify({
                "fallback_browser": True,
                "error": f"Lỗi EdgeTTS: {str(tts_err)}",
                "text": text
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
        raw_client_key = sanitize_api_key(data.get("api_key") or request.headers.get("Authorization", "").replace("Bearer ", ""))
        env_key = get_env_api_key()
        api_key = env_key if env_key else raw_client_key

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

        dynamic_models, _ = fetch_dynamic_gemini_models(api_key)
        models_to_try = dynamic_models if dynamic_models else ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

        payload = {
            "contents": [{"role": "user", "parts": [{"text": system_prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096}
        }

        for model in models_to_try:
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
                continue

        return jsonify({"summary": fallback_summary, "used_model": "Local"}), 200

    except Exception as ex:
        return jsonify({"summary": "Lỗi kết nối summary.", "used_model": "Local"}), 200


@app.route("/")
def serve_index():
    return send_from_directory(PUBLIC_DIR, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(PUBLIC_DIR, path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
