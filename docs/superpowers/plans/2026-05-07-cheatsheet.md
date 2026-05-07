# Plan: Cheatsheet Mode + Sidebar Cleanup

**Spec:** `docs/superpowers/specs/2026-05-07-cheatsheet-design.md`  
**Branch:** `fix/keyboard-viewport`

## Scope

53 topics (all minus deleted `mock_interview`): 11 MLOps + 10 ML classic + 7 SD + 10 Python + 15 Algo.

## Tasks

### Task 1 — curriculum.py: mock_interview removal + cheatsheet content

**Files:** `curriculum.py`

**Steps:**
1. Remove `mock_interview` entry from `TOPICS` (lines 90–97)
2. In `CURRICULUM`, update `week4` group: remove `"mock_interview"` from topics list
3. Add `"cheatsheet": [{"q": ..., "a": ...}, ...]` field (8–10 pairs) to all 53 remaining topics

**Topic groups and counts:**
- MLOps (no track/subject field): containers, k8s_basics, k8s_storage, k8s_gpu, model_formats, triton_basics, triton_advanced, clearml, cicd, monitoring, system_design — 11 topics
- ML classic (`track: "ml"`): ml_linear, ml_logreg, ml_trees, ml_boosting, ml_metrics, ml_bias_variance, ml_validation, ml_leakage, ml_imbalance, ml_features — 10 topics
- System Design (`subject: "system_design"`): sd_fundamentals, sd_data, sd_messaging, sd_reliability, sd_classics, sd_ml_systems, sd_mock — 7 topics
- Python (`subject: "python"`): py_data_types, py_algorithms, py_oop, py_async, py_typing, py_pydantic, py_fastapi, py_db_orm, py_testing, py_mock_interview — 10 topics
- Algorithms (`subject: "algorithms"`): algo_basics, algo_memory, algo_arrays, algo_search, algo_recursion, algo_sorting, algo_linked_lists, algo_stack_queue, algo_hash_tables, algo_trees, algo_graphs, algo_shortest_paths, algo_greedy, algo_combinatorics, algo_mock — 15 topics

**Content rules:**
- Questions from `interview_focus` of each topic
- Answers: 1–3 lines, facts/distinctions, no filler
- Technical terms in English, prose in Russian
- 8–10 pairs per topic

### Task 2 — templates/index.html: UI

**Files:** `templates/index.html`

**Changes:**
1. Add CSS for `.cs-card`, `.cs-q`, `.cs-a`, `.cs-header`, `.week-divider`
2. Remove/replace `.week-label` CSS → `.week-divider` (height:1px line)
3. Add 4th mode button: `<button class="mode-btn" id="mode-cheatsheet" onclick="setMode('cheatsheet')">📋 Чит-шит</button>`
4. Add `.badge-cheatsheet { background: #22c55e20; color: #22c55e; }` CSS
5. Add `<div id="cheatsheet-view" style="display:none; overflow-y:auto; padding:16px; flex:1;"></div>` container
6. Update `setMode(m)`: hide `#chat-messages` and `#input-row` when cheatsheet; show `#cheatsheet-view`; call `renderCheatsheet(topic)` if topic set
7. Add `renderCheatsheet(tid)` function
8. In `selectTopic()`: if mode === 'cheatsheet', call `renderCheatsheet(tid)`
9. In sidebar render: replace `<div class="week-label">` text with `<div class="week-divider">` (only between groups, i > 0)
10. Update mode-badge logic to include `cheatsheet` → `badge-cheatsheet` mapping

### Task 3 — tests/test_curriculum.py: test file

**Files:** `tests/test_curriculum.py` (create), `tests/__init__.py` (create empty)

**Tests to add:**
All 12 original tests (from Phase 1) PLUS 3 new cheatsheet tests:

```python
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
```

Original 12 tests cover: topic required fields, valid track/subject references, CURRICULUM integrity, build_system_prompt return types, emoji uniqueness, etc.

## Execution order

Task 2 (HTML) can run in parallel with Task 1 (curriculum content).
Task 3 (tests) should run after Task 1 is complete (tests validate curriculum data).

After all 3 tasks: run `pytest tests/` to verify, then commit.
