import time
from datetime import datetime, timezone
from pathlib import Path

from app.backup import create_backup_archive, verify_backup_archive
from app.config import settings


def backup_scheduler_enabled() -> bool:
    return settings.backup_interval_minutes > 0


def backup_scheduler_interval_seconds() -> int:
    return settings.backup_interval_minutes * 60


def create_scheduled_backup() -> Path:
    archive_path = create_backup_archive()
    if settings.backup_verify_after_create:
        verify_backup_archive(archive_path)
    return archive_path


def run_backup_scheduler_forever() -> None:
    interval_seconds = backup_scheduler_interval_seconds()
    print(
        f"[backup-scheduler] Active. Prochaine sauvegarde dans "
        f"{settings.backup_interval_minutes} minute(s)."
    )

    while True:
        time.sleep(interval_seconds)
        started_at = datetime.now(timezone.utc).isoformat()
        print(f"[backup-scheduler] Demarrage sauvegarde auto a {started_at}")
        try:
            archive_path = create_scheduled_backup()
        except Exception as exc:
            print(f"[backup-scheduler] Echec sauvegarde auto: {exc}")
            continue

        print(f"[backup-scheduler] Sauvegarde creee: {archive_path}")


def main() -> None:
    if not backup_scheduler_enabled():
        print("[backup-scheduler] Desactive (BACKUP_INTERVAL_MINUTES=0).")
        return

    run_backup_scheduler_forever()


if __name__ == "__main__":
    main()
