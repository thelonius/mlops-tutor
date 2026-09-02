# Деплой mlops-tutor

## TL;DR

```
PR → review → merge в main → GitHub Actions автоматически:
  1. pytest gate
  2. scp файлов на прод
  3. docker compose restart mlops_app + смоук
  4. md5 verify (прод == main)
```

Никаких `scp` вручную. Никакого `ssh root@...` для записи. Только PR + merge.

## Архитектура

- Прод: https://mlops-31-130-130-11.sslip.io:4443/
- Сервер: `root@31.130.130.11`, ключ `~/.ssh/cesium_replica_key`
- Путь: `/root/mlops-tutor/`, compose-файл — `deploy/docker-compose.server.yml`
- Стек: только gunicorn в Docker. Файлы монтируются bind-mount'ами, поэтому обычная выкатка — это `restart`, без пересборки образа.

### Почему порт 4443 и чужой Caddy

Машина общая: на ней уже живут gpx-tracker (владеет хостовым `:443`), ssd-radar и astro-стек. Хостовый `:80` занят контейнером `ssd_radar_caddy`, а ACME HTTP-01 требует именно его — поэтому второй Caddy на этой машине сертификат Let's Encrypt уже не выпишет.

mlops-tutor подключён третьим сайтом к `ssd_radar_caddy`, ровно как до этого astro. Конфиг живёт в соседнем репозитории: [`ssd/deploy/Caddyfile`](https://github.com/) → блок `{$MLOPS_DOMAIN}`. Caddy видит наш контейнер через внешнюю docker-сеть `mlops_edge`.

⚠️ **Имя compose-сервиса не должно быть `app`.** Compose публикует имя сервиса как DNS-алиас в каждой подключённой сети, а `ssd_radar_caddy` сидит сразу в трёх. 28.08.2026 второй `app` в `mlops_edge` перехватил трафик ssd-radar и уронил его в 502: Caddy дозванивался до нашего контейнера на порт 8000, которого там нет. Поэтому сервис называется `mlops_app`, а upstream'ы в Caddyfile адресуются по `container_name`, а не по имени сервиса.

Persistent state — `/root/mlops-tutor/data/` (содержит `shares.db`). **CI/CD её не трогает.** Workflow копирует только whitelist из шага Copy files.

### Ключ OpenRouter

`/root/mlops-tutor/.env` **не** деплоится workflow'ом — compose монтирует его с хоста. При смене `OPENROUTER_API_KEY` править файл на сервере руками и перезапускать контейнер.

## Workflow

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) запускается на:

- `push` в `main` — полный pipeline (test + deploy + verify);
- `pull_request` в `main` — только тесты (deploy шаг условный).

### Job `test` (всегда)

- Установка зависимостей из `requirements.txt`.
- Прогон `pytest -v` по `tests/`.
- При failure — pipeline останавливается, deploy не идёт.

### Job `deploy` (только на push в main, после прохождения test)

1. **Copy files**: `appleboy/scp-action` копирует whitelist файлов в `/root/mlops-tutor/`. `data/` и `.env` НЕ трогаются.
2. **Restart**: `docker compose -f docker-compose.server.yml restart mlops_app`, первые 20 строк логов и смоук-запрос к публичному URL.
3. **Verify prod == main (md5)**: для каждого деплоимого файла сравнивает локальный md5 с тем что на проде. Если разъезжается — fail.

### Concurrency guard

`concurrency: { group: deploy-prod, cancel-in-progress: false }` — гарантирует что в один момент идёт максимум один деплой. Если PR смержат во время идущего деплоя — следующий встанет в очередь.

## GitHub Secrets

В Repo Settings → Secrets and variables → Actions:

- `SSH_HOST` — `31.130.130.11`
- `SSH_USER` — `root`
- `SSH_PRIVATE_KEY` — приватный ключ, авторизованный на этом сервере. Локально это `~/.ssh/cesium_replica_key` (тот же, которым ходит `ssd/deploy.sh`).

⚠️ **После переезда 28.08.2026 секреты не обновлялись.** Пока в них старый мёртвый `91.84.112.120`, merge в main упадёт на шаге Copy files. Проверить и выставить:

```bash
gh secret list
gh secret set SSH_HOST --body 31.130.130.11
gh secret set SSH_USER --body root
gh secret set SSH_PRIVATE_KEY < ~/.ssh/cesium_replica_key
```

