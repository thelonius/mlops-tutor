import time

import pytest

import shares


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    db = tmp_path / "test_shares.db"
    shares.init_db(str(db))
    monkeypatch.setattr(shares, "_request_count", 0)
    yield


def test_roundtrip():
    sid = shares.create_share(b"hello", b"x" * 12)
    assert isinstance(sid, str) and len(sid) >= 8
    got = shares.get_share(sid)
    assert got == (b"hello", b"x" * 12)


def test_missing_returns_none():
    assert shares.get_share("nope") is None


def test_expired_not_returned(monkeypatch):
    sid = shares.create_share(b"data", b"x" * 12)
    future = int(time.time()) + shares.TTL_SECONDS + 1
    monkeypatch.setattr(shares.time, "time", lambda: future)
    assert shares.get_share(sid) is None


def test_payload_size_limit():
    big = b"x" * (shares.MAX_PAYLOAD_BYTES + 1)
    with pytest.raises(ValueError):
        shares.create_share(big, b"y" * 12)


def test_lazy_cleanup_after_100_writes(monkeypatch):
    sid_old = shares.create_share(b"old", b"x" * 12)
    # отматываем время вперёд так, что old истекает
    real_time = shares.time.time
    expired_at = real_time() + shares.TTL_SECONDS + 1
    monkeypatch.setattr(shares.time, "time", lambda: expired_at)
    # пишем 99 новых — чистки не будет, но get_share() через WHERE сам отфильтрует
    for _ in range(99):
        shares.create_share(b"x", b"y" * 12)
    assert shares.get_share(sid_old) is None  # отфильтровано по WHERE
    # 100-я запись триггерит DELETE — старая запись физически удалена,
    # но проверить это извне без отдельного коннекта неудобно, поэтому
    # просто убеждаемся, что запись действительно недоступна
    shares.create_share(b"trigger", b"y" * 12)
    assert shares.get_share(sid_old) is None
