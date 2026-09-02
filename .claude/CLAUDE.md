# MLOps Tutor — заметки для Claude

## Деплой на прод

Прод: https://mlops-31-130-130-11.sslip.io:4443/
Сервер: `root@31.130.130.11` (ключ `~/.ssh/cesium_replica_key`)
Путь на сервере: `/root/mlops-tutor/`, compose — `deploy/docker-compose.server.yml`
Стек: только gunicorn в Docker, файлы как bind-mount.

TLS терминирует **чужой** Caddy — `ssd_radar_caddy` из соседнего стека `/root/ssd-radar`, конфиг [ssd/deploy/Caddyfile](file:///Users/eddubnitsky/ssd/deploy/Caddyfile), блок `{$MLOPS_DOMAIN}`. Свой Caddy тут завести нельзя: ACME HTTP-01 требует хостовый порт 80, а им владеет этот контейнер. Машина общая — рядом живут gpx-tracker (хостовый `:443`), ssd-radar и astro.

⚠️ **Имя compose-сервиса не должно быть `app`.** Compose публикует имя сервиса DNS-алиасом в каждой подключённой сети, а `ssd_radar_caddy` подключён к трём. 28.08.2026 второй `app` в `mlops_edge` перехватил трафик ssd-radar и уронил его в 502. Сервис называется `mlops_app`, upstream'ы в Caddyfile адресуются по `container_name`.

⚠️ **GitHub Secrets после переезда 28.08.2026 не обновлены.** `SSH_HOST`/`SSH_USER`/`SSH_PRIVATE_KEY` всё ещё указывают на мёртвый `91.84.112.120` — пока их не поправить, merge в main упадёт на шаге Copy files. Команды — в [docs/DEPLOY.md](../docs/DEPLOY.md#github-secrets).

`.env` с `OPENROUTER_API_KEY` лежит на сервере и workflow'ом **не** деплоится — compose монтирует его с хоста.

Старые серверы `91.84.112.120` и `176.123.166.252` мертвы, SSH-алиас `mlops-tutor` указывает на первый из них.

### Единственный способ деплоя — merge в main

Деплой автоматический через [GitHub Actions workflow](../.github/workflows/deploy.yml). Любой merge PR в `main` запускает:

1. `pytest` gate (без зелёного — деплой не пойдёт);
2. scp файлов на прод;
3. `docker compose restart mlops_app` + смоук-запрос;
4. md5-верификация что прод действительно равен main.

Подробнее: [docs/DEPLOY.md](../docs/DEPLOY.md).

### ⛔ Запрещено

- **Никаких `scp` вручную с feature-веток** на прод. Каждый раз когда мы это делали — фича из ветки оставалась на проде, не попадала в main, и следующий merge в main её сносил. Регресс повторялся 10+ раз.
- **Никаких `ssh root@... "echo ... > /root/mlops-tutor/..."`** или прямой правки файлов на проде. То же самое.
- **Никакого force-push в `main`.** Только через PR + merge.

Если очень нужно срочно проверить что-то на проде вне обычного цикла — открой PR, дождись deploy (≤2 минуты). Workflow специально не пускает параллельные деплои (`concurrency: deploy-prod`), так что не сломаешь чужую работу.

### Как продолжить деплой если упал

Workflow на md5-verify шаге может вылететь с «прод не равен main». Это значит:

1. Либо deploy шаг не докатил файлы — посмотреть логи `Copy files to server`.
2. Либо кто-то делал scp вручную поверх (теперь это поймает verify-шаг).

В обоих случаях: перезапустить workflow (`gh run rerun <run-id>`). Это просто перельёт main-state на прод.

### Доступ для отладки

```bash
ssh -i ~/.ssh/cesium_replica_key root@31.130.130.11
```

Только для **чтения логов и инспекции** (`docker compose logs`, `ls`, `cat`). НЕ для записи файлов — причины выше.

SSH-алиас `mlops-tutor` указывает на мёртвый `91.84.112.120`, им не пользоваться.
