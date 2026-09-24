# Akayza

*Keep it in the kasi.*

An app for informal businesses (builders and trades, spaza shops, other small businesses). Traders sign up, get matched with suppliers who deliver to them, and keep a record of their business. Suppliers connect through our integration API.

Team PR · GKHack26. Plans and submission drafts are in [`docs/`](docs/).

```
backend/          Flask + PostgreSQL API (domains -> features, migrations)
frontend/
  mobile/         Expo / React Native app (development build, not Expo Go)
  (web/ later)
docs/             plan, design, hackathon and submission drafts
```

---

## What you need installed

| Tool | Version | Check with |
|---|---|---|
| Git | any recent | `git --version` |
| Python | **3.12** | `py -3.12 --version` |
| PostgreSQL | **16 or newer** (we use 18) | `psql --version` |
| Node.js | **22** | `node -v` |
| An Android phone | with the **Akayza dev build** installed (link from Mandla) | |

Commands below are for **PowerShell on Windows**, run from the repo root unless it says otherwise.

---

## 1. Database (once per laptop)

Pick a password for the app's database user, then run the setup script as the `postgres` admin:

```powershell
psql -U postgres -h localhost -v app_password="YOUR-DB-PASSWORD" -f backend/scripts/setup_db.sql
```

It creates the role `akayza` and the databases `akayza_dev` and `akayza_test`. It's safe to run twice. It does **not** create tables: the migrations do that in step 2.

> If `psql` isn't found, use the full path, e.g. `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`.

## 2. Backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts/make_env.py     # writes .env: asks for YOUR-DB-PASSWORD, generates the secrets
flask db upgrade               # builds every schema and table from migrations/
python app.py                  # http://localhost:5000/api/v1/health
```

Check it works: open http://localhost:5000/api/v1/health. You should see `"database": "ok"`.

Run the tests: `python -m pytest -q tests`

**Never create tables by hand.** Change a model, then:

```powershell
flask db migrate -m "what changed"   # review the generated file in migrations/versions/
flask db upgrade
```

Commit the migration file with the model change, so everyone else gets it with `flask db upgrade`.

### Auth API (`/api/v1`)

| Route | What it does |
|---|---|
| `POST /auth/register` | business name, email, password, consent versions. Always answers "Check your email." |
| `POST /auth/verify-email` | email + 6-digit code (+ optional phone key) → tokens |
| `POST /auth/resend-code` | always answers "Check your email." |
| `POST /auth/login` | email + password (+ optional phone key) → tokens |
| `POST /auth/refresh` | refresh token → new tokens (the old refresh token stops working) |
| `POST /auth/logout` | ends this phone's session immediately |
| `POST /auth/forgot-password` / `POST /auth/reset-password` | one-use reset link, 30 minutes |
| `GET /me` | the signed-in account (from the token; no ids in URLs) |

**In development the emails aren't really sent** (`MAIL_PROVIDER=fake`). The sign-up code and the reset link are printed in the backend terminal, on a line starting with `[fake email]`.

## 3. Mobile

```powershell
cd frontend/mobile
npm install
copy .env.example .env         # public settings only (Mapbox token, API address)
npm start                      # = npx expo start --dev-client
```

1. Install the **Akayza** development build on your phone from the EAS link Mandla shares (Android: allow "install unknown apps").
2. Open Akayza on the phone and scan the QR code in the terminal.
3. Code changes appear on the phone in seconds. A **new build** is only needed when a package with native code is added (then run `eas build --profile development --platform android`).

**The phone can't connect?** By default the phone must be on the **same Wi-Fi** as the PC. Campus, work and public Wi-Fi often block devices from reaching each other, and so does a phone on mobile data. Then use the tunnel, which works from any network:

```powershell
npm run start:tunnel           # = npx expo start --dev-client --tunnel
```

The tunnel is a little slower to load, but it always connects. If it still fails, allow Node.js through Windows Firewall when Windows asks.

**Preview in the browser** (quick UI check, no phone needed): `npx expo start --web`, then open http://localhost:8081. Refreshing the page resets the session.

**`frontend/mobile/.env`** (git-ignored; `.env.example` lists the keys):
- `EXPO_PUBLIC_MAPBOX_TOKEN`: the public Mapbox token. Without it the map uses OpenStreetMap (dev only).
- `EXPO_PUBLIC_API_URL`: where the phone finds the backend. `localhost` means the phone itself, so use your PC's IP from `ipconfig` (same Wi-Fi) or a tunnel URL. It's unused until the mocks are switched to the real backend.

Restart `npm start` after changing `.env`.

Before you push mobile changes: `npx tsc --noEmit` and `npx expo lint`.

---

## Trying the app (everything is mocked until the backend is wired)

- **Email code:** any 6 digits work. `000000` shows the error.
- **Password rule:** 8–64 characters, with a capital letter, a small letter, a number and a special character. The same rule is enforced in `frontend/mobile/src/shared/lib/validation.ts` and `backend/src/shared/security/security.py`.
- **Address search:** type any address. The first result is what you typed.
- **CIPC numbers:** the check runs in the background, and the result shows on the **More** tab. Enter the name "Nomsa Dlamini" at step 1 so the director match can work.

| Number | Result |
|---|---|
| `2020/123456/07` | Verified (you're a director) |
| `2021/654321/07` | Company found, owner not confirmed |
| `2019/111111/07` | Deregistered |
| `2018/999999/07` | CIPC unreachable, retried later |
| anything else | Not found |

---

## How the code is organised

**Backend** (`backend/src/`): every folder's `__init__.py` explains what it's for.

```
core/          responses, errors, base model
api/           /api/v1 blueprint + /health
domains/       the business: areas -> features, each with api/ schemas/ services/ repositories/ models/
  identity/        accounts, auth, devices
  informal_trader/ business_profile, credit_book, jobs
  supplier/        supplier_profile, catalogue, integration
  commerce/        orders, payments
  proof/           ledger, handshake (+ integrity, reputation, share later)
