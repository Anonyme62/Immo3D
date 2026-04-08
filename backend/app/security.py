from base64 import urlsafe_b64encode
from collections import defaultdict, deque
from hashlib import sha256
from threading import Lock
from time import time

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status
from itsdangerous import BadSignature, URLSafeSerializer
from passlib.context import CryptContext

from app.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
serializer = URLSafeSerializer(settings.app_secret_key, salt="immo3d-session")
fernet = Fernet(
    urlsafe_b64encode(sha256(settings.app_secret_key.encode("utf-8")).digest())
)

MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 10 * 60
LOGIN_LOCKOUT_SECONDS = 15 * 60

_login_failures: dict[str, deque[float]] = defaultdict(deque)
_login_lockouts: dict[str, float] = {}
_login_lock = Lock()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_session_value(session_id: str) -> str:
    return serializer.dumps({"session_id": session_id})


def read_session_value(value: str) -> str | None:
    try:
        data = serializer.loads(value)
        return data.get("session_id")
    except BadSignature:
        return None


def encrypt_sensitive_value(value: str) -> str:
    return fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_sensitive_value(value: str) -> str:
    try:
        return fernet.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # Compatibilite avec les anciennes donnees stockees en clair.
        return value


def build_login_attempt_identifier(username: str, client_host: str | None) -> str:
    normalized_username = username.strip().lower()
    normalized_host = (client_host or "unknown").strip().lower()
    return f"{normalized_host}:{normalized_username}"


def _cleanup_failures(identifier: str, now_ts: float) -> deque[float]:
    attempts = _login_failures[identifier]
    while attempts and now_ts - attempts[0] > LOGIN_WINDOW_SECONDS:
        attempts.popleft()
    return attempts


def ensure_login_allowed(identifier: str) -> None:
    now_ts = time()

    with _login_lock:
        locked_until = _login_lockouts.get(identifier)
        if locked_until:
            if locked_until > now_ts:
                remaining_seconds = max(1, int(locked_until - now_ts))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        "Trop de tentatives de connexion. "
                        f"Reessaie dans {remaining_seconds} secondes."
                    ),
                )
            _login_lockouts.pop(identifier, None)

        _cleanup_failures(identifier, now_ts)


def register_login_failure(identifier: str) -> None:
    now_ts = time()

    with _login_lock:
        attempts = _cleanup_failures(identifier, now_ts)
        attempts.append(now_ts)

        if len(attempts) >= MAX_LOGIN_ATTEMPTS:
            _login_lockouts[identifier] = now_ts + LOGIN_LOCKOUT_SECONDS
            attempts.clear()


def clear_login_failures(identifier: str) -> None:
    with _login_lock:
        _login_failures.pop(identifier, None)
        _login_lockouts.pop(identifier, None)
