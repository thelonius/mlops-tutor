# ML Track: дизайн

**Дата:** 2026-05-07  
**Статус:** approved

## Контекст

MLOps Tutor — интерактивный тренажёр для подготовки к собеседованиям. Сейчас покрывает 12 тем по MLOps-инфраструктуре (K8s, Triton, ClearML, мониторинг). Пользователь хочет добавить блок ML-базы: классический ML и ML System Design.

## Цель

Добавить 15 новых тем в двух группах в сайдбаре. Все три режима (learn/quiz/mock) работают для ML-тем так же, как для MLOps. Режим learn объясняет тему с нуля, quiz и mock гоняют остро как на собесе.

Промпты для ML-тем не упоминают Wildberries/Triton/ClearML. Привязка к конкретной компании/вакансии вынесена в данные (словарь `TRACKS`), не зашита в строки промптов.

## Архитектура

### Новый словарь TRACKS в curriculum.py

```python
TRACKS = {
    "mlops": {
        "mentor_role": "MLOps наставник",
        "interviewer_role": "Senior MLOps Engineer",
        "target_position": "Senior MLOps Engineer",
        "company": "Wildberries, команда Trust & Safety",
        "company_details": "контент-модерация, GPU Kubernetes кластер, Triton, ClearML, команда 20+ DS",
        "student_profile": "Опытный Python/ML/Fullstack разработчик (5+ лет), но никогда не работал с Kubernetes, Triton и ML-инфраструктурой.",
    },
    "ml": {
        "mentor_role": "ML наставник",
        "interviewer_role": "ML Engineer-интервьюер",
        "target_position": "ML Engineer",
        "company": None,
        "company_details": None,
        "student_profile": "Опытный Python-разработчик (5+ лет), на практике касался ML, готовится к собеседованию на ML Engineer.",
    },
}
```

Поле `company` — `None` значит что блок про компанию не вставляется в промпт.

### Промпт-шаблоны

Три константы наверху файла (`LEARN_PROMPT_TEMPLATE`, `QUIZ_PROMPT_TEMPLATE`, `MOCK_PROMPT_TEMPLATE`) вместо f-строк внутри функции. Плейсхолдеры:

- `{mentor_role}` — "MLOps наставник" / "ML наставник"
- `{target_position}` — "Senior MLOps Engineer" / "ML Engineer"
- `{student_profile}` — описание ученика
- `{company_block}` — если `company is None`, пустая строка; иначе "в {company} ({company_details})"
- `{title}`, `{what}`, `{why}`, `{interview_focus}` — поля из TOPICS

### Поле track в TOPICS

Каждая тема получает `track: "mlops"` или `track: "ml"`. Функция `build_system_prompt` читает `topic["track"]`, берёт `TRACKS[track]`, форматирует нужный шаблон.

Поле `week` у новых ML-тем не заполняется — в коде оно не используется (группировка сделана через `CURRICULUM`, не через `week` внутри темы).

### Изменения по файлам

| Файл | Что меняется |
|------|-------------|
| `curriculum.py` | + `TRACKS`, + шаблоны-константы, + `track` у всех тем, + 15 новых тем, + 2 новые группы в `CURRICULUM`, рефакторинг `build_system_prompt` |
| `app.py` | Без изменений |
| `templates/index.html` | Без изменений |
| `static/glossary.js` | Без изменений (ML-глоссарий — отдельная задача при необходимости) |

## Темы

### Группа: ML: классика (10 тем)

| id | title | emoji | interview_focus |
|----|-------|-------|----------------|
| `ml_linear` | Линейные модели и регуляризация | 📐 | L1/L2/ElasticNet, геометрическая интерпретация, когда какая |
| `ml_logreg` | Логистическая регрессия и калибровка | 🎯 | sigmoid, log loss, Platt vs isotonic regression, когда вероятности врут |
| `ml_trees` | Деревья и Random Forest | 🌲 | bagging, OOB-оценка, feature importance, переобучение деревьев |
| `ml_boosting` | Градиентный бустинг | 🚀 | XGBoost vs LightGBM vs CatBoost, гиперпараметры, обработка категорий |
| `ml_metrics` | Метрики качества | 📊 | precision/recall/F1, ROC-AUC vs PR-AUC, MAE/MSE/MAPE, бизнес-метрики vs модельные |
| `ml_bias_variance` | Bias-variance и переобучение | ⚖️ | разложение ошибки, диагностика, регуляризация как лекарство |
| `ml_validation` | Валидация и кросс-валидация | ✂️ | k-fold, stratified, time series split, group split, nested CV |
| `ml_leakage` | Утечки данных | 💧 | target leakage, train-test contamination, типичные ловушки в фичах |
| `ml_imbalance` | Дисбаланс классов | ⚡ | resampling, class weights, threshold tuning, focal loss, выбор метрики |
| `ml_features` | Фичеинжиниринг | 🛠️ | one-hot/target encoding, scaling, NaN, взаимодействия, утечка через target encoding |

### Группа: ML: System Design (5 тем)

| id | title | emoji | interview_focus |
|----|-------|-------|----------------|
| `mlsd_framing` | Постановка ML-задачи | 🎯 | формулировка, бизнес-метрики vs модельные, baseline |
| `mlsd_skew` | Train-serving skew и фичестор | 🔄 | online vs offline фичи, point-in-time корректность, версионирование данных |
| `mlsd_ab` | A/B-тесты для ML | 🧪 | дизайн, мощность, метрики, novelty effect, sample ratio mismatch |
| `mlsd_ranking` | Ranking и рекомендации | 🥇 | candidate generation + ranking, NDCG/Recall@K, exploration vs exploitation |
| `mlsd_mock` | ML System Design Mock | 🎤 | полная симуляция кейса: фид, поиск, антифрод или другой сценарий |

### Новые группы в CURRICULUM

```python
{"id": "ml_classic", "title": "ML: классика", "topics": [
    "ml_linear", "ml_logreg", "ml_trees", "ml_boosting", "ml_metrics",
    "ml_bias_variance", "ml_validation", "ml_leakage", "ml_imbalance", "ml_features"
]},
{"id": "ml_sysdesign", "title": "ML: System Design", "topics": [
    "mlsd_framing", "mlsd_skew", "mlsd_ab", "mlsd_ranking", "mlsd_mock"
]},
```

## Поведение режимов для ML-тем

**learn** — наставник объясняет тему с нуля, использует аналогии из Python и классической математики. Проверяет понимание простым вопросом после ключевой части. До 300 слов на сообщение.

**quiz** — технический интервьюер, вопросы один за другим. Базовые → сложные. После каждого ответа: фидбек, наводящий вопрос если неполный, итог после 5–6 вопросов.

**mock** — полная симуляция собеседования на ML Engineer. Начинает с бэкграунда, потом технические вопросы, в конце — задача по ML System Design. Для `mlsd_mock` весь мок — один System Design кейс.

## Что НЕ входит в эту итерацию

- ML-глоссарий для тултипов (glossary.js)
- Deep Learning темы
- NLP/CV прикладные темы
- Привязка ML-трека к конкретной вакансии (поле `company: None` для ml-трека)
