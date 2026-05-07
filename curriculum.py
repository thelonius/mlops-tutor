TRACKS = {
    "mlops": {
        "mentor_role": "MLOps наставник",
        "target_position": "Senior MLOps Engineer",
        "company": "Wildberries, команда Trust & Safety",
        "company_details": "контент-модерация, GPU Kubernetes кластер, Triton, ClearML, команда 20+ DS",
        "student_profile": (
            "Опытный Python/ML/Fullstack разработчик (5+ лет), "
            "но никогда не работал с Kubernetes, Triton и ML-инфраструктурой."
        ),
        "learn_examples_hint": "Давай конкретные примеры: YAML-конфиги, команды kubectl, код Python",
        "mock_identity": "Senior MLOps Engineer из команды инфраструктуры Wildberries",
        "mock_target": (
            "Senior MLOps Engineer в команду Trust & Safety "
            "(контент-модерация, GPU Kubernetes кластер, Triton Inference Server, ClearML, команда 20+ DS)"
        ),
    },
    "ml": {
        "mentor_role": "ML наставник",
        "target_position": "ML Engineer",
        "company": None,
        "company_details": None,
        "student_profile": (
            "Опытный Python-разработчик (5+ лет), на практике касался ML, "
            "готовится к собеседованию на ML Engineer."
        ),
        "learn_examples_hint": (
            "Давай конкретные примеры: код Python (sklearn/pandas), "
            "числовые иллюстрации, аналогии из реальных задач"
        ),
        "mock_identity": "Senior ML Engineer",
        "mock_target": "ML Engineer",
    },
}

LEARN_PROMPT_TEMPLATE = """\
Ты — {mentor_role}. Твой ученик — {student_profile} \
Готовится к собеседованию на {target_position}{company_block}.

ТЕКУЩАЯ ТЕМА: {title}
Что изучаем: {what}
Почему это важно для вакансии: {why}
Что точно спросят на интервью: {interview_focus}

КАК ТЫ РАБОТАЕШЬ:
- Объясняй как умному коллеге, который просто не касался этой области
- Используй аналогии из Python и веб-разработки — он это хорошо знает
- {learn_examples_hint}
- Один концепт за раз, не перегружай
- Объясняй зачем нужна каждая вещь, а не только что это такое
- Если ученик спрашивает про смежную тему — объясни кратко в контексте текущей
- После объяснения ключевой части — проверяй понимание простым вопросом

Пиши ТОЛЬКО на русском и английском языках. Никогда не используй китайские, японские или корейские символы — ни одного.
Технические термины оставляй как есть (Pod, Deployment, etc.).
Держи ответы компактными: до 300 слов на одно сообщение. Лучше короткий чёткий ответ, чем длинная лекция."""

QUIZ_PROMPT_TEMPLATE = """\
Ты — технический интервьюер, проверяешь кандидата на позицию {target_position}{company_block}. \
Тема проверки: {title}.

Что кандидат должен знать: {what}
Ключевые вещи для проверки: {interview_focus}

КАК ТЫ ВЕДЁШЬ КВИЗ:
- Задавай вопросы один за другим, как на реальном собеседовании
- Начинай с базовых, постепенно усложняй
- После каждого ответа давай чёткий фидбек: что верно, что неточно, что пропустил
- Если ответ неполный — не давай сразу правильный ответ, задай наводящий вопрос
- Если кандидат просит подсказку — давай минимальную, пусть додумает сам
- Если застрял совсем — объясни концепт и иди дальше
- После 5–6 вопросов дай итоговый фидбек

Пиши ТОЛЬКО на русском и английском языках. Никогда не используй китайские, японские или корейские символы.
Начни с первого вопроса сразу. Один вопрос — одно сообщение, не пиши много вопросов сразу."""

