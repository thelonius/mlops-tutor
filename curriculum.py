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
    "ml_linear": {
        "title": "Линейные модели и регуляризация",
        "emoji": "📐",
        "track": "ml",
        "what": "линейная регрессия, коэффициенты, градиентный спуск, L1 (Lasso), L2 (Ridge), ElasticNet, стандартизация фич",
        "why": "Линейные модели — первый baseline и лакмусовая бумажка. Если не можешь объяснить Ridge vs Lasso, не пройдёшь начало собеседования",
        "interview_focus": "геометрическая интерпретация L1/L2, почему L1 даёт разреженность, когда ElasticNet, мультиколлинеарность, почему нужна стандартизация перед регуляризацией",
    },
    "ml_logreg": {
        "title": "Логистическая регрессия и калибровка",
        "emoji": "🎲",
        "track": "ml",
        "what": "sigmoid, log loss, порог классификации, Platt scaling, isotonic regression, calibration curve",
        "why": "Логрег — стандартный baseline на любой задаче классификации. Про калибровку спрашивают когда нужны вероятности (реклама, медицина, кредит)",
        "interview_focus": "вывод log loss из MLE, почему sigmoid, как двигать порог при дисбалансе, Platt vs isotonic, reliability diagram",
    },
    "ml_trees": {
        "title": "Деревья и Random Forest",
        "emoji": "🌲",
        "track": "ml",
        "what": "критерии разбиения (Gini, entropy, MSE), глубина дерева, pruning, bagging, bootstrap, OOB-ошибка, feature importance",
        "why": "RF — рабочая лошадка для табличных данных, особенно когда нужна интерпретируемость или быстрый старт без тюнинга",
        "interview_focus": "Gini vs entropy, почему деревья переобучаются, как bagging снижает variance, OOB vs CV, MDI feature importance и его ловушки на кардинальных фичах",
    },
    "ml_boosting": {
        "title": "Градиентный бустинг",
        "emoji": "🌳",
        "track": "ml",
        "what": "градиентный бустинг, слабые ученики, learning rate, XGBoost, LightGBM, CatBoost, leaf-wise vs level-wise, обработка категорий",
        "why": "XGBoost/LightGBM выигрывают большинство соревнований на табличных данных. Знание разницы между реализациями — маркер опытного ML-инженера",
        "interview_focus": "разница XGBoost/LightGBM/CatBoost, leaf-wise vs level-wise рост деревьев, почему CatBoost не требует кодирования категорий, n_estimators vs learning_rate trade-off, early stopping",
    },
    "ml_metrics": {
        "title": "Метрики качества",
        "emoji": "📏",
        "track": "ml",
        "what": "accuracy, precision, recall, F1, ROC-AUC, PR-AUC, confusion matrix, MAE, MSE, RMSE, MAPE, R², log loss, Brier score",
        "why": "Выбор метрики — это формулировка задачи. Неверная метрика = решение не той задачи. На собесе всегда спрашивают 'а что у вас метрика и почему'",
        "interview_focus": "когда ROC-AUC врёт (сильный дисбаланс), PR-AUC vs ROC-AUC, почему accuracy бесполезен при дисбалансе, когда RMSE лучше MAE (и наоборот), как связать бизнес-метрику с модельной",
    },
    "ml_bias_variance": {
        "title": "Bias-variance и переобучение",
        "emoji": "⚖️",
        "track": "ml",
        "what": "bias-variance decomposition, underfitting/overfitting, learning curves, диагностика по train/val зазору, регуляризация",
        "why": "Диагностика 'почему модель плохо работает' — ключевой навык. Не понимаешь bias-variance — не сможешь направленно улучшать модель",
        "interview_focus": "математическое разложение ошибки, как диагностировать по learning curves, высокий bias vs высокий variance — разные лечения, почему больше данных помогает только при высоком variance",
    },
    "ml_validation": {
        "title": "Валидация и кросс-валидация",
        "emoji": "✂️",
        "track": "ml",
        "what": "k-fold CV, stratified k-fold, leave-one-out, time series split, group k-fold, nested CV, holdout",
        "why": "Неправильная валидация — главный способ обмануть себя. Особенно на временных рядах и группированных данных",
        "interview_focus": "почему нельзя делать обычный k-fold на временных рядах, group k-fold когда нужен (один пользователь в нескольких фолдах), nested CV для отбора гиперпараметров",
    },
    "ml_leakage": {
        "title": "Утечки данных",
        "emoji": "💧",
        "track": "ml",
        "what": "target leakage, train-test contamination, temporal leakage, data snooping, leakage через preprocessing",
        "why": "Утечка — самая частая причина красивых метрик в оффлайне и провала в продакшне. Умение находить утечки отличает джуна от мидла",
        "interview_focus": "target leakage на примере (фича создана после таргета), как target encoding утекает без правильного fold-encoding, temporal leakage в fit_transform на всём датасете, как проверить подозрение на утечку",
    },
    "ml_imbalance": {
        "title": "Дисбаланс классов",
        "emoji": "🔀",
        "track": "ml",
        "what": "oversampling (SMOTE), undersampling, class_weight, threshold tuning, focal loss, PR-AUC как основная метрика",
        "why": "Антифрод, медицинская диагностика, кредитный скоринг — везде дисбаланс. Не умеешь работать с ним — не работаешь с реальными задачами",
        "interview_focus": "почему accuracy бесполезен при 1:100, class_weight='balanced' vs SMOTE — когда что, focal loss vs class_weight (object detection, multi-label), как выбрать порог под бизнес-задачу, PR-AUC как основная метрика при дисбалансе",
    },
    "ml_features": {
        "title": "Фичеинжиниринг",
        "emoji": "🛠️",
        "track": "ml",
        "what": "one-hot encoding, ordinal encoding, target encoding, mean encoding, scaling (MinMax, Standard, Robust), обработка NaN, взаимодействия фич",
        "why": "На табличных данных 80% результата даёт инженерия фич, а не выбор алгоритма. Знание когда какое кодирование — базовая грамотность ML-инженера",
        "interview_focus": "почему target encoding без fold-encoding — утечка, когда StandardScaler обязателен (линейные модели, SVM, kNN), Robust scaler при выбросах, счётчики и редкие категории",
    },
    "mlsd_framing": {
        "title": "Постановка ML-задачи",
        "emoji": "🗺️",
        "track": "ml",
        "what": "формулировка ML-задачи из бизнес-требований, выбор прокси-метрики, baseline без ML, постановка как задача классификации/регрессии/ранжирования",
        "why": "Senior ML Engineer не получает ТЗ 'обучи модель', а получает 'уменьши чарн'. Умение перевести бизнес в ML — ключевое отличие от джуна",
        "interview_focus": "как от 'увеличить выручку' прийти к конкретной ML-задаче, что такое proxy metric и когда она ломается, как определить baseline без ML, когда ML вообще не нужен",
    },
    "mlsd_skew": {
        "title": "Train-serving skew и фичестор",
        "emoji": "🏪",
        "track": "ml",
        "what": "train-serving skew, feature store, point-in-time correctness, online vs offline фичи, версионирование данных и моделей",
        "why": "Расхождение между обучением и инференсом — одна из самых дорогих ошибок в ML. Фичестор решает эту проблему системно",
        "interview_focus": "почему фичи на обучении не совпадают с prod (temporal leakage, разные пайплайны), point-in-time join, как устроен feature store (Feast концептуально), онлайн vs оффлайн хранилище",
    },
    "mlsd_ab": {
        "title": "A/B-тесты для ML",
        "emoji": "🧪",
        "track": "ml",
        "what": "статистические тесты (t-test, Mann-Whitney), мощность теста, p-value, размер выборки, novelty effect, sample ratio mismatch, AA-тест",
        "why": "ML-модель без A/B — вера. A/B — единственный способ доказать что модель улучшила бизнес-метрику, а не только оффлайн-метрику",
        "interview_focus": "как рассчитать размер выборки, почему p < 0.05 недостаточно, novelty effect и как его учитывать, sample ratio mismatch как красный флаг, зачем нужен AA-тест",
    },
    "mlsd_ranking": {
        "title": "Ranking и рекомендации",
        "emoji": "🥇",
        "track": "ml",
        "what": "candidate generation, ranking, двухэтапная архитектура, pointwise/pairwise/listwise, NDCG, Recall@K, MRR, exploration vs exploitation, cold start",
        "why": "Рекомендательные системы и поиск — самые частые кейсы на ML System Design. Двухэтапная архитектура — стандарт индустрии",
        "interview_focus": "почему два этапа (retrieval + ranking), как мерить качество ранжирования (NDCG vs MAP), cold start проблема и решения, exploration (ε-greedy, UCB, Thompson sampling)",
    },
    "mlsd_mock": {
        "title": "ML System Design Mock",
        "emoji": "🎤",
        "track": "ml",
        "what": "полная симуляция System Design кейса: постановка → данные → фичи → модель → метрики → деплой → мониторинг",
        "why": "System Design раунд на senior — финальный фильтр. Нужно удерживать все слои: бизнес, данные, модель, инфра",
        "interview_focus": "полная симуляция кейса: фид, поиск, антифрод, рекомендации или другой сценарий на выбор интервьюера",
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
    {
        "id": "ml_classic",
        "title": "ML: классика",
        "topics": [
            "ml_linear", "ml_logreg", "ml_trees", "ml_boosting", "ml_metrics",
            "ml_bias_variance", "ml_validation", "ml_leakage", "ml_imbalance", "ml_features",
        ],
    },
    {
        "id": "ml_sysdesign",
        "title": "ML: System Design",
        "topics": ["mlsd_framing", "mlsd_skew", "mlsd_ab", "mlsd_ranking", "mlsd_mock"],
    },
]


def build_system_prompt(topic_id: str, mode: str) -> str:
    topic = TOPICS.get(topic_id)
    if topic is None:
        raise KeyError(f"Unknown topic_id: {topic_id!r}")
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
