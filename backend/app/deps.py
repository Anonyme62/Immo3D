from datetime import datetime, timezone

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import AppSession, User
from app.security import constant_time_equals, read_session_value


def get_current_session(
    db: Session = Depends(get_db),
    session_cookie: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> AppSession:
    if not session_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Non authentifie")

    session_id = read_session_value(session_cookie)
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalide")

    app_session = db.query(AppSession).filter(AppSession.id == session_id).first()
    if not app_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session inconnue")

    now = datetime.now(timezone.utc)
    expires_at = app_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now:
        db.delete(app_session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expiree")

    return app_session


def get_current_user(
    db: Session = Depends(get_db),
    app_session: AppSession = Depends(get_current_session),
) -> User:
    user = db.query(User).filter(User.id == app_session.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")

    return user


def get_current_subscribed_user(
    user: User = Depends(get_current_user),
) -> User:
    if settings.billing_required and not user.has_active_subscription:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Abonnement mensuel requis pour acceder a cette fonctionnalite.",
        )

    return user


def require_valid_csrf(
    app_session: AppSession = Depends(get_current_session),
    csrf_token: str | None = Header(default=None, alias=settings.csrf_header_name),
) -> AppSession:
    if not csrf_token or not app_session.csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Jeton CSRF manquant.",
        )

    if not constant_time_equals(csrf_token, app_session.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Jeton CSRF invalide.",
        )

    return app_session
