import os

os.environ.setdefault("GROQ_API_KEY", "test")
os.environ.setdefault("GEMINI_API_KEY", "test")

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
