import pytest
from curriculum import TOPICS, CURRICULUM, TRACKS, build_system_prompt

REQUIRED_TOPIC_FIELDS = ["title", "emoji", "what", "why", "interview_focus", "track", "cheatsheet"]
REQUIRED_TRACK_FIELDS = [
    "mentor_role", "target_position", "student_profile",
    "learn_examples_hint", "mock_identity", "mock_target",
    "company", "company_details",
]


def test_tracks_have_required_fields():
    for track_name, track in TRACKS.items():
        for field in REQUIRED_TRACK_FIELDS:
            assert field in track, f"TRACKS['{track_name}'] missing field '{field}'"


def test_all_topics_have_required_fields():
    for tid, topic in TOPICS.items():
        for field in REQUIRED_TOPIC_FIELDS:
            assert field in topic, f"Topic '{tid}' missing field '{field}'"


def test_all_topics_have_valid_track():
    valid_tracks = set(TRACKS.keys())
    for tid, topic in TOPICS.items():
        assert topic["track"] in valid_tracks, (
            f"Topic '{tid}' has invalid track '{topic['track']}'"
        )


def test_curriculum_references_valid_topics():
    all_ids = set(TOPICS.keys())
    for group in CURRICULUM:
        for tid in group["topics"]:
            assert tid in all_ids, (
                f"CURRICULUM group '{group['id']}' references unknown topic '{tid}'"
            )


def test_all_topics_are_in_curriculum():
    curriculum_ids = set()
    for group in CURRICULUM:
        curriculum_ids.update(group["topics"])
    for tid in TOPICS:
        assert tid in curriculum_ids, f"Topic '{tid}' not found in any CURRICULUM group"


def test_no_duplicate_topics_in_curriculum():
    seen = []
    for group in CURRICULUM:
        for tid in group["topics"]:
            assert tid not in seen, f"Topic '{tid}' appears more than once in CURRICULUM"
            seen.append(tid)


def test_build_system_prompt_returns_string_for_all_modes():
    for tid in TOPICS:
        for mode in ["learn", "quiz", "mock"]:
            result = build_system_prompt(tid, mode)
            assert isinstance(result, str), (
                f"build_system_prompt('{tid}', '{mode}') returned non-string"
            )
            assert len(result) > 100, (
                f"build_system_prompt('{tid}', '{mode}') returned suspiciously short string"
            )


def test_build_system_prompt_depth_basic_is_default():
    # depth по умолчанию == 'basic'; глубина не должна менять базовое поведение.
    for tid in ["containers"]:
        assert build_system_prompt(tid, "learn") == build_system_prompt(tid, "learn", depth="basic")


def test_build_system_prompt_senior_deepens_learn():
    # senior добавляет аддендум глубины и поднимает лимит слов только в learn.
    basic = build_system_prompt("containers", "learn", depth="basic")
    senior = build_system_prompt("containers", "learn", depth="senior")
    assert len(senior) > len(basic)
    assert "SENIOR" in senior and "SENIOR" not in basic
    assert "500" in senior


def test_build_system_prompt_senior_noop_outside_learn():
    # В quiz/mock тумблер глубины не влияет — интервью должно остаться реалистичным.
    for mode in ["quiz", "mock"]:
        assert build_system_prompt("containers", mode, depth="senior") == build_system_prompt(
            "containers", mode, depth="basic"
        )


def test_build_system_prompt_socratic_for_all_topics():
    # Сократический разбор ошибок доступен для любой темы и топик-осведомлён.
    for tid in TOPICS:
        result = build_system_prompt(tid, "socratic")
        assert isinstance(result, str) and len(result) > 100, (
            f"socratic prompt for '{tid}' too short or non-string"
        )
        assert "сократ" in result.lower(), (
            f"socratic prompt for '{tid}' missing method reference"
        )


def test_build_system_prompt_raises_for_unknown_topic():
    with pytest.raises(KeyError):
        build_system_prompt("nonexistent_topic_xyz", "learn")


def test_mlops_prompts_mention_company():
    for mode in ["learn", "quiz", "mock"]:
        result = build_system_prompt("containers", mode)
        assert "Wildberries" in result, (
            f"MLOps prompt for mode '{mode}' missing company mention"
        )


def test_ml_prompts_omit_company():
    ml_topics = [tid for tid, t in TOPICS.items() if t["track"] == "ml"]
    assert ml_topics, "No ML topics found — add ml topics first"
    for tid in ml_topics:
        for mode in ["learn", "quiz", "mock"]:
            result = build_system_prompt(tid, mode)
            assert "Wildberries" not in result, (
                f"ML prompt for '{tid}' mode '{mode}' mentions company"
            )


def test_ml_classic_group_exists():
    group_ids = [g["id"] for g in CURRICULUM]
    assert "ml_classic" in group_ids


