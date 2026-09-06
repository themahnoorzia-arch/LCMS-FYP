from flask import Flask
from flask import send_from_directory

import os

from config import Config

from extensions import register_extensions

# --------------------------------------------------
# BLUEPRINTS
# --------------------------------------------------
from blueprints.auth import auth_bp
from blueprints.users import users_bp
from blueprints.court import court_bp
from blueprints.financials import financials_bp
from blueprints.legal_actors import legal_actors_bp
from blueprints.cases import cases_bp
from blueprints.registrar_routes import registrar_bp
from blueprints.notifications import notifications_bp


_DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")


def create_app():

    # static_folder=None disables Flask's own automatic static-file route.
    # That route used to auto-register at the same "/<path:filename>"
    # pattern as our own catch-all below (because static_url_path was ""),
    # and since it's registered first, it always won — silently 404ing on
    # any client-side route (e.g. a hard refresh on /login) before our
    # code serving index.html as a fallback ever ran. We serve static files
    # ourselves in serve_spa() below instead.
    app = Flask(
        __name__,
        static_folder=None,
    )

    Config.validate_config()
    app.config.from_object(Config)

    register_extensions(app)

    # ----------------------------------------------
    # REGISTER BLUEPRINTS
    # ----------------------------------------------
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(court_bp)
    app.register_blueprint(financials_bp)
    app.register_blueprint(legal_actors_bp)
    app.register_blueprint(cases_bp)
    app.register_blueprint(registrar_bp, url_prefix='/api/registrar')
    app.register_blueprint(notifications_bp)

    # Run startup migrations (idempotent — safe to run every boot)
    from utils.notifications import ensure_notifications_table
    from utils.db_migrations import run_all as run_migrations
    with app.app_context():
        ensure_notifications_table()
        run_migrations()

    # ----------------------------------------------
    # HEALTH CHECK
    # ----------------------------------------------
    @app.route("/health")
    def health():
        return {"status": "ok"}

    # ----------------------------------------------
    # REACT BUILD
    # ----------------------------------------------
    @app.route("/")
    def serve():
        return send_from_directory(
            _DIST_DIR,
            "index.html"
        )

    @app.route("/<path:path>")
    def serve_spa(path):
        # A real built asset (JS/CSS/image) gets served as-is; anything
        # else is a client-side React Router path (e.g. /login,
        # /AdminDashboard) reached via a hard navigation or page refresh —
        # hand back index.html so React Router can take over.
        full_path = os.path.join(_DIST_DIR, path)
        if os.path.isfile(full_path):
            return send_from_directory(_DIST_DIR, path)
        return send_from_directory(_DIST_DIR, "index.html")

    return app
app = create_app()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=os.getenv("FLASK_DEBUG") == "1"
    )