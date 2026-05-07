# Cheatsheet Mode + Sidebar Cleanup Design

**Дата:** 2026-05-07  
**Статус:** approved

## Контекст

MLOps Tutor — интерактивный тренажёр с тремя режимами (learn/quiz/mock). Нужно добавить:
1. Режим "📋 Чит-шит" — быстрый просмотр ключевых Q&A по теме без LLM
2. Очистить сайдбар: убрать текстовые заголовки групп, оставить разделители-линии
3. Удалить тему `mock_interview` — дублирует кнопку режима Mock Interview

## Изменения

### 1. curriculum.py

**Удалить `mock_interview` из `TOPICS` и из `CURRICULUM`.**

Группа `week4` после удаления:
```python
{
    "id": "week4",
    "title": "Неделя 4: Интервью",
    "topics": ["system_design"],
},
```

Поле `title` у групп CURRICULUM не отображается пользователю после этой фичи (только разделитель-линия), но остаётся в данных для совместимости.

**Добавить поле `cheatsheet` к каждой теме.**

Формат:
```python
"cheatsheet": [
    {"q": "Вопрос одной строкой?", "a": "Ответ 1–2 предложения. Конкретно, без воды."},
    ...  # 8–10 пар
]
```

Правила контента:
- Вопрос — то, что реально спрашивают на собесе (из `interview_focus` темы)
- Ответ — 1–3 строки, факты и различия, без предисловий
- Технические термины как есть (L1, NDCG, MIG, etc.)
- Язык: русский, технические термины английские

**Пример для `ml_linear`:**
```python
"cheatsheet": [
    {"q": "В чём разница L1 и L2 регуляризации?",
     "a": "L1 (Lasso) обнуляет малые коэффициенты → разреженная модель. L2 (Ridge) штрафует за размер, но не обнуляет. ElasticNet = L1 + L2."},
    {"q": "Почему нужна стандартизация перед Ridge/Lasso?",
     "a": "Регуляризация штрафует за размер коэффициентов. Разные масштабы фич → неравномерный штраф. StandardScaler выравнивает."},
    {"q": "Когда L1 лучше L2?",
     "a": "Когда нужна feature selection: L1 обнуляет ненужные фичи. При сотнях фич из которых значимы единицы."},
    {"q": "Когда ElasticNet?",
     "a": "Много коррелированных фич: L1 выбирает одну из группы, ElasticNet оставляет несколько. Контролируется через l1_ratio."},
    {"q": "Как мультиколлинеарность влияет на линейную регрессию?",
     "a": "Коэффициенты становятся нестабильными (большая дисперсия). Ridge помогает — штраф стабилизирует. VIF > 10 = сигнал."},
    {"q": "Почему L1 даёт разреженность?",
     "a": "Градиент L1 постоянен (±1), а не убывает к нулю как у L2. При малых коэффициентах штраф превышает градиент loss → оптимум в нуле."},
    {"q": "Что такое regularization path?",
     "a": "График зависимости коэффициентов от α. Показывает какие фичи входят/выходят с ростом регуляризации. sklearn: LassoCV строит автоматически."},
    {"q": "Как выбрать α (силу регуляризации)?",
     "a": "Кросс-валидация: LassoCV/RidgeCV перебирают по сетке. Правило: начать с логарифмической сетки 1e-4..1e2."},
]
```

**Итого тем с cheatsheet:** 26 (все кроме удалённого `mock_interview`).
Объём: 26 × ~9 = ~234 пары.

### 2. templates/index.html

**Кнопка 4-го режима** в `.mode-section`:
```html
<button class="mode-btn" id="mode-cheatsheet" onclick="setMode('cheatsheet')">
  <span class="mode-icon">📋</span> Чит-шит
</button>
```

**Контейнер чит-шита** (скрыт по умолчанию, рядом с chat-div):
```html
<div id="cheatsheet-view" style="display:none; overflow-y:auto; padding:16px; flex:1;">
  <!-- рендерится JS при входе в режим -->
</div>
```

