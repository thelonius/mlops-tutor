import os

os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("ZHIPU_API_KEY", "test")
os.environ.setdefault("GEMINI_API_KEY", "test")
os.environ.setdefault("GROQ_API_KEY", "test")

import pytest

from app import app


@pytest.fixture
def client():
    return app.test_client()


def _post(client, payload):
    return client.post("/api/chat", json=payload)


def test_chat_rejects_missing_topic_id(client):
    r = _post(client, {"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 400
    assert "Unknown topic_id" in r.get_json()["error"]


def test_chat_rejects_empty_topic_id(client):
    r = _post(client, {"messages": [{"role": "user", "content": "hi"}], "topic_id": ""})
    assert r.status_code == 400


def test_chat_rejects_null_topic_id(client):
    r = _post(client, {"messages": [{"role": "user", "content": "hi"}], "topic_id": None})
    assert r.status_code == 400


def test_chat_rejects_unknown_topic_id(client):
    r = _post(client, {"messages": [{"role": "user", "content": "hi"}], "topic_id": "proj_proptech_retrieval"})
    assert r.status_code == 400
    assert "proj_proptech_retrieval" in r.get_json()["error"]


def test_chat_rejects_empty_messages(client):
    r = _post(client, {"topic_id": "containers"})
    assert r.status_code == 400
    assert r.get_json()["error"] == "No messages"


# ── __vacancy__ topic ──────────────────────────────────────────────────────────

def test_vacancy_topic_requires_vacancy_id(client):
    """__vacancy__ without vacancy_id → 400."""
    r = _post(client, {
        "messages": [{"role": "user", "content": "Готов"}],
        "topic_id": "__vacancy__",
    })
    assert r.status_code == 400
    assert "vacancy_id" in r.get_json()["error"]


def test_vacancy_topic_with_unknown_vacancy_id(client):
    """__vacancy__ with non-existent vacancy_id → 400 (vacancy not found)."""
    r = _post(client, {
        "messages": [{"role": "user", "content": "Готов"}],
        "topic_id": "__vacancy__",
        "vacancy_id": "does_not_exist_000",
    })
    assert r.status_code == 400
    assert "vacancy_id" in r.get_json()["error"]


def test_vacancy_topic_accepted_with_valid_id(client, monkeypatch):
    """__vacancy__ with a valid vacancy streams correctly."""
    from vacancy_provider import Vacancy, VacancyProvider

    fake = Vacancy(
        short_id="test01",
        title="ML Engineer",
        company="Acme",
        stack="Python, PyTorch",
        requirements="Docker, k8s",
        vibes="Remote",
    )

    monkeypatch.setattr(
        "vacancy_provider.provider.get_vacancy",
        lambda sid: fake if sid == "test01" else None,
    )
    monkeypatch.setattr(
        "vacancy_provider.provider.get_vacancy_vector",
        lambda sid: None,
    )

    # Patch LLM to avoid real API call
    import app as app_module
    def fake_generate():
        yield 'data: {"text": "Привет!"}\n\n'
        yield "data: [DONE]\n\n"

    monkeypatch.setattr(
        app_module.client.chat.completions, "create",
        lambda **kw: _FakeStream(["Привет!"]),
    )

    r = _post(client, {
        "messages": [{"role": "user", "content": "Готов"}],
        "topic_id": "__vacancy__",
        "vacancy_id": "test01",
        "mode": "mock",
    })
    # Should not be 400 — either 200 (streaming started) or some LLM error
    assert r.status_code != 400, r.get_json()


class _FakeChunk:
    def __init__(self, text):
        self.choices = [type("C", (), {"delta": type("D", (), {"content": text})()})]


class _FakeStream:
    def __init__(self, texts):
        self._texts = texts

    def __iter__(self):
        for t in self._texts:
            yield _FakeChunk(t)
