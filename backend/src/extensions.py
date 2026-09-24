"""
Flask extensions, created WITHOUT an app.

Binding happens in the app factory (src/__init__.py) through each
extension's init_app(app). That lets create_app() run more than once
(the real app, plus a fresh one per test) without state leaking between
instances. (Pattern reused from TruConnect; see REUSE.md.)
"""
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
ma = Marshmallow()
bcrypt = Bcrypt()
