import argparse
import json
import shutil
import sqlite3
from base64 import urlsafe_b64encode
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from urllib.parse import unquote, urlparse
from zipfile import ZIP_DEFLATED, ZipFile

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


ENCRYPTED_BACKUP_MAGIC = b"IMMO3D-BACKUP-ENC\n"


def resolve_sqlite_db_path() -> Path:
    database_url = settings.database_url.strip()
    if not database_url.startswith("sqlite:///"):
        raise RuntimeError("La commande de backup automatique supporte uniquement SQLite.")

    sqlite_path = database_url.removeprefix("sqlite:///")
    if sqlite_path.startswith("./"):
        return (Path(__file__).resolve().parents[1] / sqlite_path[2:]).resolve()

    parsed = urlparse(database_url)
    candidate = unquote(parsed.path or sqlite_path)
    if candidate.startswith("/"):
        return Path(candidate).resolve()

    return Path(candidate).resolve()


def backup_output_dir() -> Path:
    return (Path(__file__).resolve().parents[1] / settings.backup_dir).resolve()


def temp_workspace_dir() -> Path:
    path = (Path(__file__).resolve().parents[1] / ".backup_tmp").resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def cleanup_stale_temp_files(output_dir: Path) -> None:
    for temp_file in output_dir.glob("immo3d-backup-*.tmp"):
        temp_file.unlink(missing_ok=True)


def should_encrypt_backups() -> bool:
    if settings.backup_encryption_configured:
        return True

    if settings.app_env.lower() == "production":
        raise RuntimeError(
            "BACKUP_ENCRYPTION_KEY est obligatoire pour creer une sauvegarde en production."
        )

    return False


def build_backup_fernet() -> Fernet:
    if not settings.backup_encryption_key:
        raise RuntimeError(
            "BACKUP_ENCRYPTION_KEY est obligatoire pour lire ou creer une sauvegarde chiffree."
        )

    key_material = sha256(settings.backup_encryption_key.encode("utf-8")).digest()
    return Fernet(urlsafe_b64encode(key_material))


def is_encrypted_backup_archive(archive_path: Path) -> bool:
    with archive_path.open("rb") as handle:
        return handle.read(len(ENCRYPTED_BACKUP_MAGIC)) == ENCRYPTED_BACKUP_MAGIC


def encrypt_backup_archive(source_archive_path: Path, target_archive_path: Path) -> None:
    encrypted_payload = build_backup_fernet().encrypt(source_archive_path.read_bytes())
    target_archive_path.write_bytes(ENCRYPTED_BACKUP_MAGIC + encrypted_payload)


def decrypt_backup_archive(source_archive_path: Path, target_archive_path: Path) -> None:
    payload = source_archive_path.read_bytes()
    if not payload.startswith(ENCRYPTED_BACKUP_MAGIC):
        raise RuntimeError("Archive de backup non chiffree ou format de backup inconnu.")

    encrypted_payload = payload[len(ENCRYPTED_BACKUP_MAGIC) :]

    try:
        decrypted_payload = build_backup_fernet().decrypt(encrypted_payload)
    except InvalidToken as exc:
        raise RuntimeError(
            "Impossible de dechiffrer l'archive de backup. "
            "Verifie BACKUP_ENCRYPTION_KEY."
        ) from exc

    target_archive_path.write_bytes(decrypted_payload)


def resolve_archive_for_extraction(archive_path: Path, temp_dir_path: Path) -> Path:
    if is_encrypted_backup_archive(archive_path):
        decrypted_archive_path = temp_dir_path / "backup.zip"
        decrypt_backup_archive(archive_path, decrypted_archive_path)
        return decrypted_archive_path

    return archive_path


