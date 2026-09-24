"""
rate_limit -- auth's own limits ("how many requests, how often" per route).

The ENGINE is shared (src/shared/rate_limit: the limiter and the 429
response); each feature owns its POLICY here. Every limit that trips is
also written to the audit trail (see RATE_LIMIT_AUDIT_EVENTS).
"""
