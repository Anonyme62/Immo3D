import hmac
import secrets
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
    urlsafe_b64encode(sha256(settings.effective_data_encryption_key.encode("utf-8")).digest())
)

MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 10 * 60
LOGIN_LOCKOUT_SECONDS = 15 * 60

_login_failures: dict[str, deque[float]] = defaultdict(deque)
_login_lockouts: dict[str, float] = {}
_login_lock = Lock()
_request_buckets: dict[str, deque[float]] = defaultdict(deque)
_request_bucket_lock = Lock()


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


def build_lookup_hash(value: str) -> str:
    normalized_value = value.strip().lower().encode("utf-8")
    secret = settings.effective_data_encryption_key.encode("utf-8")
    return hmac.new(secret, normalized_value, sha256).hexdigest()


def create_csrf_token() -> str:
    return secrets.token_urlsafe(32)


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


def normalize_client_ip(headers, fallback_host: str | None = None) -> str:
    forwarded_for = headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip().lower()

    for header_name in ("cf-connecting-ip", "x-real-ip"):
        header_value = headers.get(header_name, "").strip().lower()
        if header_value:
            return header_value

    return (fallback_host or "unknown").strip().lower()


def ensure_rate_limit(bucket: str, identifier: str, limit: int, window_seconds: int) -> None:
    now_ts = time()
    storage_key = f"{bucket}:{identifier}"

    with _request_bucket_lock:
        attempts = _request_buckets[storage_key]
        while attempts and now_ts - attempts[0] > window_seconds:
            attempts.popleft()

        if len(attempts) >= limit:
            retry_after = max(1, int(window_seconds - (now_ts - attempts[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Trop de requetes envoyees. "
                    f"Reessaie dans {retry_after} secondes."
                ),
            )

        attempts.append(now_ts)


def constant_time_equals(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))
