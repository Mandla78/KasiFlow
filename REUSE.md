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

| TruConnect `backend/src/shared/media/` (**reference only, not copied**) | `backend/src/shared/media/` | Akayza's own media module, written after reading TruConnect's: signed direct uploads, owner-first folders with HMAC keys, one `media_uploads` table for ownership, clean-up and the daily limit, our own Cloudinary callback check. A copy made earlier was replaced on 25 Sep 2026 |
| TruConnect `reset_password_routes.py` + `reset_password_web.html` (reference only) | `backend/src/domains/identity/auth/api/reset_page.py` + `templates/reset_password_page.html` | our own https page the reset email opens (email apps strip app links) |
| TruConnect `backend/scripts/verify_cloudinary_connection.py` (reference only) | `backend/scripts/verify_media.py` | our own end-to-end check of the real Cloudinary setup |

Coming later, with the features that need them: the PayFast provider and payment notifications, the backend Mapbox geocoding proxy. Each gets a row here when it's copied.

## Third-party libraries worth naming

| Library | Licence | Where | Why |
|---|---|---|---|
| [dilithium-py](https://github.com/GiacomoPope/dilithium-py) 1.4.0 (Giacomo Pope) | MIT | `backend/src/domains/proof/integrity/services/seal_keys.py` | ML-DSA-65 (NIST FIPS 204) post-quantum signatures on record seals, in pure Python. Used as a library, not copied; if it isn't installed, seals are signed with Ed25519 alone. |

## Photos and music

| What | Author | Licence | Where |
|---|---|---|---|
| Sample job photos (paving, brick walls, pipes, tiles, roofs) | Photographers on [Pexels](https://www.pexels.com) | [Pexels licence](https://www.pexels.com/license/) | `frontend/mobile/assets/sample-work/` (sources in `SOURCES.txt` there) |
| [Carefree](https://incompetech.com/music/royalty-free/) | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | the music in `docs/submission/05_final_submission/Akayza_Demo_TeamPR.mp4`; trimmed, faded in and out, and credited on the video's end card |
| [Nomonde Tuck Shop](https://commons.wikimedia.org/wiki/File:Nomonde_Tuck_Shop.jpg) | HelenOnline | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | slide 2 of the submitted pitch deck; resized, with our caption |
| [Aliwal North - Dukatole - Housebuilding Projekt](https://commons.wikimedia.org/wiki/File:Aliwal_North_-_Dukatole_-_03.05_-_Housebuilding_Projekt.jpg) | Heinz-Josef Lücking | [CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/deed.en) | slide 2 of the submitted pitch deck; resized, with our caption |

The Akayza logo, the app screens and the supplier logos in `backend/seed/demo_images/` are our own.
