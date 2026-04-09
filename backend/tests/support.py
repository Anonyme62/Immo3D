import gc
import os
import tempfile
from typing import Callable
from unittest import TestCase

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import close_all_sessions, sessionmaker

from app.config import settings
from app import security
from app.db import get_db
from app.main import app
from app.models import Base
from app.routers import auth as auth_router
from app.routers import biens as biens_router


class BackendApiTestCase(TestCase):
    def setUp(self):
        super().setUp()
        temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        temp_db.close()
        self._temp_db_path = temp_db.name.replace("\\", "/")
        self.engine = create_engine(
            f"sqlite:///{self._temp_db_path}",
            connect_args={"check_same_thread": False},
        )
        self.TestSessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )
        Base.metadata.create_all(bind=self.engine)

        def override_get_db():
            db = self.TestSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.csrf_token = ""
        self._original_billing_required = settings.billing_required
        settings.billing_required = False
        self._original_login_to_yanport = auth_router.login_to_yanport
        self._original_fetch_properties = biens_router.fetch_properties
        security._login_failures.clear()
        security._login_lockouts.clear()
        security._request_buckets.clear()

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        settings.billing_required = self._original_billing_required
        auth_router.login_to_yanport = self._original_login_to_yanport
        biens_router.fetch_properties = self._original_fetch_properties
        close_all_sessions()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()
        if getattr(self, "_temp_db_path", None):
            try:
                os.remove(self._temp_db_path)
            except FileNotFoundError:
                pass
        self.engine = None
        self.TestSessionLocal = None
        gc.collect()
        security._login_failures.clear()
        security._login_lockouts.clear()
        security._request_buckets.clear()
        super().tearDown()

    def set_fake_yanport_login(self, login_handler: Callable[[str, str], dict]):
        auth_router.login_to_yanport = login_handler

    def set_fake_fetch_properties(self, fetch_handler: Callable[..., list[dict]]):
        biens_router.fetch_properties = fetch_handler

    def login(self, username: str, password: str = "password"):
        response = self.client.post(
            "/auth/login",
            json={
                "username": username,
                "password": password,
            },
        )
        if response.status_code == 200:
            self.csrf_token = response.json().get("csrf_token", "")
        return response

    def auth_headers(self):
        return {"X-CSRF-Token": self.csrf_token} if self.csrf_token else {}

    def logout(self):
        response = self.client.post("/auth/logout", headers=self.auth_headers())
        if response.status_code == 200:
            self.csrf_token = ""
        return response
