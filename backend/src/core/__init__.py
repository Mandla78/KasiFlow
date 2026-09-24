"""core -- the basic building blocks every part of the app uses.

    responses.py    every reply has the same shape:
                    {"success": true, "message": "...", "data": {...}}
    exceptions.py   NotFoundError, ValidationError, ConflictError... each
                    carries an HTTP status and a stable "code" the app can
                    switch on (e.g. "EMAIL_NOT_VERIFIED")
    base_model.py   every table gets: id (UUID), created_at, updated_at,
                    deleted_at (soft delete)

Nothing here knows about traders, suppliers or orders.
"""