shared/        tools with no business knowledge (finance, idempotency, audit, email, ...)
master_scheduler/  background jobs
migrations/    Alembic: the only way the database changes
```

**Mobile** (`frontend/mobile/src/`): see [`frontend/mobile/README.md`](frontend/mobile/README.md).

```
app/           routes only (each file re-exports a screen)
features/      auth, onboarding, dashboard/informal-business/<feature>, dashboard/supplier
shared/        components, theme, lib, location-picker
constants/     categories, business types, config
content/       Privacy Policy and Terms of Use (drafts)
```

---

## Rules

- **Secrets live in `.env` files, which are never committed.** `.env.example` lists what's needed. If a secret is ever committed, tell the team: it must be rotated, not just deleted.
- **Money is integer cents,** everywhere.
- **A feature talks to another feature only through its services,** never its repositories or models. `shared/` never imports a domain.
- **Every API route checks who is asking** and only returns that user's own business data (no IDOR).
- **Reused code is declared** in [`REUSE.md`](REUSE.md).
- **Work on a branch,** open a pull request, and don't push straight to `main`.

## Troubleshooting

- **The phone is stuck on "Connecting to the development server" or says "Failed to connect":** turn off any **VPN on the phone** first. A VPN hides the local network. Then check the phone and PC are on the same Wi-Fi, or use `npm run start:tunnel`.
- **The phone shows old code:** stop Metro and run `npx expo start --dev-client --clear`.
- **"Cannot find native module …" on the phone:** your dev build is older than a newly added native package. Install the latest build.
- **Port 8081 already in use:** another Metro server is running. Close it, or answer "yes" to use another port.
- **`flask db upgrade` can't connect:** check `POSTGRES_PASSWORD` in `backend/.env` matches the password from step 1, and that PostgreSQL is running.
