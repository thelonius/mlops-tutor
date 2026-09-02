import base64
import hashlib
import json
import os
import re
from collections import OrderedDict
from typing import Optional

from curriculum import CURRICULUM, TOPICS, build_system_prompt, build_vacancy_interview_prompt
from vacancy_provider import Vacancy
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
import asyncio
import tempfile
import edge_tts
from openai import OpenAI

import shares
import vacancy_provider

load_dotenv()

# Единый вход для чата и генерации текста. OpenRouter проксирует десятки
# провайдеров под одним ключом, так что смена модели больше не тянет за собой
# новый клиент и новую переменную окружения.
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY", ""),
    default_headers={
        "HTTP-Referer": os.getenv("APP_URL", "https://176-123-166-252.sslip.io/"),
        "X-Title": "MLOps Tutor",
    },
)

# Groq остался ровно ради одного эндпоинта — whisper-large-v3 в /api/transcribe.
# У OpenRouter нет audio/transcriptions, заменить распознавание речи внутри
# того же провайдера нечем.
#
# Клиент создаём только при живом ключе: на пустую строку конструктор OpenAI
# бросает «Missing credentials» прямо при импорте, и всё приложение не стартует
# из-за одного необязательного эндпоинта.
_groq_key = os.getenv("GROQ_API_KEY", "").strip()
groq_client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=_groq_key,
) if _groq_key else None

# Zhipu напрямую. GLM-4.7-Flash и GLM-4.5-Flash у них бесплатны и идут мимо
# общего пула OpenRouter, который стабильно отдаёт 429 по free-моделям: там
# квота делится между всеми бесплатными пользователями сразу, а тут она наша.
_zhipu_key = os.getenv("ZHIPU_API_KEY", "").strip()
zhipu_client = OpenAI(
    base_url="https://api.z.ai/api/paas/v4/",
    api_key=_zhipu_key,
) if _zhipu_key else None

# Модели без слеша в имени адресуются к Zhipu, с префиксом провайдера — к
# OpenRouter. Разводим явным множеством, а не эвристикой по слешу.
ZHIPU_MODELS = {"glm-4.7-flash", "glm-4.5-flash"}

# Прямого клиента к Google AI Studio здесь нет намеренно. Ключ рабочий и с
# машины разработчика Gemma отвечает, но прод в Москве получает от Google
# 400 FAILED_PRECONDITION «User location is not supported for the API use» —
# это географическая блокировка, из кода её не обойти. Gemma остаётся
# доступной через OpenRouter, который проксирует запрос со своей стороны.


def _client_for(model: str) -> Optional[OpenAI]:
    """Клиент под конкретную модель. None — провайдер не сконфигурирован."""
    if model in ZHIPU_MODELS:
        return zhipu_client
    return client

# Модели с reasoning-каналом отдают рассуждения в парных тегах. Стрипаем их
# в стриме перед отдачей пользователю. Zhipu и OpenRouter выносят рассуждения
# в отдельное поле дельты, а Gemma через Google AI Studio присылает их прямо
# в content парой <thought>...</thought> — ради неё разбор тегов и живёт.
THINK_TAG_PAIRS = [("<think>", "</think>"), ("<thought>", "</thought>")]

app = Flask(__name__)
shares.init_db(os.getenv("SHARES_DB_PATH", "data/shares.db"))


def _b64url_decode(s: str) -> bytes:
    s = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")

# Цепочка моделей: при 429 на одной — переключаемся на следующую.
# Первыми идут бесплатные Zhipu: у них своя квота на нашем ключе, тогда как
# free-модели OpenRouter сидят на общем пуле и регулярно отвечают 429.
# Платная flash — последним запасом, на случай когда всё остальное молчит.
MODELS = [
    "glm-4.7-flash",                            # Zhipu, бесплатно, своя квота
    "glm-4.5-flash",                            # Zhipu, бесплатно, поколением младше
    "minimax/minimax-m3:free",                  # OpenRouter, 1M контекста
    "nvidia/nemotron-3-super-120b-a12b:free",   # OpenRouter, 262K
    "z-ai/glm-5.2:free",                        # OpenRouter, сидит на общем пуле
    "google/gemma-4-31b-it:free",               # OpenRouter, сидит на общем пуле
    "z-ai/glm-5.3-flash",                       # платная, ~$0.075/M вход
]

