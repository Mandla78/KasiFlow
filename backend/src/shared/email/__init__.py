"""email -- sending email. The ONLY place in the backend that talks SMTP.

Domains call EmailService; they never send mail themselves. In
development MAIL_PROVIDER=fake prints emails to the console instead of
sending them (e.g. the 6-digit verification code).
"""
