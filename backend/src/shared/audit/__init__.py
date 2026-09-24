"""audit -- "who did what, when, and from where".

    audit.py          publish(event): records security and business events
    audit_context.py  fills in IP, device, endpoint automatically from the
                      request, so callers don't pass them around
    audit_types.py    the event shape (domain, actor, category, severity)
    event_types/      the list of known event names
"""
