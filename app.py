import base64
import hashlib
import json
import os
import re
from collections import OrderedDict

from curriculum import CURRICULUM, TOPICS, build_system_prompt
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
import asyncio
import tempfile
import edge_tts
from openai import OpenAI

import shares

load_dotenv()

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
)

gemini_client = OpenAI(
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    api_key=os.getenv("GEMINI_API_KEY", ""),
)

GEMINI_MODELS = {"gemma-4-31b-it", "gemma-4-26b-a4b-it"}

# Модели с reasoning-каналом отдают рассуждения в парных тегах. Стрипаем их
# в стриме перед отдачей пользователю. Qwen использует <think>, Gemma — <thought>.
THINK_TAG_PAIRS = [("<think>", "</think>"), ("<thought>", "</thought>")]

app = Flask(__name__)
shares.init_db(os.getenv("SHARES_DB_PATH", "data/shares.db"))


def _b64url_decode(s: str) -> bytes:
    s = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")

# Цепочка моделей: при 429 на одной — переключаемся на следующую.
# Маленькую llama-3.1-8b держим в самом конце — у неё баг с CJK.
MODELS = [
    "llama-3.3-70b-versatile",                    # основная, 100K токенов/день
    "qwen/qwen3-32b",                             # Qwen3 32B — хорошее качество, своя квота
    "openai/gpt-oss-120b",                        # 120B, отдельная квота
    "meta-llama/llama-4-scout-17b-16e-instruct",  # ещё запас
    "llama-3.1-8b-instant",                       # последний — может давать иероглифы
    "gemma-4-31b-it",                             # Gemma 4 31B via Gemini API
    "gemma-4-26b-a4b-it",                         # Gemma 4 26B via Gemini API
]


@app.route("/")
def index():
    # React-шелл, собранный через Vite в static/dist/. Деплой CI делает
    # `npm run build` в frontend/ и scp'ит результат рядом со static/.
    dist_path = os.path.join(app.static_folder, "dist", "index.html")
    if not os.path.exists(dist_path):
        return (
            "frontend bundle not built. Run `npm run build` in frontend/.",
            503,
        )
    with open(dist_path, encoding="utf-8") as f:
        return f.read()


