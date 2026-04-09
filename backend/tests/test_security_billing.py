from fastapi import HTTPException
from unittest.mock import patch

from app.config import settings
from tests.support import BackendApiTestCase


class SecurityAndBillingTests(BackendApiTestCase):
    def setUp(self):
        super().setUp()

        self.set_fake_yanport_login(
            lambda username, password: {
                "username": username,
                "email": f"{username}@example.com",
                "token": f"token-{username}",
            }
        )

    def test_mutating_route_requires_csrf_token(self):
        self.login("alexis")

        response = self.client.post(
            "/notes",
            json={"bien_id": "bien-1", "note": "Sans CSRF"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("CSRF", response.json()["detail"])

    def test_login_is_temporarily_locked_after_repeated_failures(self):
        def failing_login(username, password):
            raise HTTPException(status_code=401, detail="Identifiants Yanport invalides")

        self.set_fake_yanport_login(failing_login)

        for _ in range(5):
            response = self.login("alexis", "mauvais")
            self.assertEqual(response.status_code, 401)

        locked_response = self.login("alexis", "mauvais")
        self.assertEqual(locked_response.status_code, 429)

    def test_paid_access_is_enforced_server_side(self):
        settings.billing_required = True
        self.set_fake_fetch_properties(lambda access_token, zip_code=None, ville=None: [])

        self.login("alexis")
        response = self.client.get("/biens", params={"zip_code": "62670"})

        self.assertEqual(response.status_code, 402)
        self.assertIn("Abonnement", response.json()["detail"])

    def test_checkout_session_sync_unlocks_access_after_return_from_stripe(self):
        settings.billing_required = True

        login_response = self.login("alexis")
        self.assertEqual(login_response.status_code, 200)
        user_id = login_response.json()["user"]["id"]

        def fake_sync_checkout_session(db, user, session_id):
            self.assertEqual(session_id, "cs_test_local_123")
            self.assertEqual(user.id, user_id)
            user.stripe_customer_id = "cus_test_local_123"
            user.subscription_status = "active"
            return user

        with patch(
            "app.routers.billing.sync_checkout_session_for_user",
            side_effect=fake_sync_checkout_session,
        ):
            response = self.client.post(
                "/billing/checkout-session/sync",
                json={"session_id": "cs_test_local_123"},
                headers=self.auth_headers(),
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["authenticated"])
        self.assertEqual(payload["user"]["subscription_status"], "active")
        self.assertTrue(payload["user"]["has_active_subscription"])
        self.assertTrue(payload["user"]["has_app_access"])
