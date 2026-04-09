from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_valid_csrf
from app.models import User
from app.schemas import AuthStatusResponse, BillingSessionResponse, CheckoutSessionSyncRequest
from app.services.stripe_billing import (
    create_billing_portal_session,
    create_checkout_session,
    sync_checkout_session_for_user,
    sync_subscription_from_checkout_session,
    sync_subscription_from_invoice_event,
    sync_subscription_from_subscription_event,
    verify_webhook_signature,
)


router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/status", response_model=AuthStatusResponse)
def billing_status(
    user: User = Depends(get_current_user),
):
    return {
        "authenticated": True,
        "user": user,
        "csrf_token": None,
    }


@router.post("/checkout-session", response_model=BillingSessionResponse)
def create_checkout(
    _: object = Depends(require_valid_csrf),
    user: User = Depends(get_current_user),
):
    return {"url": create_checkout_session(user)}


@router.post("/checkout-session/sync", response_model=AuthStatusResponse)
def sync_checkout_session(
    payload: CheckoutSessionSyncRequest,
    _: object = Depends(require_valid_csrf),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    synced_user = sync_checkout_session_for_user(db, user, payload.session_id)
    return {
        "authenticated": True,
        "user": synced_user,
        "csrf_token": None,
    }


@router.post("/portal-session", response_model=BillingSessionResponse)
def create_portal(
    _: object = Depends(require_valid_csrf),
    user: User = Depends(get_current_user),
):
    return {"url": create_billing_portal_session(user)}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
):
    payload = await request.body()
    event = verify_webhook_signature(payload, stripe_signature)
    event_type = event.get("type")
    data_object = ((event.get("data") or {}).get("object")) or {}

    if event_type == "checkout.session.completed":
        sync_subscription_from_checkout_session(db, data_object)
    elif event_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        sync_subscription_from_subscription_event(db, data_object)
    elif event_type in {
        "invoice.paid",
        "invoice.payment_failed",
    }:
        sync_subscription_from_invoice_event(db, data_object)

    return {"received": True}
