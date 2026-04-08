from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_session, get_current_user
from app.models import AppSession, User, YanportSession
from app.schemas import AuthStatusResponse, UserResponse, YanportLoginRequest
from app.security import (
    build_login_attempt_identifier,
    clear_login_failures,
    create_session_value,
    encrypt_sensitive_value,
    ensure_login_allowed,
    register_login_failure,
)
from app.services.yanport import login_to_yanport


router = APIRouter(prefix="/auth", tags=["auth"])


def normalize_identity(value: str | None) -> str | None:
    if value is None:
        return None

    normalized_value = value.strip().lower()
    return normalized_value or None


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=create_session_value(session_id),
        max_age=settings.session_max_age_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=UserResponse)
def login(
    request: Request,
    response: Response,
    payload: YanportLoginRequest = Body(...),
    db: Session = Depends(get_db),
):
    attempt_identifier = build_login_attempt_identifier(
        payload.username,
        request.client.host if request.client else None,
    )
    ensure_login_allowed(attempt_identifier)

    try:
        yanport_data = login_to_yanport(payload.username, payload.password)
    except HTTPException as exc:
        if exc.status_code == 401:
            register_login_failure(attempt_identifier)
        raise

    clear_login_failures(attempt_identifier)

    normalized_username = normalize_identity(yanport_data["username"])
    yanport_email = normalize_identity(yanport_data.get("email"))
    access_token = yanport_data["token"]

    user_filters = [User.yanport_username == normalized_username]
    if yanport_email:
        user_filters.append(User.yanport_email == yanport_email)

    user = db.query(User).filter(or_(*user_filters)).first()

    if not user:
        user = User(
            yanport_username=normalized_username,
            yanport_email=yanport_email,
        )
        db.add(user)
        db.flush()
    else:
        username_conflict = (
            normalized_username != user.yanport_username
            and db.query(User)
            .filter(
                User.yanport_username == normalized_username,
                User.id != user.id,
            )
            .first()
            is not None
        )

        if yanport_email and user.yanport_email != yanport_email:
            user.yanport_email = yanport_email

        if not username_conflict and user.yanport_username != normalized_username:
            user.yanport_username = normalized_username

    yanport_session = db.query(YanportSession).filter(YanportSession.user_id == user.id).first()
    if not yanport_session:
        yanport_session = YanportSession(
            user_id=user.id,
            access_token=encrypt_sensitive_value(access_token),
        )
        db.add(yanport_session)
    else:
        yanport_session.access_token = encrypt_sensitive_value(access_token)

    app_session = AppSession(
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=settings.session_max_age_seconds),
    )
    db.add(app_session)
    db.commit()
    db.refresh(user)
    db.refresh(app_session)

    set_session_cookie(response, app_session.id)
    return user


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    app_session: AppSession = Depends(get_current_session),
):
    db.delete(app_session)

    remaining_session = (
        db.query(AppSession)
        .filter(
            AppSession.user_id == app_session.user_id,
            AppSession.id != app_session.id,
        )
        .first()
    )

    if not remaining_session:
        yanport_session = db.query(YanportSession).filter(YanportSession.user_id == app_session.user_id).first()
        if yanport_session:
            db.delete(yanport_session)

    db.commit()

    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    return {"success": True}


@router.get("/me", response_model=AuthStatusResponse)
def me(user: User = Depends(get_current_user)):
    return {
        "authenticated": True,
        "user": user,
    }
