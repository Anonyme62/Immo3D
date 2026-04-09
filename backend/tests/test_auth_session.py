from app.models import AppSession, User, YanportSession
from app.security import build_lookup_hash, decrypt_sensitive_value

from tests.support import BackendApiTestCase


class AuthSessionTests(BackendApiTestCase):
    def test_login_creates_session_cookie_and_logout_invalidates_it(self):
        self.set_fake_yanport_login(
            lambda username, password: {
                "username": username,
                "email": f"{username}@example.com",
                "token": "token-auth-1",
            }
        )

        login_response = self.login("alexis")

        self.assertEqual(login_response.status_code, 200)
        self.assertIn("immo3d_session", self.client.cookies)
        self.assertTrue(login_response.json()["csrf_token"])

        with self.TestSessionLocal() as db:
            self.assertEqual(db.query(User).count(), 1)
            self.assertEqual(db.query(AppSession).count(), 1)
            self.assertEqual(db.query(YanportSession).count(), 1)
            user = db.query(User).first()
            yanport_session = db.query(YanportSession).first()
            self.assertNotEqual(user._yanport_username_encrypted, "alexis")
            self.assertEqual(user.yanport_username_hash, build_lookup_hash("alexis"))
            self.assertNotEqual(user._yanport_email_encrypted, "alexis@example.com")
            self.assertEqual(user.yanport_email, "alexis@example.com")
            self.assertEqual(decrypt_sensitive_value(yanport_session.access_token), "token-auth-1")

        auth_response = self.client.get("/auth/me")
        self.assertEqual(auth_response.status_code, 200)
        self.assertTrue(auth_response.json()["authenticated"])

        logout_response = self.logout()
        self.assertEqual(logout_response.status_code, 200)

        after_logout = self.client.get("/auth/me")
        self.assertEqual(after_logout.status_code, 401)

        with self.TestSessionLocal() as db:
            self.assertEqual(db.query(AppSession).count(), 0)
            self.assertEqual(db.query(YanportSession).count(), 0)

    def test_login_reuses_existing_user_found_by_email_and_updates_username(self):
        with self.TestSessionLocal() as db:
            existing_user = User(
                yanport_username="ancien-login",
                yanport_email="alexis@example.com",
            )
            db.add(existing_user)
            db.commit()
            existing_user_id = existing_user.id

        self.set_fake_yanport_login(
            lambda username, password: {
                "username": "nouveau-login",
                "email": "alexis@example.com",
                "token": "token-auth-2",
            }
        )

        login_response = self.login("nouveau-login")

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["user"]["id"], existing_user_id)
        self.assertEqual(login_response.json()["user"]["yanport_username"], "nouveau-login")

        with self.TestSessionLocal() as db:
            self.assertEqual(db.query(User).count(), 1)
            user = db.query(User).first()
            self.assertEqual(user.id, existing_user_id)
            self.assertEqual(user.yanport_username, "nouveau-login")
            self.assertEqual(user.yanport_email, "alexis@example.com")

    def test_invalid_login_does_not_create_local_session(self):
        def failing_login(username, password):
            from fastapi import HTTPException

            raise HTTPException(status_code=401, detail="Identifiants Yanport invalides")

        self.set_fake_yanport_login(failing_login)

        login_response = self.login("alexis", "mauvais-mot-de-passe")

        self.assertEqual(login_response.status_code, 401)

        with self.TestSessionLocal() as db:
            self.assertEqual(db.query(User).count(), 0)
            self.assertEqual(db.query(AppSession).count(), 0)
            self.assertEqual(db.query(YanportSession).count(), 0)
