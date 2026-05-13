# Drills runner — правила игры

## Файлы
- `questions.yaml` — банк вопросов с рубриками
- `state.json` — состояние FSRS-планировщика (per question)
- `sessions/<date>-<kind>.md` — транскрипты сеансов

## Сущности

### Question (`questions.yaml`)
```yaml
- id: <domain-NNN>           # k8s-001, tf-002, ...
  domain: k8s|tf|cloud|cicd|obs|sec
  difficulty: 1..5            # 1 — junior, 5 — staff
  kind: recall|scenario|debug|design
  prompt: |
    ...
  rubric:
    must:    [список ключевых пунктов — без них ответ неполный]
    bonus:   [углубления, поднимающие оценку]
    pitfall: [типичные ошибки, которые надо отметить если попался]
  refs: [короткие ссылки на доку/keyword для самопроверки]
```

### Per-question state (`state.json`)
```json
{
  "k8s-001": {
    "stability":  3.2,        // дней до следующего повтора при good
    "difficulty": 5.0,        // 1..10, FSRS-lite
    "reps":       2,
    "lapses":     0,
    "last_grade": "good",     // again|hard|good|easy
    "last_at":    "2026-05-01T12:00:00Z",
    "due":        "2026-05-04T12:00:00Z"
  }
}
```

## FSRS-lite (упрощённая)
После каждого ответа:
- `again` (verdict=wrong):    stability ← max(0.5, stability * 0.3); lapses++; reps=0
- `hard`  (verdict=partial):  stability ← stability * 1.2;            reps++
- `good`  (verdict=correct):  stability ← stability * (2.0 + difficulty/10); reps++
- `easy`  (verdict=correct, и пользователь сказал «легко»): stability ← stability * 3.0; reps++; difficulty -= 0.5

`due = last_at + stability days`. Новые вопросы: stability=1, difficulty=5, due=now.

## Очередь сеанса
1. **Due**: все где `due <= now` (повторы), сортируем по «насколько просрочено».
2. **New**: `min(N_new_per_day, оставшееся место)` из не-просмотренных. Берём с difficulty ближе к текущему уровню.
3. **Цель сеанса**: 8–12 вопросов. Не больше — иначе устаёт внимание.

## Грейдинг
После каждого ответа я (Claude) выдаю JSON-блок:
```
VERDICT: correct|partial|wrong
SCORE:   0.0..1.0
HIT:     [пункты из must, которые покрыл]
MISS:    [пункты из must, не упомянул]
PITFALL: [если попал в типичную ошибку]
NEXT:    again|hard|good|easy
```
Плюс короткий текстовый фидбек и ссылки на доку для пробелов.
Затем обновляю `state.json` и иду к следующему вопросу.

## Команды пользователя в сеансе
- `пас` / `skip` — не знаю, грейдим как `again`, идём дальше
- `подсказка` — даю минимальный hint без ответа
- `разбор` — даю эталонный ответ + объяснение, грейдим как `again`
- `easy` — после correct поднимает интервал
- `стоп` — финализируем сеанс, пишем отчёт
- `режим: targeted <domain>` — следующий сеанс только из домена

## Калибровка
Первый сеанс — 10 вопросов поперёк всех 6 доменов, по 1–2 на домен,
смешанной сложности. Цель — оценить базовый уровень и выставить
стартовую difficulty по доменам.

## Конец сеанса — отчёт
В `sessions/<date>.md`:
- список вопросов, verdict, score
- mastery per domain (среднее score за сеанс)
- top-3 пробела (must-пункты с MISS)
- что повторить завтра (due ≤ tomorrow)