def test_ml_sysdesign_group_exists():
    group_ids = [g["id"] for g in CURRICULUM]
    assert "ml_sysdesign" in group_ids


def test_ml_classic_has_ten_topics():
    groups = {g["id"]: g for g in CURRICULUM}
    assert "ml_classic" in groups
    assert len(groups["ml_classic"]["topics"]) == 10


def test_ml_sysdesign_has_five_topics():
    groups = {g["id"]: g for g in CURRICULUM}
    assert "ml_sysdesign" in groups
    assert len(groups["ml_sysdesign"]["topics"]) == 5


def test_all_topic_emojis_are_unique():
    seen = set()
    duplicates = []
    for tid, topic in TOPICS.items():
        emoji = topic["emoji"]
        if emoji in seen:
            duplicates.append(f"'{emoji}' in topic '{tid}'")
        seen.add(emoji)
    assert not duplicates, f"Duplicate emojis found: {duplicates}"


def test_all_topics_have_cheatsheet():
    for tid, topic in TOPICS.items():
        cs = topic.get("cheatsheet", [])
        assert isinstance(cs, list), f"Topic '{tid}' cheatsheet is not a list"
        assert 8 <= len(cs) <= 10, (
            f"Topic '{tid}' cheatsheet has {len(cs)} items, expected 8–10"
        )


def test_cheatsheet_pairs_have_q_and_a():
    for tid, topic in TOPICS.items():
        for i, pair in enumerate(topic.get("cheatsheet", [])):
            assert "q" in pair, f"Topic '{tid}' cheatsheet[{i}] missing 'q'"
            assert "a" in pair, f"Topic '{tid}' cheatsheet[{i}] missing 'a'"
            assert pair["q"], f"Topic '{tid}' cheatsheet[{i}]['q'] is empty"
            assert pair["a"], f"Topic '{tid}' cheatsheet[{i}]['a'] is empty"


def test_mock_interview_topic_removed():
    assert "mock_interview" not in TOPICS, (
        "Topic 'mock_interview' should be removed (redundant with Mock Interview mode)"
    )


def test_math_track_exists():
    assert "math" in TRACKS, "math track missing from TRACKS"


def test_math_precalc_group_exists():
    groups = {g["id"]: g for g in CURRICULUM}
    assert "math_precalc" in groups
    assert groups["math_precalc"]["section"] == "Математика"
    assert len(groups["math_precalc"]["topics"]) == 6


def test_math_calculus_group_exists():
    groups = {g["id"]: g for g in CURRICULUM}
    assert "math_calculus" in groups
    assert groups["math_calculus"]["section"] == "Математика"
    assert len(groups["math_calculus"]["topics"]) == 6


def test_math_category_group_exists():
    groups = {g["id"]: g for g in CURRICULUM}
    assert "math_category" in groups
    assert groups["math_category"]["section"] == "Теория категорий"
    assert len(groups["math_category"]["topics"]) == 6


def test_category_topics_use_programming_context():
    # Теория категорий переопределяет контекст ученика на инженера-программиста.
    cat_topics = [g for g in CURRICULUM if g["id"] == "math_category"][0]["topics"]
    for tid in cat_topics:
        assert TOPICS[tid].get("colloquium_context"), (
            f"Category topic '{tid}' must set colloquium_context"
        )
        for mode in ["learn", "quiz", "mock"]:
            p = build_system_prompt(tid, mode)
            assert "программист" in p, (
                f"Category prompt '{tid}'/{mode} should carry the programming-audience context"
            )


def test_math_topics_use_math_subject():
    math_topics = [tid for tid, t in TOPICS.items() if t["track"] == "math"]
    assert math_topics, "No math topics found"
    for tid in math_topics:
        assert TOPICS[tid].get("subject") == "math", (
            f"Math topic '{tid}' must have subject='math' to route to the colloquium builder"
        )


def test_math_quiz_is_colloquium():
    # Квиз для math-темы должен быть устным коллоквиумом, а не job-интервью.
    math_topics = [tid for tid, t in TOPICS.items() if t["track"] == "math"]
    for tid in math_topics:
        quiz = build_system_prompt(tid, "quiz")
        assert "КОЛЛОКВИУМ" in quiz, f"Math quiz for '{tid}' is not framed as a colloquium"
        # Математический трек не должен тащить job-контекст из общих шаблонов.
        assert "Wildberries" not in quiz
        assert "вакансию" not in quiz.lower()


def test_math_prompts_forbid_latex_and_cjk():
    for tid in [t for t, tt in TOPICS.items() if tt["track"] == "math"]:
        for mode in ["learn", "quiz", "mock"]:
            p = build_system_prompt(tid, mode)
            assert "LaTeX" in p, f"Math prompt '{tid}'/{mode} should instruct plain notation"
