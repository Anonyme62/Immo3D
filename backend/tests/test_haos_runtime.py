from unittest import TestCase

from app.haos_runtime import build_haos_env


class HaosRuntimeTests(TestCase):
    def test_build_env_keeps_defaults_for_backup_and_billing(self):
        env = build_haos_env(
            {
                "public_hostname": "app.pigepro.fr",
                "allowed_hosts": "app.pigepro.fr,localhost,127.0.0.1",
                "app_secret_key": "a" * 32,
                "data_encryption_key": "b" * 32,
                "backup_encryption_key": "c" * 32,
                "session_max_age_seconds": 3600,
            }
        )

        self.assertEqual(env["FRONTEND_ORIGIN"], "https://app.pigepro.fr")
        self.assertEqual(env["BILLING_REQUIRED"], "false")
        self.assertEqual(env["BACKUP_RETENTION_COUNT"], "14")
        self.assertEqual(env["BACKUP_INTERVAL_MINUTES"], "0")
        self.assertEqual(env["BACKUP_VERIFY_AFTER_CREATE"], "true")
        self.assertNotIn("STRIPE_SECRET_KEY", env)

    def test_build_env_includes_stripe_when_configured(self):
        env = build_haos_env(
            {
                "public_hostname": "app.pigepro.fr",
                "allowed_hosts": "app.pigepro.fr,localhost,127.0.0.1",
                "app_secret_key": "a" * 32,
                "data_encryption_key": "b" * 32,
                "backup_encryption_key": "c" * 32,
                "session_max_age_seconds": 3600,
                "backup_retention_count": 21,
                "backup_interval_minutes": 120,
                "backup_verify_after_create": False,
                "billing_required": True,
                "stripe_secret_key": "sk_test_123",
                "stripe_price_id": "price_123",
                "stripe_webhook_secret": "whsec_123",
                "stripe_api_version": "2026-03-25.dahlia",
            }
        )

        self.assertEqual(env["BILLING_REQUIRED"], "true")
        self.assertEqual(env["STRIPE_SECRET_KEY"], "sk_test_123")
        self.assertEqual(env["STRIPE_PRICE_ID"], "price_123")
        self.assertEqual(env["STRIPE_WEBHOOK_SECRET"], "whsec_123")
        self.assertEqual(env["STRIPE_API_VERSION"], "2026-03-25.dahlia")
        self.assertEqual(env["BACKUP_RETENTION_COUNT"], "21")
        self.assertEqual(env["BACKUP_INTERVAL_MINUTES"], "120")
        self.assertEqual(env["BACKUP_VERIFY_AFTER_CREATE"], "false")