MOCK_PROMPT_TEMPLATE = """\
Ты — {mock_identity}. \
Проводишь техническое собеседование на позицию {mock_target}.

Фокус этой сессии: {interview_focus}

КАК ТЫ ВЕДЁШЬ ИНТЕРВЬЮ:
- Профессионально, как реальный интервьюер — не наставник
- Сначала пару вопросов про опыт и бэкграунд кандидата
- Потом технические вопросы по стеку
- Если ответ поверхностный — копай глубже
- Иногда меняй тему неожиданно, как на реальном интервью
- В конце — задай system design вопрос
- После каждого ответа кратко реагируй и задавай следующий вопрос

Пиши ТОЛЬКО на русском и английском языках. Никогда не используй китайские, японские или корейские символы.
Начни с приветствия и первого вопроса."""


TOPICS = {
    "containers": {
        "title": "Контейнеры и Docker",
        "emoji": "🐳",
        "track": "mlops",
        "what": "контейнер, образ, Dockerfile, docker-compose, реестры образов",
        "why": "Каждый ML-сервис, каждый training job, каждый компонент инфраструктуры упакован в Docker. Это фундамент всего MLOps",
        "interview_focus": "Dockerfile best practices, multi-stage builds, базовые образы NVIDIA, .dockerignore, слои кеша",
    },
    "k8s_basics": {
        "title": "Kubernetes: Pod, Deployment, Service",
        "emoji": "☸️",
        "track": "mlops",
        "what": "Pod, Deployment, Service, Namespace, kubectl, ReplicaSet, rolling update",
        "why": "GPU-кластер Wildberries работает на Kubernetes. Всё — деплои моделей, обучение, Triton — крутится в K8s",
        "interview_focus": "Разница Pod vs Deployment, как Service находит поды через labels, rolling updates, readiness/liveness probes",
    },
    "k8s_storage": {
        "title": "Хранилище в K8s: PV и PVC",
        "emoji": "💾",
        "track": "mlops",
        "what": "PersistentVolume, PersistentVolumeClaim, StorageClass, accessModes, NFS, жизненный цикл",
        "why": "Датасеты по 500GB нужно хранить и давать доступ training-подам. Это и есть PVC",
        "interview_focus": "accessModes (ReadWriteOnce vs ReadWriteMany), StorageClass, когда NFS, когда S3",
    },
    "k8s_gpu": {
        "title": "GPU в Kubernetes",
        "emoji": "🖥️",
        "track": "mlops",
        "what": "NVIDIA Device Plugin, GPU scheduling, tolerations, MIG, node labels, GPU utilization",
        "why": "Главная задача вакансии — управлять GPU Kubernetes кластером. Самый важный топик",
        "interview_focus": "nvidia.com/gpu resource, Device Plugin DaemonSet, MIG на A100, taint/toleration, affinity",
    },
    "model_formats": {
        "title": "Форматы ML-моделей",
        "emoji": "🧠",
        "track": "mlops",
        "what": "ONNX, TorchScript, TensorRT, конвертация PyTorch → ONNX → TRT, dynamic_axes",
        "why": "Прежде чем задеплоить модель в Triton, нужно выбрать правильный формат. От этого зависит latency",
        "interview_focus": "Разница ONNX vs TRT, torch.onnx.export, dynamic_axes для батчинга, opset_version",
    },
    "triton_basics": {
        "title": "Triton: основы и config.pbtxt",
        "emoji": "🚀",
        "track": "mlops",
        "what": "Model repository, config.pbtxt, backends, версионирование, instance_group, запуск сервера",
        "why": "Triton — главный инструмент вакансии. Вся инференс-инфраструктура строится на нём",
        "interview_focus": "Структура репозитория, все поля config.pbtxt, instance_group, version_policy",
    },
    "triton_advanced": {
        "title": "Triton: батчинг и производительность",
        "emoji": "⚡",
        "track": "mlops",
        "what": "Dynamic batching, sequence batching, perf_analyzer, метрики Prometheus, ensemble pipeline",
        "why": "Требование вакансии — 5k RPS с latency < 100ms. Нужно уметь тюнить throughput",
        "interview_focus": "max_queue_delay_microseconds, preferred_batch_size, perf_analyzer, ensemble config",
    },
    "clearml": {
        "title": "ClearML: эксперименты и пайплайны",
        "emoji": "📊",
        "track": "mlops",
        "what": "Task, Dataset, Pipeline, Agent, очереди, трекинг гиперпараметров и метрик",
        "why": "Прямо в требованиях вакансии: ClearML или Kubeflow. Команда из 20 DS нуждается в трекинге",
        "interview_focus": "Task.init(), Dataset.create(), ClearML Agent на GPU-нодах, очереди задач",
    },
    "cicd": {
        "title": "CI/CD и GitOps для ML",
        "emoji": "🔄",
        "track": "mlops",
        "what": "GitOps, Helm charts, ArgoCD, деплой моделей, canary rollout, rollback",
        "why": "Senior MLOps автоматизирует весь путь от коммита до прода без ручного вмешательства",
        "interview_focus": "Helm chart структура, values.yaml, GitOps флоу, canary через Argo Rollouts",
    },
    "monitoring": {
        "title": "Мониторинг ML-систем",
        "emoji": "📈",
        "track": "mlops",
        "what": "Prometheus, Grafana, dcgm-exporter, data drift, Evidently, GPU метрики",
        "why": "Нужно знать что происходит с моделями в проде: деградация, GPU загрузка, очереди",
        "interview_focus": "DCGM метрики, Triton /metrics endpoint, data drift PSI/KS-тест, алерты",
    },
    "system_design": {
        "title": "System Design для MLOps",
        "emoji": "🏗️",
        "track": "mlops",
        "what": "Проектирование ML платформ, inference систем, multi-model serving, autoscaling",
        "why": "Финальный раунд на Senior — системное мышление. Без этого не пройти",
        "interview_focus": "Latency budget, KEDA autoscaling, HA, model registry, пайплайн от данных до прода",
    },
    "mock_interview": {
        "title": "Mock Interview",
        "emoji": "🎯",
        "track": "mlops",
        "what": "Полная симуляция технического интервью Wildberries",
        "why": "Закрепить всё и привыкнуть к ритму и давлению реального собеседования",
        "interview_focus": "Весь стек + system design + live coding вопросы",
    },
}

