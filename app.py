import json
import os

from curriculum import CURRICULUM, TOPICS, build_system_prompt
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request, stream_with_context
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
    "llama-3.3-70b-versatile",                 # лучшее качество, 100K токенов/день
    "openai/gpt-oss-120b",                     # 120B fallback, отдельная квота
    "meta-llama/llama-4-scout-17b-16e-instruct",  # ещё запас
    "llama-3.1-8b-instant",                    # самый последний — может выдавать иероглифы
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

    if not messages:
        return jsonify({"error": "No messages"}), 400

    system_prompt = build_system_prompt(topic_id, mode)

    nim_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": m["role"] if m["role"] == "user" else "assistant", "content": m["content"]}
        for m in messages
    ]

    def generate():
        for i, model in enumerate(MODELS):
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
                for chunk in stream:
                    text = chunk.choices[0].delta.content
                    if text:
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


if __name__ == "__main__":
    app.run(debug=True, port=5002, host="0.0.0.0")
