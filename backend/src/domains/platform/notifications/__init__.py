"""
notifications -- alerts the server makes when something happens that a
trader should know about (above all when SOMEONE ELSE acts), stored with
their read state, in two tabs: Orders and Inbox
(docs/teammate/feedback/CONTRACT_notifications.txt).

Publishers never import this: they call shared.notifications
.publish_notification(), and this feature's service is the listener.
"""
