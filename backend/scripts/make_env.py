"""
Create backend/.env from .env.example with fresh secrets.

    python scripts/make_env.py

Asks for the database password you used in setup_db.sql, generates
SECRET_KEY and JWT_SECRET_KEY, and writes .env. It never overwrites an
existing .env, so it can't destroy someone's settings.
"""
import getpass
import secrets
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
EXAMPLE = HERE / ".env.example"
TARGET = HERE / ".env"


def main() -> int:
    if TARGET.exists():
        print(f"{TARGET} already exists; leaving it alone. Delete it first if you really want a new one.")
        return 1

    password = getpass.getpass("Database password for the 'akayza' role: ").strip()
    if not password:
        print("No password given; nothing written.")
        return 1

    values = {
        "SECRET_KEY": secrets.token_urlsafe(48),
        "JWT_SECRET_KEY": secrets.token_urlsafe(48),
        "POSTGRES_PASSWORD": password,
    }
    lines = []
    for line in EXAMPLE.read_text(encoding="utf-8").splitlines():
        key = line.split("=", 1)[0].strip()
        lines.append(f"{key}={values[key]}" if key in values and line.strip().endswith("=") else line)
    TARGET.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {TARGET}. It is git-ignored: never commit it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