**CSS для карточек Q&A:**
```css
.cs-card { border-bottom: 1px solid var(--border); padding: 12px 0; }
.cs-card:last-child { border-bottom: none; }
.cs-q { font-weight: 600; color: var(--heading); margin-bottom: 4px; }
.cs-a { color: var(--text); line-height: 1.6; }
.cs-header { font-size: 15px; font-weight: 700; color: var(--heading);
             padding-bottom: 12px; border-bottom: 2px solid var(--border); margin-bottom: 4px; }
```

**Логика переключения** в `setMode()`:
```javascript
function setMode(m) {
    mode = m;
    const isCheatsheet = m === 'cheatsheet';
    document.getElementById('chat-messages').style.display = isCheatsheet ? 'none' : '';
    document.getElementById('input-row').style.display    = isCheatsheet ? 'none' : '';
    document.getElementById('cheatsheet-view').style.display = isCheatsheet ? 'flex' : 'none';
    document.getElementById('cheatsheet-view').style.flexDirection = 'column';
    // обновить active-класс на кнопках режима
    // если тема уже выбрана — рендерим чит-шит
    if (isCheatsheet && topic) renderCheatsheet(topic);
    saveSession();
}
```

**Функция рендера:**
```javascript
function renderCheatsheet(tid) {
    const t = topics[tid];
    if (!t || !t.cheatsheet) return;
    const view = document.getElementById('cheatsheet-view');
    const color = t.track === 'ml' ? '#22c55e' : '#a78bfa';
    view.innerHTML = `
        <div class="cs-header">${t.emoji} ${t.title}</div>
        ${t.cheatsheet.map(pair => `
            <div class="cs-card">
                <div class="cs-q" style="color:${color}">❓ ${pair.q}</div>
                <div class="cs-a">${pair.a}</div>
            </div>
        `).join('')}
    `;
}
```

**Вызов renderCheatsheet** при выборе темы (`selectTopic`): если текущий режим `cheatsheet`, вызвать `renderCheatsheet(tid)`. Это значит пользователь может листать темы в режиме чит-шита — каждая смена темы перерендеривает контент без сброса режима.

**Сайдбар — заголовки групп.**

Текущий код рендера:
```javascript
html += `<div class="week-label">${week.title}</div>`;
```

Заменить на:
```javascript
if (i > 0) html += `<div class="week-divider"></div>`;
```

CSS:
```css
.week-divider { height: 1px; background: var(--border); margin: 8px 12px; }
```

Первая группа не получает разделитель сверху (`i > 0`).

**mode-badge:** добавить `badge-cheatsheet`:
```css
.badge-cheatsheet { background: #22c55e20; color: #22c55e; }
```

И в логику обновления badge при смене режима.

### 3. tests/test_curriculum.py

Добавить три теста:

```python
def test_all_topics_have_cheatsheet():
    for tid, topic in TOPICS.items():
        assert "cheatsheet" in topic, f"Topic '{tid}' missing 'cheatsheet' field"
        assert 8 <= len(topic["cheatsheet"]) <= 10, (
            f"Topic '{tid}' cheatsheet has {len(topic['cheatsheet'])} pairs, expected 8-10"
        )

def test_cheatsheet_pairs_have_q_and_a():
    for tid, topic in TOPICS.items():
        for i, pair in enumerate(topic.get("cheatsheet", [])):
            assert "q" in pair and "a" in pair, (
                f"Topic '{tid}' cheatsheet pair {i} missing 'q' or 'a'"
            )
            assert len(pair["q"]) > 10, f"Topic '{tid}' pair {i} question too short"
            assert len(pair["a"]) > 10, f"Topic '{tid}' pair {i} answer too short"

def test_mock_interview_removed():
    assert "mock_interview" not in TOPICS, "mock_interview should be removed from TOPICS"
    for group in CURRICULUM:
        assert "mock_interview" not in group["topics"], (
            f"mock_interview still in CURRICULUM group '{group['id']}'"
        )
```

## Что НЕ входит в эту итерацию

- Поиск по чит-шиту
- Возможность пометить Q&A как "знаю/не знаю"
- Генерация чит-шита через AI
- Обновление progress-dots для cheatsheet-режима
- Тултипы на терминах в чит-шите (glossary.js)