@app.route("/api/curriculum")
def get_curriculum():
    return jsonify({"curriculum": CURRICULUM, "topics": TOPICS})


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    topic_id = data.get("topic_id") or ""
    mode = data.get("mode", "learn")
    preferred = data.get("model", MODELS[0])

    if not messages:
        return jsonify({"error": "No messages"}), 400
    if not topic_id or topic_id not in TOPICS:
        return jsonify({"error": f"Unknown topic_id: {topic_id!r}"}), 400

    system_prompt = build_system_prompt(topic_id, mode)

    chat_history = [
        {"role": m["role"] if m["role"] == "user" else "assistant", "content": m["content"]}
        for m in messages
    ]

    # Стартуем с выбранной пользователем модели, остальные — fallback
    start = MODELS.index(preferred) if preferred in MODELS else 0
    model_chain = MODELS[start:] + MODELS[:start]

    def generate():
        nim_messages = [{"role": "system", "content": system_prompt}] + chat_history
        for i, model in enumerate(model_chain):
            try:
                is_gemini = model in GEMINI_MODELS
                api_client = gemini_client if is_gemini else client
                # Gemma тратит ~600-800 токенов на <thought> до ответа,
                # поэтому ей нужен больший бюджет, чтобы успеть закрыть тег.
                max_tok = 2400 if is_gemini else 1024
                stream = api_client.chat.completions.create(
                    model=model,
                    messages=nim_messages,
                    stream=True,
                    temperature=0.7,
                    max_tokens=max_tok,
                )
                if i > 0:
                    note = f"_(резервная модель: {model})_\n\n"
                    yield f"data: {json.dumps({'text': note})}\n\n"
                # Стрипаем reasoning-теги: содержимое <thought>...</thought>
                # отдаём отдельным каналом 'thinking', чтобы фронт мог показать
                # его приглушённо «модель думает». Реальный ответ идёт как 'text'.
                in_think = False
                close_tag = ""
                think_buf = ""           # для поиска close_tag через границу чанков
                last_think_content = ""  # полное содержимое последнего thought-блока
                yielded_text = False

                def ev_text(s):
                    nonlocal yielded_text
                    yielded_text = True
                    return f"data: {json.dumps({'text': s})}\n\n"

                def ev_thinking(s):
                    return f"data: {json.dumps({'thinking': s})}\n\n"

                for chunk in stream:
                    text = chunk.choices[0].delta.content
                    if not text:
                        continue
                    if in_think:
                        # Закрывающий тег может прийти на стыке чанков.
                        candidate = think_buf + text
                        if close_tag in candidate:
                            inside, _, after = candidate.partition(close_tag)
                            new_inside = inside[len(think_buf):]
                            if new_inside:
                                yield ev_thinking(new_inside)
                            last_think_content += new_inside
                            in_think = False
                            close_tag = ""
                            think_buf = ""
                            if after:
                                yield ev_text(after)
                        else:
                            # Часть текста, безопасную от частичного close_tag, отдаём.
                            keep = max(len(close_tag) - 1, 0)
                            safe_end = len(candidate) - keep
                            if safe_end > len(think_buf):
                                emit = candidate[len(think_buf):safe_end]
                                if emit:
                                    yield ev_thinking(emit)
                                    last_think_content += emit
                                think_buf = candidate[safe_end:]
                            else:
                                think_buf = candidate
                        continue
                    # Не в thought — ищем самый ранний открывающий тег.
                    earliest = None
                    for open_t, close_t in THINK_TAG_PAIRS:
                        idx = text.find(open_t)
                        if idx != -1 and (earliest is None or idx < earliest[0]):
                            earliest = (idx, open_t, close_t)
                    if earliest is not None:
                        idx, open_t, close_t = earliest
                        before = text[:idx]
                        rest = text[idx + len(open_t):]
                        if before:
                            yield ev_text(before)
                        in_think = True
                        close_tag = close_t
                        think_buf = ""
                        # Обработать остаток текущего чанка как «внутри thought».
                        if close_tag in rest:
                            inside, _, after = rest.partition(close_tag)
                            if inside:
                                yield ev_thinking(inside)
                                last_think_content += inside
                            in_think = False
                            close_tag = ""
                            think_buf = ""
                            if after:
                                yield ev_text(after)
                        elif rest:
                            keep = max(len(close_tag) - 1, 0)
                            safe_end = len(rest) - keep
                            if safe_end > 0:
                                emit = rest[:safe_end]
                                yield ev_thinking(emit)
                                last_think_content += emit
                                think_buf = rest[safe_end:]
                            else:
                                think_buf = rest
                    else:
                        yield ev_text(text)

                # Стрим закончился. Если наружу так ничего и не вышло,
                # значит Gemma завернула весь ответ в <thought> или поток
                # оборвался по max_tokens — отдаём накопленное как ответ.
                if not yielded_text:
                    fallback = (last_think_content + think_buf).strip()
                    if fallback:
                        yield ev_text(fallback)
                    else:
                        yield ev_text("_(модель не успела сформулировать ответ, попробуй ещё раз)_")
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

AUDIO_REWRITE_PROMPT = """Перепиши текст ниже для аудио-озвучки русским женским голосом. Правила:
- Код описывай словами: «функция X принимает Y и возвращает Z», без скобок и операторов вслух.
- Формулы зачитывай словами: «сумма i от одного до n иксов в квадрате», а не «backslash sum».
- Убери markdown-разметку (звёздочки, решётки, обратные апострофы, скобки `[...](...)`).
- Списки превращай в связную речь: «во-первых», «также», «и наконец».
- Сноски вида «резервная модель: ...» удаляй.
- Английские термины пиши русской транскрипцией так, как их реально произносят русские разработчики: Docker → «докер», Kubernetes → «кубер», PyTorch → «пайторч», MLOps → «эмэл опс», FastAPI → «фастапи», API → «эй-пи-ай», GPU → «джи-пи-ю». Не «кубернетес», не «доцкер». Если термина нет в твоих знаниях — оставь латиницей, постпроцессинг доберёт.
- Сохрани смысл и порядок мыслей, текст должен звучать естественно при чтении вслух.
- Не добавляй преамбулы и комментариев. Верни только переписанный текст."""