def create_backup_archive() -> Path:
    source_db = resolve_sqlite_db_path()
    if not source_db.exists():
        raise RuntimeError(f"Base SQLite introuvable: {source_db}")

    output_dir = backup_output_dir()
    output_dir.mkdir(parents=True, exist_ok=True)
    cleanup_stale_temp_files(output_dir)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
    backup_name = f"immo3d-backup-{timestamp}"
    encrypt_backup = should_encrypt_backups()

    db_copy_path = output_dir / f"{backup_name}.sqlite3.tmp"
    manifest_path = output_dir / f"{backup_name}.manifest.tmp"
    plain_archive_path = output_dir / f"{backup_name}.zip.tmp"
    archive_path = output_dir / f"{backup_name}.zip.enc" if encrypt_backup else output_dir / f"{backup_name}.zip"

    try:
        source_connection = sqlite3.connect(str(source_db))
        destination_connection = sqlite3.connect(str(db_copy_path))
        try:
            source_connection.backup(destination_connection)
        finally:
            destination_connection.close()
            source_connection.close()

        manifest = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "database_path": str(source_db),
            "database_size_bytes": db_copy_path.stat().st_size,
            "app_env": settings.app_env,
            "archive_encrypted": encrypt_backup,
            "format_version": 2 if encrypt_backup else 1,
        }
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        with ZipFile(plain_archive_path, "w", compression=ZIP_DEFLATED) as archive:
            archive.write(db_copy_path, arcname="immo3d.db")
            archive.write(manifest_path, arcname="manifest.json")

        if encrypt_backup:
            encrypt_backup_archive(plain_archive_path, archive_path)
        else:
            shutil.move(str(plain_archive_path), str(archive_path))
    finally:
        db_copy_path.unlink(missing_ok=True)
        manifest_path.unlink(missing_ok=True)
        plain_archive_path.unlink(missing_ok=True)

    prune_old_backups(output_dir)
    return archive_path


def prune_old_backups(output_dir: Path) -> None:
    archives = sorted(
        archive
        for archive in output_dir.glob("immo3d-backup-*")
        if archive.is_file() and archive.name.endswith((".zip", ".zip.enc"))
    )
    overflow = len(archives) - settings.backup_retention_count
    if overflow <= 0:
        return

    for archive in archives[:overflow]:
        archive.unlink(missing_ok=True)


def verify_backup_archive(archive_path: Path) -> None:
    if not archive_path.exists():
        raise RuntimeError(f"Archive de backup introuvable: {archive_path}")

    temp_dir_path = temp_workspace_dir() / f"verify-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    temp_dir_path.mkdir(parents=True, exist_ok=True)

    try:
        archive_to_read = resolve_archive_for_extraction(archive_path, temp_dir_path)

        with ZipFile(archive_to_read, "r") as archive:
            archive.extractall(temp_dir_path)

        db_path = temp_dir_path / "immo3d.db"
        if not db_path.exists():
            raise RuntimeError("Archive invalide: fichier immo3d.db manquant.")

        connection = sqlite3.connect(str(db_path))
        try:
            result = connection.execute("PRAGMA integrity_check;").fetchone()
        finally:
            connection.close()

        if not result or result[0] != "ok":
            raise RuntimeError("Verification SQLite invalide: integrity_check a echoue.")
    finally:
        shutil.rmtree(temp_dir_path, ignore_errors=True)


def restore_backup_archive(archive_path: Path) -> Path:
    if not archive_path.exists():
        raise RuntimeError(f"Archive de backup introuvable: {archive_path}")

    target_db = resolve_sqlite_db_path()
    target_db.parent.mkdir(parents=True, exist_ok=True)

    temp_dir_path = temp_workspace_dir() / f"restore-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    temp_dir_path.mkdir(parents=True, exist_ok=True)

    try:
        archive_to_read = resolve_archive_for_extraction(archive_path, temp_dir_path)

        with ZipFile(archive_to_read, "r") as archive:
            archive.extractall(temp_dir_path)

        extracted_db = temp_dir_path / "immo3d.db"
        if not extracted_db.exists():
            raise RuntimeError("Archive invalide: fichier immo3d.db manquant.")

        shutil.copy2(extracted_db, target_db)
    finally:
        shutil.rmtree(temp_dir_path, ignore_errors=True)

    return target_db


def main():
    parser = argparse.ArgumentParser(description="Sauvegarde et verification de la base Immo 3D.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser(
        "create",
        help="Cree une archive de sauvegarde de la base SQLite, chiffree si BACKUP_ENCRYPTION_KEY est configuree.",
    )

    verify_parser = subparsers.add_parser(
        "verify",
        help="Verifie une archive de sauvegarde ZIP ou ZIP chiffree.",
    )
    verify_parser.add_argument("archive", help="Chemin absolu ou relatif vers l'archive.")

    restore_parser = subparsers.add_parser(
        "restore",
        help="Restaure une archive ZIP ou ZIP chiffree dans la base SQLite active.",
    )
    restore_parser.add_argument("archive", help="Chemin absolu ou relatif vers l'archive.")

    args = parser.parse_args()

    if args.command == "create":
        archive_path = create_backup_archive()
        print(archive_path)
        return

    archive_path = Path(args.archive).resolve()
    if args.command == "verify":
        verify_backup_archive(archive_path)
        print(f"Backup verifie: {archive_path}")
        return

    restored_path = restore_backup_archive(archive_path)
    print(restored_path)


if __name__ == "__main__":
    main()
