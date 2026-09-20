import os
import io
import csv
import zipfile
from datetime import datetime
from flask import Blueprint, jsonify, send_file, current_app
from middleware.auth import require_auth
from config import supabase

system_bp = Blueprint("system", __name__)

def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status

# Tables to backup
BACKUP_TABLES = [
    "raw_materials",
    "raw_material_price_history",
    "product_categories",
    "products",
    "product_formula",
    "formulations",
    "formulation_ingredients",
    "customers",
    "invoices",
    "invoice_items",
    "purchase_log",
    "production_log",
    "loose_packing_log",
    "product_purchase_log",
    "stock_ledger"
]

@system_bp.route("/backup", methods=["POST"])
@require_auth
def run_manual_backup():
    """Generate a ZIP backup of all tables and stream it to the browser as a download."""
    try:
        timestamp = datetime.now().strftime("%d-%b-%Y_%I-%M-%p")
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for table_name in BACKUP_TABLES:
                try:
                    res = supabase.table(table_name).select("*").execute()
                    data = res.data
                    if not data:
                        continue

                    # Write table to CSV in memory
                    csv_buffer = io.StringIO()
                    headers = list(data[0].keys())
                    writer = csv.DictWriter(csv_buffer, fieldnames=headers)
                    writer.writeheader()
                    writer.writerows(data)

                    zipf.writestr(f"{table_name}.csv", csv_buffer.getvalue())
                except Exception as e:
                    current_app.logger.error("failed to export table %s during backup: %s", table_name, e)
                    print(f"Error exporting {table_name}: {str(e)}")

            # Include the schema.sql for disaster recovery
            schema_path = os.path.join(os.path.dirname(__file__), "..", "schema.sql")
            if os.path.exists(schema_path):
                with open(schema_path, "r") as f:
                    zipf.writestr("schema.sql", f.read())

        zip_buffer.seek(0)
        filename = f"Flavour_Backup_{timestamp}.zip"

        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        current_app.logger.error("failed to run manual backup: %s", e)
        return _response(error=str(e), status=500)

@system_bp.route("/backup-drive", methods=["POST"])
@require_auth
def run_drive_backup():
    """Trigger the Google Drive backup script manually."""
    try:
        from scripts.backup import backup
        backup()
        current_app.logger.info("Google Drive backup completed successfully")
        return _response(data={"message": "Backup uploaded to Google Drive successfully!"})
    except Exception as e:
        current_app.logger.error("failed to run Google Drive backup: %s", e)
        return _response(error=str(e), status=500)