# Словарь произношения для финального постпроцессинга. Перечитывается по mtime,
# чтобы редактирование data/tts_terms.tsv не требовало рестарта Flask.
TTS_TERMS_PATH = os.path.join(os.path.dirname(__file__), "data", "tts_terms.tsv")
_tts_terms_state: dict = {"mtime": 0.0, "patterns": []}


def _load_tts_terms() -> tuple[float, list]:
    """Возвращает (mtime, скомпилированные паттерны). Кеш по mtime файла."""
    try:
        mtime = os.path.getmtime(TTS_TERMS_PATH)
    except OSError:
        return 0.0, []
    if mtime == _tts_terms_state["mtime"] and _tts_terms_state["patterns"]:
        return mtime, _tts_terms_state["patterns"]
    terms: list[tuple[str, str]] = []
    with open(TTS_TERMS_PATH, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            src, dst = parts[0].strip(), parts[1].strip()
            if src and dst:
                terms.append((src, dst))
    # Длинные паттерны сначала: «scikit-learn» должен сработать до «scikit».
    terms.sort(key=lambda kv: len(kv[0]), reverse=True)
    # Граница слова, учитывающая кириллицу — иначе «деплой» зацепится внутри «деплоить».
    boundary_class = r"A-Za-zА-Яа-яЁё0-9"
    patterns = [
        (re.compile(rf"(?<![{boundary_class}])" + re.escape(src) + rf"(?![{boundary_class}])",
                    re.IGNORECASE), dst)
        for src, dst in terms
    ]
    _tts_terms_state["mtime"] = mtime
    _tts_terms_state["patterns"] = patterns
    return mtime, patterns


def _normalize_terms(text: str) -> str:
    """Подменяет английские термины русской транскрипцией для TTS."""
    _, patterns = _load_tts_terms()
    for pattern, repl in patterns:
        text = pattern.sub(repl, text)
    return text


# Кэш готовых mp3: ключ = sha1(voice|terms_mtime|text). mtime словаря в ключе —
# чтобы правка tts_terms.tsv автоматически инвалидировала старые озвучки.
TTS_CACHE_MAX = 64
_tts_cache: "OrderedDict[str, bytes]" = OrderedDict()


def _audio_rewrite_fallback(text: str) -> str:
    """Грубая чистка markdown, если LLM-перезапись не удалась."""
    text = re.sub(r"```[\s\S]*?```", " (далее блок кода) ", text)
    text = re.sub(r"`[^`]+`", " ", text)
    text = re.sub(r"_\(резервная модель:[^)]+\)_", "", text)
    text = re.sub(r"<think>[\s\S]*?</think>", "", text)
    text = re.sub(r"[#*`_~\[\]]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _audio_rewrite(text: str) -> str:
    """LLM-перезапись текста для аудио. При полном фейле — markdown-чистка регулярками."""
    text = text[:4000]
    # Берём только быстрые/основные модели — рерайт короткий, fallback-цепочка не нужна.
    for model in ("llama-3.3-70b-versatile", "openai/gpt-oss-120b"):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": AUDIO_REWRITE_PROMPT},
                    {"role": "user", "content": text},
                ],
                temperature=0.3,
                max_tokens=1500,
            )
            out = (resp.choices[0].message.content or "").strip()
            if out:
                return out
        except Exception as e:
            msg = str(e).lower()
            if "rate_limit" in msg or "429" in msg:
                continue
            break
    return _audio_rewrite_fallback(text)


@app.route("/api/tts", methods=["POST"])
def tts():
    text = (request.json or {}).get("text", "").strip()
    if not text:
        return jsonify({"error": "No text"}), 400

    mtime, _ = _load_tts_terms()
    cache_key = hashlib.sha1(
        f"{TTS_VOICE}|{mtime}|{text}".encode("utf-8")
    ).hexdigest()
    cached = _tts_cache.get(cache_key)
    if cached is not None:
        _tts_cache.move_to_end(cache_key)
        return Response(cached, mimetype="audio/mpeg",
                        headers={"Cache-Control": "no-cache"})

    spoken = _audio_rewrite(text)
    if not spoken:
        return jsonify({"error": "Empty rewrite"}), 502
    spoken = _normalize_terms(spoken)

    async def _collect():
        buf = bytearray()
        communicate = edge_tts.Communicate(spoken, TTS_VOICE)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.extend(chunk["data"])
        return bytes(buf)

    audio_bytes = asyncio.run(_collect())
    _tts_cache[cache_key] = audio_bytes
    if len(_tts_cache) > TTS_CACHE_MAX:
        _tts_cache.popitem(last=False)
    return Response(audio_bytes, mimetype="audio/mpeg",
                    headers={"Cache-Control": "no-cache"})