Отдельный deploy-only ключ лучше, чем переиспользование личного: см. следующий раздел.

## Что делать когда workflow упал

### test упал

Тесты сломаны на main — это блокировка ВСЕХ deploy'ев. Не пытаться обходить, не disable'ить тесты. Открыть hot-fix PR.

### Copy files упал

Чаще всего: ключ протух / прод недоступен / disk full.

```bash
gh run view <run-id> --log     # читать логи
ssh -i ~/.ssh/cesium_replica_key root@31.130.130.11 "df -h"   # проверить место
gh run rerun <run-id>          # повтор
```

### Verify md5 упал

Прод после деплоя не равен main. Возможные причины:

1. `scp-action` не докатил часть файлов (см. логи Copy files).
2. Кто-то параллельно делал что-то на проде вручную.
3. Файл изменился между checkout и concrete copy (race, должна гасить concurrency-группа).

В большинстве случаев лечится `gh run rerun <run-id>`.

## Добавление новых Python модулей

При добавлении нового `.py` файла (например, `vacancy_provider.py`, `config.py` и т.д.) нужно обновить **две конфиги**:

### 1. Обновить `.github/workflows/deploy.yml`

В шаге "Copy files to server" добавить файл в whitelist:

```yaml
- name: Copy files to server
  source: "app.py,curriculum.py,shares.py,new_module.py,requirements.txt,static/,data/tts_terms.tsv"
```

И в шаге "Verify prod == main (md5)" добавить файл в FILES:

```bash
FILES="app.py curriculum.py shares.py new_module.py requirements.txt static/dist/index.html data/tts_terms.tsv"
```

### 2. Обновить `deploy/docker-compose.server.yml`

Добавить volume для нового модуля:

```yaml
volumes:
  - ../app.py:/app/app.py:ro
  - ../curriculum.py:/app/curriculum.py:ro
  - ../new_module.py:/app/new_module.py:ro
```

Файл входит в whitelist шага Copy files, так что на сервер он уедет сам. Но `restart` не подхватывает новые volume — контейнер надо пересоздать:

```bash
ssh -i ~/.ssh/cesium_replica_key root@31.130.130.11 \
  "cd /root/mlops-tutor/deploy && docker compose -f docker-compose.server.yml up -d --force-recreate"
```

### Пример: Как это выглядело при добавлении vacancy_provider.py

**Ошибка без обновления:**
```
File "/app/app.py", line 8, in <module>
  from curriculum import CURRICULUM, TOPICS, build_system_prompt
File "/app/curriculum.py", line 2, in <module>
  from vacancy_provider import Vacancy
ModuleNotFoundError: No module named 'vacancy_provider'
```

**Решение:**
1. Добавить `vacancy_provider.py` в deploy.yml whitelist
2. Добавить volume в docker-compose.yml
3. Запушить обновления в main
4. После deploy пересоздать контейнер если нужно

## Откат

Workflow откатов нет — потому что main линейный и всегда «последний правильный». Откатить = revert PR'а в main:

```bash
gh pr revert <pr-number>
# или
git revert <commit-sha> && git push origin main
```

Auto-deploy выкатит revert на прод за минуту.

## Что было раньше (и почему так больше нельзя)

До 2026-05-13 в [CLAUDE.md](.claude/CLAUDE.md) была инструкция:

```bash
# ⛔ НЕ ДЕЛАТЬ
scp curriculum.py app.py root@91.84.112.120:/opt/mlops-tutor/
ssh root@91.84.112.120 "cd /opt/mlops-tutor && docker compose restart app"
```

Это работало для одного человека и одной сессии. Но при множестве feature-веток и Claude-сессий вызывало регулярный регресс: фича оставалась только на проде, в main не попадала, следующий auto-deploy её сносил. Зафиксировано минимум **10 повторений**.

Поэтому:
1. Auto-deploy через GitHub Actions — единственный путь файлов на прод.
2. CLAUDE.md и memory это явно фиксируют.
3. Verify-шаг workflow ловит если кто-то всё же делал scp вручную: следующий деплой провалится на md5-verify, и инцидент станет видимым.

Если в будущем хочется ещё крепче — на проде можно сделать SSH force-command чтобы deploy-ключ мог ТОЛЬКО запускать `rsync --server` и `docker compose restart`, а личный SSH-ключ убрать из `authorized_keys` или дать ему shell без записи в `/root/mlops-tutor/`. Это уже физический предохранитель, не процессный.
