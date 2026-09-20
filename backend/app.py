# backend/app.py

from flask import Flask
from flask_cors import CORS
import logging
from logging.handlers import RotatingFileHandler
import os
import re
from routes.raw_materials import raw_materials_bp
from routes.products import products_bp
from routes.formulations import formulations_bp
from routes.inventory import inventory_bp
from routes.customers import customers_bp
from routes.invoices import invoices_bp
from routes.reports import reports_bp
from routes.system import system_bp
from routes.scan_stock import scan_stock_bp
from routes.voice_stock import voice_stock_bp
from routes.admin_employee import admin_employee_bp
from routes.admin_audio import admin_audio_bp
from routes.employee import employee_bp
from config import FLASK_SECRET_KEY
# 

def setup_logging(app):
    os.makedirs('logs', exist_ok=True)
    handler = RotatingFileHandler('logs/app.log', maxBytes=2_000_000, backupCount=3)
    handler.setFormatter(logging.Formatter(
        '%(asctime)s | %(levelname)-7s | %(message)s', datefmt='%Y-%m-%d %H:%M:%S'
    ))
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)


def create_app():
    app = Flask(__name__)
    app.secret_key = FLASK_SECRET_KEY
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB upload limit
    setup_logging(app)

    # Log the active environment and DB
    env = os.environ.get("FLASK_ENV", "development")
    db_url = os.environ.get("SUPABASE_URL", "Not Set")
    app.logger.info(f"Starting app in {env.upper()} mode.")
    app.logger.info(f"Connected to Database URL: {db_url}")

    cors_origins = [
        "https://asianflavouringindustries.tech",
        "https://www.asianflavouringindustries.tech",
        "https://formulation-1.onrender.com",
        "http://localhost:5173",
        re.compile(r"^http://(127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|localhost):\d+$"),
    ]

    CORS(app, resources={r"/api/*": {
        "origins": cors_origins,
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Range", "X-Requested-With"],
        "expose_headers": ["Content-Range", "Accept-Ranges", "Content-Disposition"]
    }})

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from scripts.backup import backup as run_backup_logic
        from routes.admin_audio import cleanup_old_audio
        scheduler = BackgroundScheduler()
        scheduler.add_job(func=run_backup_logic, trigger="cron", day_of_week='sat', hour=23, minute=59)
        scheduler.add_job(func=cleanup_old_audio, trigger="cron", hour=3, minute=0)
        scheduler.start()
        app.logger.info("Weekend backup and audio cleanup schedulers started successfully.")
    except Exception as e:
        app.logger.error(f"Failed to start schedulers: {str(e)}")

    app.register_blueprint(raw_materials_bp, url_prefix="/api/raw-materials")
    app.register_blueprint(products_bp, url_prefix="/api/products")
    app.register_blueprint(formulations_bp, url_prefix="/api/formulations")
    app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
    app.register_blueprint(customers_bp, url_prefix="/api/customers")
    app.register_blueprint(invoices_bp, url_prefix="/api/invoices")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(system_bp, url_prefix="/api/system")
    app.register_blueprint(scan_stock_bp, url_prefix="/api")
    app.register_blueprint(voice_stock_bp, url_prefix="/api")
    app.register_blueprint(admin_employee_bp, url_prefix="/api/admin/employee")
    app.register_blueprint(admin_audio_bp, url_prefix="/api/admin/audio")
    app.register_blueprint(employee_bp, url_prefix="/api/employee")

    @app.route("/api/health")
    def health():
        return {"data": "ok", "error": None}

    return app
# 

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005)