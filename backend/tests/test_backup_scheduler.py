from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from app.config import settings
from app import backup_scheduler


class BackupSchedulerTests(TestCase):
    def setUp(self):
        super().setUp()
        self._original_interval = settings.backup_interval_minutes
        self._original_verify = settings.backup_verify_after_create

    def tearDown(self):
        settings.backup_interval_minutes = self._original_interval
        settings.backup_verify_after_create = self._original_verify
        super().tearDown()

    def test_scheduler_is_disabled_when_interval_is_zero(self):
        settings.backup_interval_minutes = 0

        self.assertFalse(backup_scheduler.backup_scheduler_enabled())
        self.assertEqual(backup_scheduler.backup_scheduler_interval_seconds(), 0)

    def test_scheduler_interval_seconds_matches_minutes(self):
        settings.backup_interval_minutes = 90

        self.assertTrue(backup_scheduler.backup_scheduler_enabled())
        self.assertEqual(backup_scheduler.backup_scheduler_interval_seconds(), 5400)

    def test_create_scheduled_backup_can_skip_verification(self):
        settings.backup_verify_after_create = False
        fake_archive = Path("/tmp/immo3d-backup-test.zip")

        with patch("app.backup_scheduler.create_backup_archive", return_value=fake_archive) as create_mock:
            with patch("app.backup_scheduler.verify_backup_archive") as verify_mock:
                archive_path = backup_scheduler.create_scheduled_backup()

        self.assertEqual(archive_path, fake_archive)
        create_mock.assert_called_once_with()
        verify_mock.assert_not_called()

    def test_create_scheduled_backup_verifies_when_enabled(self):
        settings.backup_verify_after_create = True
        fake_archive = Path("/tmp/immo3d-backup-test.zip")

        with patch("app.backup_scheduler.create_backup_archive", return_value=fake_archive) as create_mock:
            with patch("app.backup_scheduler.verify_backup_archive") as verify_mock:
                archive_path = backup_scheduler.create_scheduled_backup()

        self.assertEqual(archive_path, fake_archive)
        create_mock.assert_called_once_with()
        verify_mock.assert_called_once_with(fake_archive)