LECTURE_SYSTEM_PROMPT = """Ты ведёшь короткую аудио-лекцию для опытного инженера, который готовится к собеседованию на MLOps/ML-Engineer позицию. Тема лекции и контекст приходят в user-сообщении.

Сделай обзорный слой темы — 4-5 секций, каждая 80-150 слов разговорным русским.
Структура: введение (зачем нужна тема) → 2-3 ключевые подтемы → подводка к практике/итог.

КРИТИЧЕСКИ ВАЖНО для аудио-формата:
- Никакого кода, никакого LaTeX. Формулы зачитывай словами: «сумма i от одного до n».
- Никакого markdown — звёздочки, решётки, бэктики не работают на слух.
- Списки превращай в связную речь: «во-первых», «также», «и наконец».
- Термины раскрывай: «PVC, persistent volume claim, это запрос на хранилище».
- Конкретика и цифры — да, но без таблиц.
- Связки между секциями: «Дальше посмотрим…», «Это подводит нас к…».

Верни СТРОГО JSON в формате:
{"sections":[{"title":"Короткий заголовок 1","body":"Текст секции 80-150 слов..."},{"title":"...","body":"..."}]}

title — 2-5 слов, для визуального оглавления.
body — связный разговорный текст без переносов строк."""


@app.route("/api/lecture", methods=["POST"])
def lecture():
    topic_id = (request.json or {}).get("topic_id", "").strip()
    topic = TOPICS.get(topic_id)
    if not topic:
        return jsonify({"error": "Unknown topic"}), 400

    user_msg = (
        f"Тема: {topic.get('title', '')}.\n"
        f"О чём это: {topic.get('what', '')}.\n"
        f"Зачем это знать: {topic.get('why', '')}.\n"
        f"Что важно для интервью: {topic.get('interview_focus', '')}.\n\n"
        "Сделай аудио-лекцию по этой теме."
    )

    last_error = None
    for model in ("llama-3.3-70b-versatile", "openai/gpt-oss-120b", "qwen/qwen3-32b"):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": LECTURE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.6,
                max_tokens=3000,
                response_format={"type": "json_object"},
            )
            raw = (resp.choices[0].message.content or "").strip()
            data = json.loads(raw)
            sections = data.get("sections") or []
            sections = [
                {"title": str(s.get("title", "")).strip(),
                 "body":  str(s.get("body",  "")).strip()}
                for s in sections
                if isinstance(s, dict) and s.get("body")
            ]
            if sections:
                return jsonify({"sections": sections, "model": model})
            last_error = "empty sections"
        except Exception as e:
            msg = str(e).lower()
            last_error = str(e)
            if "rate_limit" in msg or "429" in msg:
                continue
            # Не-rate-limit ошибки — пробуем следующую модель один раз.
            continue
    return jsonify({"error": f"LLM failed: {last_error or 'unknown'}"}), 502


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


# ── Шеринг сессий ──
@app.route("/api/share", methods=["POST"])
def share_create():
    data = request.json or {}
    ct_b64 = data.get("ciphertext_b64", "")
    iv_b64 = data.get("iv_b64", "")
    if not ct_b64 or not iv_b64:
        return jsonify({"error": "missing ciphertext_b64 or iv_b64"}), 400
    try:
        ct = _b64url_decode(ct_b64)
        iv = _b64url_decode(iv_b64)
    except Exception:
        return jsonify({"error": "invalid base64"}), 400
    try:
        sid = shares.create_share(ct, iv)
    except ValueError as e:
        return jsonify({"error": str(e)}), 413
    return jsonify({"id": sid})


@app.route("/api/share/<sid>", methods=["GET"])
def share_get(sid):
    row = shares.get_share(sid)
    if not row:
        return jsonify({"error": "not found"}), 404
    ct, iv = row
    return jsonify({
        "ciphertext_b64": _b64url_encode(ct),
        "iv_b64": _b64url_encode(iv),
    })


if __name__ == "__main__":
    app.run(debug=True, port=5002, host="0.0.0.0")
