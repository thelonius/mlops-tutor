"""Зашифрованные снапшоты сессии для шеринга по ссылке.

Сервер хранит только base64 шифротекст и IV. Ключ AES-GCM генерится
на клиенте и кладётся во фрагмент URL (#k=...), на сервер не уходит.

TTL — 48 часов, ленивая чистка раз в 100 запросов.
"""

import os
import secrets
import sqlite3
import threading
import time

DB_PATH = os.environ.get("SHARES_DB_PATH", "data/shares.db")
TTL_SECONDS = 48 * 60 * 60
MAX_PAYLOAD_BYTES = 256 * 1024
ID_BYTES = 8  # token_urlsafe(8) → 11-символьная строка

_lock = threading.Lock()
_request_count = 0


def _connect():
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_db(path: str | None = None):
    global DB_PATH
    if path:
        DB_PATH = path
    parent = os.path.dirname(DB_PATH)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS shares (
                id TEXT PRIMARY KEY,
                ciphertext BLOB NOT NULL,
                iv BLOB NOT NULL,
                expires_at INTEGER NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_expires ON shares(expires_at)")


def _maybe_cleanup(conn):
    global _request_count
    _request_count += 1
    if _request_count % 100 == 0:
        conn.execute("DELETE FROM shares WHERE expires_at < ?", (int(time.time()),))


def create_share(ciphertext: bytes, iv: bytes) -> str:
    if len(ciphertext) + len(iv) > MAX_PAYLOAD_BYTES:
        raise ValueError("payload too large")
    sid = secrets.token_urlsafe(ID_BYTES)
    expires_at = int(time.time()) + TTL_SECONDS
    with _lock:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO shares (id, ciphertext, iv, expires_at) VALUES (?, ?, ?, ?)",
                (sid, ciphertext, iv, expires_at),
            )
            _maybe_cleanup(conn)
    return sid


def get_share(sid: str):
    with _connect() as conn:
        row = conn.execute(
            "SELECT ciphertext, iv FROM shares WHERE id = ? AND expires_at > ?",
            (sid, int(time.time())),
        ).fetchone()
    return (bytes(row[0]), bytes(row[1])) if row else None
