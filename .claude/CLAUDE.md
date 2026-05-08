# MLOps Tutor — заметки для Claude

## Деплой на прод

Прод: https://91-84-112-120.sslip.io/
Сервер: `root@91.84.112.120` (пароль в 1Password или у пользователя)
Путь на сервере: `/opt/mlops-tutor/`
Стек: Docker Compose (gunicorn + Caddy)

```bash
# Скопировать обновлённые файлы
scp curriculum.py app.py root@91.84.112.120:/opt/mlops-tutor/
scp templates/index.html root@91.84.112.120:/opt/mlops-tutor/templates/

# Перезапустить приложение
ssh root@91.84.112.120 "cd /opt/mlops-tutor && docker compose restart app"
```

Файлы монтируются как bind-mount, поэтому пересборка образа не нужна — только restart.
