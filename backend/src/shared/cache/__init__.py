"""cache -- short-lived memory for things that are expensive to look up.

In-memory today (one server). Also backs simple rate checks
(check_rate_limit). Swappable for Redis later without changing callers.
"""