# Все модели цепочки — reasoning-capable, и рассуждения списываются из того же
# бюджета, что и ответ. На реальном промпте тренажёра glm-4.7-flash потратил
# 1245 токенов на reasoning и упёрся в лимит 2400 с finish_reason=length,
# оборвав ответ на середине. 4000 хватает и на рассуждение, и на текст.
MAX_TOKENS = 4000

# Короткие служебные генерации (аудио-рерайт, лекция) — только бесплатные:
# полная цепочка тут не нужна, а платить за вспомогательный текст незачем.
UTILITY_MODELS = ("glm-4.7-flash", "minimax/minimax-m3:free")


def _try_next_model(e: Exception) -> bool:
    """Стоит ли перейти к следующей модели цепочки вместо показа ошибки.

    429 — дневная квота или троттлинг общего free-пула провайдера.
    402 — на балансе OpenRouter нет кредитов, а модель платная. Пользователь
    может выбрать glm-5.3-flash в селекте, и тогда цепочка стартует с неё;
    без этой ветки чат падал бы, не дойдя до бесплатных.
    """
    msg = str(e).lower()
    return any(t in msg for t in ("rate_limit", "429", "402", "insufficient credits"))


_TOPIC_VECTORS: Optional[dict] = None
_TOPIC_DIM: Optional[int] = None
_TOPIC_VECTORS_PATH = os.path.join(os.path.dirname(__file__), "data", "topic_vectors.json")
_FALLBACK_TOPICS = ["containers", "k8s_basics", "system_design"]


def _load_topic_vectors() -> Optional[dict]:
    global _TOPIC_VECTORS, _TOPIC_DIM
    if _TOPIC_VECTORS is not None:
        return _TOPIC_VECTORS
    try:
        raw = json.loads(open(_TOPIC_VECTORS_PATH, encoding="utf-8").read())
        _TOPIC_VECTORS = {tid: v for tid, v in raw.items() if tid in TOPICS}
        if _TOPIC_VECTORS:
            _TOPIC_DIM = len(next(iter(_TOPIC_VECTORS.values())))
        return _TOPIC_VECTORS
    except Exception as e:
        print(f"Warning: could not load topic vectors: {e}")
        return None


def map_vacancy_to_topics(vacancy: Vacancy, vacancy_id: Optional[str] = None, top_n: int = 8) -> list[str]:
    topic_vecs = _load_topic_vectors()
    if topic_vecs and vacancy_id:
        vec = vacancy_provider.provider.get_vacancy_vector(vacancy_id)
        if vec and len(vec) == _TOPIC_DIM:
            # Vectors are pre-normalized → cosine similarity = dot product.
            scored = [(tid, sum(a * b for a, b in zip(tvec, vec))) for tid, tvec in topic_vecs.items()]
            scored.sort(key=lambda x: x[1], reverse=True)
            return [tid for tid, _ in scored[:top_n]]

    # Fallback: keyword matching
    selected = set()
    text = f"{vacancy.stack} {vacancy.requirements} {vacancy.title}".lower()
    keyword_map = {
        "containers": ["docker", "container"],
        "k8s_basics": ["kubernetes", "k8s", "helm"],
        "k8s_gpu": ["gpu", "cuda", "nvidia"],
        "model_formats": ["onnx", "tensorrt"],
        "triton_basics": ["triton", "inference server"],
        "clearml": ["clearml", "mlflow"],
        "cicd": ["gitlab ci", "github actions", "argocd"],
        "monitoring": ["prometheus", "grafana", "evidently"],
        "orchestration": ["airflow", "kubeflow"],
        "system_design": ["system design", "architecture"],
    }
    for tid, kws in keyword_map.items():
        if tid in TOPICS and any(kw in text for kw in kws):
            selected.add(tid)
    return list(selected) or _FALLBACK_TOPICS


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def index(path):
    # Отдаем React SPA для всех не-API маршрутов — чтобы /vacancy/<id> тоже работал.
    if path.startswith("api/"):
        from flask import abort
        abort(404)
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


