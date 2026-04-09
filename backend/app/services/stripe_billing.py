import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from urllib.parse import urlencode, urljoin

import requests
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User


STRIPE_API_BASE_URL = "https://api.stripe.com/v1"


def ensure_billing_is_configured() -> None:
    if not settings.stripe_configured:
        raise HTTPException(
            status_code=503,
            detail="La facturation Stripe n'est pas encore configuree.",
        )


def build_frontend_url(path: str, **query_params) -> str:
    normalized_path = path if path.startswith("/") else f"/{path}"
    base_url = settings.frontend_origin.rstrip("/") + "/"
    url = urljoin(base_url, normalized_path.lstrip("/"))

    if query_params:
        return f"{url}?{urlencode(query_params)}"

    return url


def append_query_parameter(url: str, name: str, value: str) -> str:
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}{name}={value}"


def stripe_request(method: str, path: str, data: dict | None = None) -> dict:
    ensure_billing_is_configured()

    headers = {}
    if settings.stripe_api_version:
        headers["Stripe-Version"] = settings.stripe_api_version

    try:
        response = requests.request(
            method=method,
            url=f"{STRIPE_API_BASE_URL}{path}",
            auth=(settings.stripe_secret_key, ""),
            data=data or {},
            headers=headers,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Impossible de joindre Stripe: {exc}")

    try:
        payload = response.json()
    except ValueError:
        payload = None

    if not response.ok:
        detail = payload.get("error", {}).get("message") if isinstance(payload, dict) else None
        raise HTTPException(
            status_code=502,
            detail=detail or "Erreur lors de la communication avec Stripe.",
        )

    return payload or {}


def create_checkout_session(user: User) -> str:
    success_url = append_query_parameter(
        build_frontend_url("/", billing="success"),
        "session_id",
        "{CHECKOUT_SESSION_ID}",
    )
    data = {
        "mode": "subscription",
        "success_url": success_url,
        "cancel_url": build_frontend_url("/", billing="cancel"),
        "client_reference_id": user.id,
        "metadata[user_id]": user.id,
        "metadata[yanport_username]": user.yanport_username,
        "line_items[0][price]": settings.stripe_price_id,
        "line_items[0][quantity]": "1",
    }

    if user.stripe_customer_id:
        data["customer"] = user.stripe_customer_id
    elif user.yanport_email:
        data["customer_email"] = user.yanport_email

    session = stripe_request("POST", "/checkout/sessions", data=data)
    checkout_url = session.get("url")
    if not checkout_url:
        raise HTTPException(status_code=502, detail="Stripe n'a pas renvoye d'URL de paiement.")

    return checkout_url


def create_billing_portal_session(user: User) -> str:
    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="Aucun client Stripe rattache a ce compte pour le moment.",
        )

    session = stripe_request(
        "POST",
        "/billing_portal/sessions",
        data={
            "customer": user.stripe_customer_id,
            "return_url": build_frontend_url("/", billing="portal"),
        },
    )
    portal_url = session.get("url")
    if not portal_url:
        raise HTTPException(status_code=502, detail="Stripe n'a pas renvoye d'URL de portail.")
    return portal_url


def fetch_subscription(subscription_id: str) -> dict:
    return stripe_request("GET", f"/subscriptions/{subscription_id}")


def fetch_checkout_session(session_id: str) -> dict:
    return stripe_request("GET", f"/checkout/sessions/{session_id}")


def parse_stripe_signature(signature_header: str) -> tuple[int, list[str]]:
    timestamp = None
    signatures = []

    for item in signature_header.split(","):
        key, _, value = item.partition("=")
        if key == "t":
            timestamp = int(value)
        elif key == "v1":
            signatures.append(value)

    if timestamp is None or not signatures:
        raise HTTPException(status_code=400, detail="Signature Stripe invalide.")

    return timestamp, signatures


def verify_webhook_signature(payload: bytes, signature_header: str | None) -> dict:
    ensure_billing_is_configured()

    if not signature_header:
        raise HTTPException(status_code=400, detail="Signature Stripe manquante.")

    timestamp, signatures = parse_stripe_signature(signature_header)
    if abs(time.time() - timestamp) > 300:
        raise HTTPException(status_code=400, detail="Signature Stripe expiree.")

    signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode("utf-8")
    expected_signature = hmac.new(
        settings.stripe_webhook_secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    if not any(hmac.compare_digest(expected_signature, signature) for signature in signatures):
        raise HTTPException(status_code=400, detail="Signature Stripe invalide.")

    try:
        return json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Payload Stripe invalide.")


def stripe_timestamp_to_datetime(value: int | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromtimestamp(value, tz=timezone.utc)


def apply_subscription_state(user: User, subscription: dict | None) -> None:
    if not subscription:
        user.stripe_subscription_id = None
        user.subscription_price_id = None
        user.subscription_status = None
        user.subscription_current_period_end = None
        user.subscription_cancel_at_period_end = False
        user.subscription_updated_at = datetime.now(timezone.utc)
        return

    item_data = ((subscription.get("items") or {}).get("data") or [])
    price_id = None
    if item_data:
        price_id = (item_data[0].get("price") or {}).get("id")

    user.stripe_customer_id = subscription.get("customer") or user.stripe_customer_id
    user.stripe_subscription_id = subscription.get("id")
    user.subscription_price_id = price_id
    user.subscription_status = subscription.get("status")
    user.subscription_current_period_end = stripe_timestamp_to_datetime(
        subscription.get("current_period_end")
    )
    user.subscription_cancel_at_period_end = bool(subscription.get("cancel_at_period_end"))
    user.subscription_updated_at = datetime.now(timezone.utc)


def sync_subscription_to_user(db: Session, user: User, subscription: dict | None) -> User:
    apply_subscription_state(user, subscription)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def sync_subscription_from_checkout_session(db: Session, session_object: dict) -> User | None:
    user_id = session_object.get("client_reference_id") or (session_object.get("metadata") or {}).get("user_id")
    if not user_id:
        return None

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None

    if session_object.get("customer"):
        user.stripe_customer_id = session_object.get("customer")

    subscription_id = session_object.get("subscription")
    if subscription_id:
        subscription = fetch_subscription(subscription_id)
        return sync_subscription_to_user(db, user, subscription)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def sync_subscription_from_subscription_event(db: Session, subscription_object: dict) -> User | None:
    customer_id = subscription_object.get("customer")
    subscription_id = subscription_object.get("id")

    user = None
    if customer_id:
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

    if not user and subscription_id:
        user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()

    if not user:
        return None

    return sync_subscription_to_user(db, user, subscription_object)


def sync_subscription_from_invoice_event(db: Session, invoice_object: dict) -> User | None:
    subscription_id = invoice_object.get("subscription")
    customer_id = invoice_object.get("customer")

    user = None
    if customer_id:
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

    if not user and subscription_id:
        user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()

    if not user or not subscription_id:
        return user

    subscription = fetch_subscription(subscription_id)
    return sync_subscription_to_user(db, user, subscription)


def sync_checkout_session_for_user(db: Session, user: User, session_id: str) -> User:
    session_object = fetch_checkout_session(session_id)
    session_user_id = session_object.get("client_reference_id") or (
        (session_object.get("metadata") or {}).get("user_id")
    )

    if session_user_id and session_user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Cette session Stripe ne correspond pas a l'utilisateur connecte.",
        )

    synced_user = sync_subscription_from_checkout_session(db, session_object)
    if not synced_user:
        raise HTTPException(
            status_code=404,
            detail="Impossible de rattacher cette session Stripe a un abonnement local.",
        )

    return synced_user
