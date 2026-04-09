import shutil
import sqlite3
import uuid
from pathlib import Path
from unittest import TestCase

from app import backup
from app.config import settings


BACKEND_ROOT = Path(__file__).resolve().parents[1]


class BackupEncryptionTests(TestCase):
    def setUp(self):
        super().setUp()
        self._original_database_url = settings.database_url
        self._original_backup_dir = settings.backup_dir
        self._original_backup_encryption_key = settings.backup_encryption_key
        self._original_app_env = settings.app_env

        suffix = uuid.uuid4().hex
        self._db_name = f"test-backup-{suffix}.db"
        self._backup_dir_name = f".test-backups-{suffix}"
        self.db_path = BACKEND_ROOT / self._db_name
        self.backup_dir_path = BACKEND_ROOT / self._backup_dir_name
        self.db_path.unlink(missing_ok=True)
        shutil.rmtree(self.backup_dir_path, ignore_errors=True)

        settings.database_url = f"sqlite:///./{self._db_name}"
        settings.backup_dir = self._backup_dir_name
        settings.app_env = "development"
        settings.backup_encryption_key = "backup-test-key-material-32-chars!!"

        self._initialize_db("before")

    def tearDown(self):
        settings.database_url = self._original_database_url
        settings.backup_dir = self._original_backup_dir
        settings.backup_encryption_key = self._original_backup_encryption_key
        settings.app_env = self._original_app_env

        self.db_path.unlink(missing_ok=True)
        shutil.rmtree(self.backup_dir_path, ignore_errors=True)
        super().tearDown()

    def _initialize_db(self, value: str):
        connection = sqlite3.connect(self.db_path)
        try:
            connection.execute("CREATE TABLE IF NOT EXISTS sample (value TEXT NOT NULL)")
            connection.execute("DELETE FROM sample")
            connection.execute("INSERT INTO sample(value) VALUES (?)", (value,))
            connection.commit()
        finally:
            connection.close()

    def _read_db_value(self) -> str:
        connection = sqlite3.connect(self.db_path)
        try:
            row = connection.execute("SELECT value FROM sample LIMIT 1").fetchone()
        finally:
            connection.close()
        return row[0]

    def test_create_verify_and_restore_encrypted_backup(self):
        archive_path = backup.create_backup_archive()

        self.assertTrue(archive_path.exists())
        self.assertTrue(archive_path.name.endswith(".zip.enc"))
        self.assertTrue(backup.is_encrypted_backup_archive(archive_path))

        backup.verify_backup_archive(archive_path)

        self._initialize_db("after")
        restored_path = backup.restore_backup_archive(archive_path)

        self.assertEqual(restored_path, self.db_path.resolve())
        self.assertEqual(self._read_db_value(), "before")

    def test_verify_encrypted_backup_requires_matching_key(self):
        archive_path = backup.create_backup_archive()
        settings.backup_encryption_key = "different-backup-key-material-32chars"

        with self.assertRaisesRegex(RuntimeError, "Impossible de dechiffrer"):
            backup.verify_backup_archive(archive_path)

    def test_create_plain_backup_in_development_without_backup_key(self):
        settings.backup_encryption_key = None

        archive_path = backup.create_backup_archive()

        self.assertTrue(archive_path.exists())
        self.assertTrue(archive_path.name.endswith(".zip"))
        self.assertFalse(backup.is_encrypted_backup_archive(archive_path))

        backup.verify_backup_archive(archive_path)

    def test_create_backup_requires_encryption_key_in_production(self):
        settings.app_env = "production"
        settings.backup_encryption_key = None

        with self.assertRaisesRegex(RuntimeError, "BACKUP_ENCRYPTION_KEY"):
            backup.create_backup_archive()
