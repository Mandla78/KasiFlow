"""rate_limit -- "too many attempts, try again later".

    limiter.py    the shared limiter; routes add @limiter.limit("5/minute")
    responses.py  the JSON 429 reply (with Retry-After) + an audit event
"""
