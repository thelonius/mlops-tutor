import json
import os

from curriculum import CURRICULUM, TOPICS, build_system_prompt
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request, stream_with_context
import asyncio
import tempfile
import edge_tts
from openai import OpenAI

load_dotenv()

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
)

app = Flask(__name__)

# Цепочка моделей: при 429 на одной — переключаемся на следующую.
# Маленькую llama-3.1-8b держим в самом конце — у неё баг с CJK.
MODELS = [
    "llama-3.3-70b-versatile",                    # основная, 100K токенов/день
    "qwen/qwen3-32b",                             # Qwen3 32B — хорошее качество, своя квота
    "openai/gpt-oss-120b",                        # 120B, отдельная квота
    "meta-llama/llama-4-scout-17b-16e-instruct",  # ещё запас
    "llama-3.1-8b-instant",                       # последний — может давать иероглифы
]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/curriculum")
def get_curriculum():
    return jsonify({"curriculum": CURRICULUM, "topics": TOPICS})


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    topic_id = data.get("topic_id", "")
    mode = data.get("mode", "learn")
    preferred = data.get("model", MODELS[0])

    if not messages:
        return jsonify({"error": "No messages"}), 400

    system_prompt = build_system_prompt(topic_id, mode)

    nim_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": m["role"] if m["role"] == "user" else "assistant", "content": m["content"]}
        for m in messages
    ]

    # Стартуем с выбранной пользователем модели, остальные — fallback
    start = MODELS.index(preferred) if preferred in MODELS else 0
    model_chain = MODELS[start:] + MODELS[:start]

    def generate():
        for i, model in enumerate(model_chain):
            try:
                stream = client.chat.completions.create(
                    model=model,
                    messages=nim_messages,
                    stream=True,
                    temperature=0.7,
                    max_tokens=1024,
                )
                if i > 0:
                    note = f"_(резервная модель: {model})_\n\n"
                    yield f"data: {json.dumps({'text': note})}\n\n"
                in_think = False
                think_buf = ""
                for chunk in stream:
                    text = chunk.choices[0].delta.content
                    if not text:
                        continue
                    if in_think:
                        think_buf += text
                        if "</think>" in think_buf:
                            in_think = False
                            after = think_buf.split("</think>", 1)[1]
                            think_buf = ""
                            if after:
                                yield f"data: {json.dumps({'text': after})}\n\n"
                    elif "<think>" in text:
                        before, rest = text.split("<think>", 1)
                        if before:
                            yield f"data: {json.dumps({'text': before})}\n\n"
                        in_think = True
                        think_buf = rest
                        if "</think>" in think_buf:
                            in_think = False
                            after = think_buf.split("</think>", 1)[1]
                            think_buf = ""
                            if after:
                                yield f"data: {json.dumps({'text': after})}\n\n"
                    else:
                        yield f"data: {json.dumps({'text': text})}\n\n"
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                if "rate_limit" in str(e).lower() or "429" in str(e):
                    continue
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                yield "data: [DONE]\n\n"
                return
        yield f"data: {json.dumps({'error': 'Все модели исчерпали дневную квоту. Попробуй через час.'})}\n\n"
        yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


TTS_VOICE = "ru-RU-SvetlanaNeural"

@app.route("/api/tts", methods=["POST"])
def tts():
    text = (request.json or {}).get("text", "").strip()
    if not text:
        return jsonify({"error": "No text"}), 400

    async def _collect():
        buf = bytearray()
        communicate = edge_tts.Communicate(text, TTS_VOICE)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.extend(chunk["data"])
        return bytes(buf)

    audio_bytes = asyncio.run(_collect())
    return Response(audio_bytes, mimetype="audio/mpeg",
                    headers={"Cache-Control": "no-cache"})


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    audio = request.files.get("audio")
    if not audio:
        return jsonify({"error": "No audio"}), 400
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        audio.save(f.name)
        with open(f.name, "rb") as af:
            result = client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=("audio.webm", af, "audio/webm"),
                language="ru",
            )
    return jsonify({"text": result.text})


if __name__ == "__main__":
    app.run(debug=True, port=5002, host="0.0.0.0")
