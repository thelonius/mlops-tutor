# MLOps Tutor

Интерактивный тренажёр для подготовки к собеседованию на позицию Senior MLOps Engineer.
Веб-приложение с тремя режимами работы и AI-наставником на базе Llama 3.3 70B через Groq API.

## Что внутри

**Три режима работы по 12 темам**

- 📖 **Объяснение** — наставник раскрывает тему с нуля, с аналогиями и примерами кода
- 🧠 **Квиз** — вопросы как на интервью, подсказки по запросу, фидбек после каждого ответа
- 🎯 **Mock Interview** — полная симуляция технического собеседования

**Темы (4 недели)**

1. Контейнеры, Kubernetes, PV/PVC, GPU в K8s
2. ONNX/TensorRT, Triton Inference Server, батчинг
3. ClearML, CI/CD, мониторинг моделей
4. System Design, Mock Interview

**Фишки интерфейса**

- Светлая и тёмная тема
- Тултипы по ховеру/тапу на ~100 MLOps-терминах (Pod, Triton, MIG, p99, drift и т.д.)
- Кнопка «Разобрать» на любом блоке кода — AI разъясняет каждую строку
- История каждой темы и режима сохраняется в `localStorage`
- Прогресс-индикатор по каждой теме (3 цветных точки: для каждого режима)
- Работает на телефонах: гамбургер-меню, тач-тултипы, адаптивная вёрстка
- Восстановление сессии в каждой вкладке через `sessionStorage` — можно проходить параллельно

## Стек

- **Бэкенд**: Flask + OpenAI SDK (через Groq endpoint, OpenAI-совместимый)
- **Модели**: цепочка из четырёх (Llama 3.3 70B → GPT OSS 120B → Llama 4 Scout → Llama 3.1 8B) с автоматическим fallback при rate limit
- **Фронтенд**: ванильный JS, marked.js для markdown, highlight.js для подсветки кода
- **Стриминг**: Server-Sent Events

## Запуск

```bash
# 1. Установить зависимости
pip install -r requirements.txt

# 2. Создать .env с ключом Groq (бесплатный на https://console.groq.com/keys)
cp .env.example .env
# отредактировать .env и вставить ключ

# 3. Запустить
python app.py
```

Открыть http://localhost:5002

С телефона или другого устройства в той же Wi-Fi сети — `http://<ваш-ip>:5002`
(найти IP: `ipconfig getifaddr en0` на macOS).

## Структура проекта

```
mlops_tutor/
├── app.py                  # Flask backend, SSE streaming, fallback chain
├── curriculum.py           # 12 тем, 3 system prompts (learn/quiz/mock)
├── requirements.txt
├── .env                    # GROQ_API_KEY (не в git)
├── static/
│   └── glossary.js         # ~100 MLOps терминов для тултипов
└── templates/
    └── index.html          # Single-page app
```

## Лицензия

MIT
