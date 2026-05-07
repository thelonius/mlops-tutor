import json
import logging
import os
import time

import httpx
from curriculum import CURRICULUM, TOPICS, build_system_prompt
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request, stream_with_context
from openai import OpenAI

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("tutor")

# httpx таймауты: connect=10s, read=30s между чанками. Если Groq замолчал
# на 30 секунд — ловим ReadTimeout и переключаемся на следующую модель.
client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
    timeout=httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0),
)

app = Flask(__name__)

# Цепочка моделей. При rate-limit или зависании — переходим на следующую.
# llama-3.1-8b в конце: у неё баг с CJK-символами.
MODELS = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instant",
]

PRETTY = {
    "llama-3.3-70b-versatile": "Llama 3.3 70B",
    "openai/gpt-oss-120b": "GPT OSS 120B",
    "meta-llama/llama-4-scout-17b-16e-instruct": "Llama 4 Scout 17B",
    "llama-3.1-8b-instant": "Llama 3.1 8B",
}

STALL_EXCEPTIONS = (
    httpx.ReadTimeout,
    httpx.ConnectTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    httpx.RemoteProtocolError,
    httpx.ReadError,
)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/curriculum")
def get_curriculum():
    return jsonify({"curriculum": CURRICULUM, "topics": TOPICS})


@app.route("/api/models")
def get_models():
    options = [{"id": "auto", "label": "⚡ Авто (с резервом)"}]
    options.extend({"id": m, "label": PRETTY.get(m, m)} for m in MODELS)
    return jsonify({"models": options})


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    topic_id = data.get("topic_id", "")
    mode = data.get("mode", "learn")
    chosen = data.get("model") or "auto"

    if not messages:
        return jsonify({"error": "No messages"}), 400

    if chosen != "auto" and chosen not in MODELS:
        return jsonify({"error": f"Unknown model: {chosen}"}), 400

    chain = MODELS if chosen == "auto" else [chosen]

    system_prompt = build_system_prompt(topic_id, mode)
    nim_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": m["role"] if m["role"] == "user" else "assistant", "content": m["content"]}
        for m in messages
    ]

    log.info(
        "chat.start topic=%s mode=%s model=%s msg_count=%d",
        topic_id, mode, chosen, len(messages),
    )

    def generate():
        for i, model in enumerate(chain):
            chunks = 0
            t0 = time.time()
            try:
                stream = client.chat.completions.create(
                    model=model,
                    messages=nim_messages,
                    stream=True,
                    temperature=0.7,
                    max_tokens=1024,
                )
                yield _sse({"model": model})
                if i > 0:
                    yield _sse({"notice": f"Резервная модель: {PRETTY.get(model, model)}"})
                for chunk in stream:
                    text = chunk.choices[0].delta.content
                    if text:
                        chunks += 1
                        yield _sse({"text": text})
                yield "data: [DONE]\n\n"
                log.info(
                    "chat.done topic=%s model=%s chunks=%d dur=%.2fs",
                    topic_id, model, chunks, time.time() - t0,
                )
                return
            except STALL_EXCEPTIONS as e:
                log.warning(
                    "chat.stalled topic=%s model=%s chunks=%d dur=%.2fs reason=%s",
                    topic_id, model, chunks, time.time() - t0, type(e).__name__,
                )
                if chosen != "auto":
                    yield _sse({
                        "notice": f"Модель {PRETTY.get(model, model)} залипла. "
                                  "Выбери другую в меню сверху."
                    })
                    yield "data: [DONE]\n\n"
                    return
                yield _sse({
                    "notice": f"{PRETTY.get(model, model)} замолчала, переключаюсь на резервную..."
                })
                continue
            except Exception as e:
                err_str = str(e).lower()
                if "rate_limit" in err_str or "429" in err_str:
                    log.warning("chat.rate_limit topic=%s model=%s", topic_id, model)
                    if chosen != "auto":
                        yield _sse({
                            "notice": f"Квота на {PRETTY.get(model, model)} исчерпана. "
                                      "Выбери другую модель."
                        })
                        yield "data: [DONE]\n\n"
                        return
                    yield _sse({
                        "notice": f"{PRETTY.get(model, model)} — лимит исчерпан, переключаюсь."
                    })
                    continue
                log.exception("chat.error topic=%s model=%s", topic_id, model)
                yield _sse({"error": str(e)})
                yield "data: [DONE]\n\n"
                return

        log.warning("chat.exhausted topic=%s chain=%s", topic_id, chain)
        yield _sse({"error": "Все модели исчерпали дневную квоту. Попробуй через час."})
        yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    app.run(debug=True, port=5002, host="0.0.0.0")
