"""
security -- "watching over the platform".

    audit/   the audit trail: every security-relevant action, stored in an
             append-only table (audit.audit_events) that nobody can edit or
             delete -- not even the application itself

Other domains never import this area. They PUBLISH events through
src/shared/audit; security/audit subscribes and stores them. That keeps
the dependency arrow pointing one way.

Tables live in the "audit" database schema.
"""
