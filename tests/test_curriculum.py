import pytest
from curriculum import TOPICS, CURRICULUM, TRACKS, build_system_prompt

REQUIRED_TOPIC_FIELDS = ["title", "emoji", "what", "why", "interview_focus", "track"]
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


def test_mlops_prompts_mention_company():
    for mode in ["learn", "quiz", "mock"]:
        result = build_system_prompt("containers", mode)
        assert "Wildberries" in result, (
            f"MLOps prompt for mode '{mode}' missing company mention"
        )


def test_ml_prompts_omit_company():
    ml_topics = [tid for tid, t in TOPICS.items() if t["track"] == "ml"]
    assert ml_topics, "No ML topics found — add ml topics first"
    for tid in ml_topics:  # check ALL ml topics, not just first 3
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
