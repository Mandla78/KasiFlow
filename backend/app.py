"""
Entry point: `python app.py` for local development, `app:app` for a
WSGI server (gunicorn) in production. .env is loaded before the app is
built so config sees it.
"""
from dotenv import load_dotenv

load_dotenv()

from src import create_app  # noqa: E402

app = create_app()

if __name__ == "__main__":
    # 0.0.0.0 so a phone on the same network (or via adb reverse) can
    # reach it.
    app.run(host="0.0.0.0", port=5000)
