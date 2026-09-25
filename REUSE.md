# Reused code

Akayza is built for GKHack26. Its general-purpose infrastructure comes from our own earlier project, **TruConnect** (github.com/Mandla78/TRU-Connect, same author). Everything specific to Akayza is new: the domains and features, screens, flows, the record/ledger and the cash handshake.

The reused code was adapted: the product name was replaced, and imports of TruConnect-only domains were removed. Where a reused file keeps an explanation of a past decision, that history is TruConnect's.

| Akayza path | From TruConnect | What it does |
|---|---|---|
| `backend/src/core/` | `src/core/` | response envelope, error classes with stable codes, base model (UUID, timestamps, soft delete) |
| `backend/src/extensions.py` | `src/extensions.py` | Flask extensions created without an app |
| `backend/src/config.py` | `src/config.py` | environment config (rewritten for Akayza) |
| `backend/src/__init__.py` | `src/__init__.py` | app-factory pattern (rewritten for Akayza) |
| `backend/src/master_scheduler/` | `src/master_scheduler/` | one scheduler; each feature declares its own jobs |
| `backend/src/shared/finance/` | `src/shared/finance/` | money engine: integer cents, rounding, formatting, allocation, receipts |
| `backend/src/shared/idempotency/` | `src/shared/idempotency/` | offline uploads and retries land exactly once |
| `backend/src/shared/audit/` | `src/shared/audit/` | typed audit events |
| `backend/src/shared/email/` | `src/shared/email/` | email service with a fake provider for development (templates not copied) |
| `backend/src/shared/queue/` | `src/shared/queue/` | background worker pool |
| `backend/src/shared/rate_limit/` | `src/domains/security/rate_limit/` | Flask-Limiter wrapper with JSON 429 responses |
| `backend/src/shared/cache/`, `logging/`, `monitoring/`, `security/`, `validation/`, `helpers/`, `constants/`, `notifications/`, `scheduling/` | `src/shared/...` | small shared utilities |
| `backend/tests/architecture/test_finance_boundaries.py` | `tests/architecture/` | fails the build if finance imports a domain |
| `frontend/mobile/src/shared/location-picker/` | `frontend/mobile/src/features/dashboard/shared/location-picker/` | address search + fixed-centre-pin map in a WebView (Mapbox GL JS), reverse geocode only pre-fills editable fields. Adapted: our components instead of react-native-paper, an OpenStreetMap fallback when no token is set, a web (iframe) version |

| `backend/src/shared/media/` | `backend/src/shared/media/` | Cloudinary media: signed direct uploads, upload intents + orphan sweep, cross-feature upload ledger, HMAC-verified webhooks, owner-first folders with HMAC keys instead of database ids. Adapted: `akayza/informal-trader/…` and `akayza/supplier/…` folders, tables in the `platform` schema, malware scan off by default, a `fetch_asset` check so the server never trusts the URL or size the phone reports, a fake provider for tests. TruConnect's stuck-scan sweep stays per feature (shared code can't import a domain here) |
| `backend/src/domains/platform/api/reset_password_routes.py` + `templates/reset_password_web.html` | `backend/src/domains/identity/auth/api/reset_page.py` + `templates/reset_password_page.html` | the https page the reset email opens (email apps strip app links): checks the ticket, new-password form, "Open the Akayza app" link. Adapted: Akayza branding, calls identity's own `reset_password`, Flask-Limiter per IP |
| `backend/scripts/verify_cloudinary_connection.py` | `backend/scripts/verify_media.py` | checks the real Cloudinary account: keys, a signed upload exactly as the phone does it, `fetch_asset`, the webhook through the tunnel (forged call refused, signed call accepted), clean-up |

Coming later, with the features that need them: the PayFast provider and payment notifications, the backend Mapbox geocoding proxy. Each gets a row here when it's copied.
