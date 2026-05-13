# Деплой mlops-tutor

## TL;DR

```
PR → review → merge в main → GitHub Actions автоматически:
  1. pytest gate
  2. scp файлов на прод
  3. docker compose restart app
  4. md5 verify (прод == main)
```

Никаких `scp` вручную. Никакого `ssh root@...` для записи. Только PR + merge.

## Архитектура

- Прод: https://91-84-112-120.sslip.io/
- Сервер: `root@91.84.112.120`
- Путь: `/opt/mlops-tutor/`
- Стек: Docker Compose (gunicorn внутри, Caddy перед ним для TLS)
- Файлы монтируются как bind-mount, поэтому пересборка образа не нужна — только `restart`.

Persistent state — `/opt/mlops-tutor/data/` (содержит `shares.db`). **CI/CD её не трогает.** Workflow копирует только `app.py`, `curriculum.py`, `shares.py`, `requirements.txt`, `templates/`, `static/`.

## Workflow

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) запускается на:

- `push` в `main` — полный pipeline (test + deploy + verify);
- `pull_request` в `main` — только тесты (deploy шаг условный).

### Job `test` (всегда)

- Установка зависимостей из `requirements.txt`.
- Прогон `pytest -v` по `tests/`.
- При failure — pipeline останавливается, deploy не идёт.

### Job `deploy` (только на push в main, после прохождения test)

1. **Copy files**: `appleboy/scp-action` копирует whitelist файлов в `/opt/mlops-tutor/`. `data/`, `.env`, `docker-compose.yml`, `Caddyfile`, `Dockerfile` НЕ трогаются.
2. **Restart**: `docker compose restart app` + первые 20 строк логов.
3. **Verify prod == main (md5)**: для каждого деплоимого файла сравнивает локальный md5 с тем что на проде. Если разъезжается — fail.

### Concurrency guard

`concurrency: { group: deploy-prod, cancel-in-progress: false }` — гарантирует что в один момент идёт максимум один деплой. Если PR смержат во время идущего деплоя — следующий встанет в очередь.

## GitHub Secrets

В Repo Settings → Secrets and variables → Actions:

- `SSH_HOST` — `91.84.112.120`
- `SSH_USER` — `root`
- `SSH_PRIVATE_KEY` — приватный ключ deploy-only (см. ниже)

Секреты установлены 2026-05-08, проверить:
```bash
gh secret list
```

## Deploy-ключ

На проде в `/root/.ssh/authorized_keys` лежит публичный ключ, парный к `SSH_PRIVATE_KEY` в GitHub Secrets. Это **отдельный** ключ от того, что ты используешь для личного SSH (`~/.ssh/mlops_tutor_deploy`).

### Если нужно перевыпустить ключ

```bash
# 1. На своей машине сгенерировать новую пару
ssh-keygen -t ed25519 -f /tmp/mlops_deploy_new -N '' -C 'github-actions-deploy'

# 2. Положить public на прод
ssh-copy-id -i /tmp/mlops_deploy_new.pub mlops-tutor

# 3. Обновить secret в GitHub
gh secret set SSH_PRIVATE_KEY < /tmp/mlops_deploy_new

# 4. Проверить
gh workflow run deploy.yml --ref main
gh run watch
```

## Что делать когда workflow упал

### test упал

Тесты сломаны на main — это блокировка ВСЕХ deploy'ев. Не пытаться обходить, не disable'ить тесты. Открыть hot-fix PR.

### Copy files упал

Чаще всего: ключ протух / прод недоступен / disk full.

```bash
gh run view <run-id> --log     # читать логи
ssh mlops-tutor "df -h"        # проверить место
gh run rerun <run-id>          # повтор
```

### Verify md5 упал

Прод после деплоя не равен main. Возможные причины:

1. `scp-action` не докатил часть файлов (см. логи Copy files).
2. Кто-то параллельно делал что-то на проде вручную.
3. Файл изменился между checkout и concrete copy (race, должна гасить concurrency-группа).

В большинстве случаев лечится `gh run rerun <run-id>`.

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

Если в будущем хочется ещё крепче — на проде можно сделать SSH force-command чтобы deploy-ключ мог ТОЛЬКО запускать `rsync --server` и `docker compose restart`, а личный SSH-ключ убрать из `authorized_keys` или дать ему shell без записи в `/opt/mlops-tutor/`. Это уже физический предохранитель, не процессный.
