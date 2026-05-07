import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from curriculum import TOPICS, CURRICULUM, build_system_prompt

REQUIRED_TOPIC_FIELDS = ["title", "emoji", "what", "why", "interview_focus", "cheatsheet"]
VALID_SUBJECTS = {"system_design", "python", "algorithms"}
VALID_TRACKS = {"ml"}


# ── Topic field checks ────────────────────────────────────────────────────────

def test_all_topics_have_required_fields():
    for tid, topic in TOPICS.items():
        for field in REQUIRED_TOPIC_FIELDS:
            assert field in topic, f"Topic '{tid}' missing field '{field}'"


def test_topic_track_values_are_valid():
    for tid, topic in TOPICS.items():
        if "track" in topic:
            assert topic["track"] in VALID_TRACKS, (
                f"Topic '{tid}' has unknown track '{topic['track']}'"
            )


def test_topic_subject_values_are_valid():
    for tid, topic in TOPICS.items():
        if "subject" in topic:
            assert topic["subject"] in VALID_SUBJECTS, (
                f"Topic '{tid}' has unknown subject '{topic['subject']}'"
            )


def test_all_topic_emojis_are_unique():
    seen = {}
    for tid, topic in TOPICS.items():
        emoji = topic.get("emoji", "")
        assert emoji, f"Topic '{tid}' has empty emoji"
        assert emoji not in seen, (
            f"Emoji '{emoji}' used by both '{seen[emoji]}' and '{tid}'"
        )
        seen[emoji] = tid


# ── CURRICULUM integrity ──────────────────────────────────────────────────────

def test_curriculum_topics_exist_in_topics():
    for group in CURRICULUM:
        for tid in group["topics"]:
            assert tid in TOPICS, (
                f"CURRICULUM group '{group['id']}' references unknown topic '{tid}'"
            )


def test_all_topics_are_in_curriculum():
    all_curriculum_topics = {tid for g in CURRICULUM for tid in g["topics"]}
    for tid in TOPICS:
        assert tid in all_curriculum_topics, (
            f"Topic '{tid}' exists in TOPICS but is not in any CURRICULUM group"
        )


def test_no_duplicate_topics_in_curriculum():
    all_tids = [tid for g in CURRICULUM for tid in g["topics"]]
    seen = set()
    for tid in all_tids:
        assert tid not in seen, f"Topic '{tid}' appears more than once in CURRICULUM"
        seen.add(tid)


def test_curriculum_groups_have_required_fields():
    for group in CURRICULUM:
        assert "id" in group, f"CURRICULUM group missing 'id': {group}"
        assert "title" in group, f"CURRICULUM group '{group.get('id')}' missing 'title'"
        assert "topics" in group, f"CURRICULUM group '{group.get('id')}' missing 'topics'"
        assert len(group["topics"]) > 0, f"CURRICULUM group '{group['id']}' has no topics"


# ── build_system_prompt ───────────────────────────────────────────────────────

def test_build_system_prompt_returns_strings():
    for tid in list(TOPICS.keys())[:5]:
        for mode in ("learn", "quiz", "mock"):
            result = build_system_prompt(tid, mode)
            assert isinstance(result, str), f"build_system_prompt({tid!r}, {mode!r}) returned {type(result)}"
            assert len(result) > 50, f"build_system_prompt({tid!r}, {mode!r}) returned too short string"


def test_ml_topics_omit_wildberries():
    for tid, topic in TOPICS.items():
        if topic.get("track") == "ml":
            for mode in ("learn", "quiz", "mock"):
                prompt = build_system_prompt(tid, mode)
                assert "Wildberries" not in prompt, (
                    f"ML topic '{tid}' mode '{mode}' should not mention Wildberries"
                )


# ── Cheatsheet ────────────────────────────────────────────────────────────────

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