@app.route("/api/curriculum/vacancy/<vacancy_id>")
def get_vacancy_curriculum(vacancy_id):
    vacancy = vacancy_provider.provider.get_vacancy(vacancy_id)
    if not vacancy:
        return jsonify({"error": "Vacancy not found"}), 404

    relevant_topic_ids = map_vacancy_to_topics(vacancy, vacancy_id=vacancy_id)
    filtered_topics = {tid: TOPICS[tid] for tid in relevant_topic_ids if tid in TOPICS}

    return jsonify({
        "vacancy": {
            "title": vacancy.title,
            "company": vacancy.company,
            "stack": vacancy.stack,
            "requirements": vacancy.requirements,
            "vibes": vacancy.vibes,
        },
        "curriculum": CURRICULUM,
        "topics": filtered_topics
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    topic_id = data.get("topic_id") or ""
    mode = data.get("mode", "learn")
    preferred = data.get("model", MODELS[0])
    vacancy_id = data.get("vacancy_id")
    depth = data.get("depth", "basic")
    if depth not in ("basic", "senior"):
        depth = "basic"

    if not messages:
        return jsonify({"error": "No messages"}), 400

    vacancy_data = None
    if vacancy_id:
        vacancy_data = vacancy_provider.provider.get_vacancy(vacancy_id)

    # Режим адаптивного интервью по вакансии — виртуальный топик __vacancy__.
    # topic_id не нужен: строим промпт по всем релевантным темам вакансии.
    if topic_id == "__vacancy__":
        if not vacancy_data:
            return jsonify({"error": "vacancy_id required for __vacancy__ topic"}), 400
        relevant = map_vacancy_to_topics(vacancy_data, vacancy_id=vacancy_id)
        interview_topics = {tid: TOPICS[tid] for tid in relevant if tid in TOPICS}
        system_prompt = build_vacancy_interview_prompt(vacancy_data, interview_topics)
    else:
        if not topic_id or topic_id not in TOPICS:
            return jsonify({"error": f"Unknown topic_id: {topic_id!r}"}), 400
        system_prompt = build_system_prompt(topic_id, mode, vacancy_data=vacancy_data, depth=depth)

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
                api_client = _client_for(model)
                if api_client is None:
                    continue  # провайдер модели не сконфигурирован — следующая
                stream = api_client.chat.completions.create(
                    model=model,
                    messages=nim_messages,
                    stream=True,
                    temperature=0.7,
                    max_tokens=MAX_TOKENS,
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
                    delta = chunk.choices[0].delta
                    # Рассуждения приезжают отдельным полем, а не тегами внутри
                    # content: у OpenRouter оно зовётся reasoning, у Zhipu —
                    # reasoning_content. Теговый разбор ниже остаётся для
                    # моделей, которые всё-таки присылают <think> в content.
                    reasoning = (getattr(delta, "reasoning", None)
                                 or getattr(delta, "reasoning_content", None))
                    if reasoning:
                        last_think_content += reasoning
                        yield ev_thinking(reasoning)
                    text = delta.content
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
                if _try_next_model(e):
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
    for model in UTILITY_MODELS:
        api_client = _client_for(model)
        if api_client is None:
            continue
        try:
            resp = api_client.chat.completions.create(
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
            if _try_next_model(e):
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
    for model in UTILITY_MODELS:
        api_client = _client_for(model)
        if api_client is None:
            continue
        try:
            resp = api_client.chat.completions.create(
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
            last_error = str(e)
            if _try_next_model(e):
                continue
            # Не-rate-limit ошибки — пробуем следующую модель один раз.
            continue
    return jsonify({"error": f"LLM failed: {last_error or 'unknown'}"}), 502


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    if groq_client is None:
        return jsonify({"error": "Распознавание речи выключено: не задан GROQ_API_KEY"}), 503
    audio = request.files.get("audio")
    if not audio:
        return jsonify({"error": "No audio"}), 400
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        audio.save(f.name)
        with open(f.name, "rb") as af:
            result = groq_client.audio.transcriptions.create(
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