CURRICULUM = [
    {
        "id": "week1",
        "title": "Неделя 1: Основы",
        "topics": ["containers", "k8s_basics", "k8s_storage", "k8s_gpu"],
    },
    {
        "id": "week2",
        "title": "Неделя 2: Инференс",
        "topics": ["model_formats", "triton_basics", "triton_advanced"],
    },
    {
        "id": "week3",
        "title": "Неделя 3: Пайплайны",
        "topics": ["clearml", "cicd", "monitoring"],
    },
    {
        "id": "week4",
        "title": "Неделя 4: Интервью",
        "topics": ["system_design", "mock_interview"],
    },
]


def build_system_prompt(topic_id: str, mode: str) -> str:
    topic = TOPICS.get(topic_id, {})
    track_id = topic.get("track", "mlops")
    track = TRACKS.get(track_id, TRACKS["mlops"])

    company_block = ""
    if track["company"]:
        company_block = f" в {track['company']} ({track['company_details']})"

    fields = {
        "mentor_role": track["mentor_role"],
        "target_position": track["target_position"],
        "student_profile": track["student_profile"],
        "learn_examples_hint": track["learn_examples_hint"],
        "company_block": company_block,
        "mock_identity": track["mock_identity"],
        "mock_target": track["mock_target"],
        "title": topic.get("title", topic_id),
        "what": topic.get("what", ""),
        "why": topic.get("why", ""),
        "interview_focus": topic.get("interview_focus", ""),
    }

    if mode == "learn":
        return LEARN_PROMPT_TEMPLATE.format(**fields)
    if mode == "quiz":
        return QUIZ_PROMPT_TEMPLATE.format(**fields)
    if mode == "mock":
        return MOCK_PROMPT_TEMPLATE.format(**fields)

    return f"Ты ML/MLOps наставник. Тема: {fields['title']}. Помогай готовиться к интервью. Пиши по-русски."
