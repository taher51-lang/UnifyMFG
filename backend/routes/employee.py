# backend/routes/employee.py
import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from middleware.auth import require_auth
from config import supabase

employee_bp = Blueprint("employee", __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "audio_reports")

def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status

def _is_employee_restricted(user):
    try:
        from services.access_control import evaluate_employee_access
        eval_res = evaluate_employee_access()
        if eval_res.get("allowed"):
            return False, None
        if user:
            try:
                resp = supabase.table("user_profiles").select("role").eq("user_id", user.id).maybe_single().execute()
                if resp and resp.data and resp.data.get("role") == "admin":
                    return False, None
            except Exception:
                pass
            email = (getattr(user, "email", "") or "").lower()
            if email.startswith("admin@") or "admin" in email:
                return False, None
        return True, eval_res.get("message")
    except Exception as err:
        current_app.logger.warning("Error checking employee restriction: %s", err)
        return False, None

@employee_bp.route("/access-status", methods=["GET"])
def get_employee_access_status():
    """
    Public endpoint to check if employee access is permitted right now.
    """
    try:
        from services.access_control import evaluate_employee_access
        status = evaluate_employee_access()
        return _response(data=status)
    except Exception as e:
        current_app.logger.error("Failed to get access status: %s", e)
        return _response(data={"allowed": True, "reason": "FALLBACK", "message": "Access permitted."})

@employee_bp.route("/audio-report", methods=["POST"])
@require_auth
def upload_audio_report():
    user = getattr(request, "user", None)
    is_restricted, msg = _is_employee_restricted(user)
    if is_restricted:
        return _response(error=msg, status=403)

    if "audio" not in request.files:
        return _response(error="No audio file uploaded", status=400)

    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return _response(error="Empty filename", status=400)

    employee_name = request.form.get("employee_name", "").strip()
    if not employee_name:
        user = getattr(request, "user", None)
        employee_name = getattr(user, "email", "Unknown") if user else "Unknown"

    duration = request.form.get("duration_seconds", None)
    if duration:
        try:
            duration = int(float(duration))
        except (ValueError, TypeError):
            duration = None

    ext = os.path.splitext(audio_file.filename)[1].lower() or ".webm"
    base_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    unique_name = f"{base_id}{ext}"

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, unique_name)
    audio_file.save(filepath)

    try:
        with open(filepath, "rb") as f:
            hdr = f.read(16)
        if len(hdr) >= 8 and (hdr[4:8] == b"ftyp" or hdr[:4] == b"ftyp"):
            real_ext = ".mp4"
        elif hdr.startswith(b"\x1a\x45\xdf\xa3"):
            real_ext = ".webm"
        elif hdr.startswith(b"RIFF"):
            real_ext = ".wav"
        else:
            real_ext = ext

        if real_ext != ext:
            correct_name = f"{base_id}{real_ext}"
            new_filepath = os.path.join(UPLOAD_DIR, correct_name)
            os.rename(filepath, new_filepath)
            filepath = new_filepath
            unique_name = correct_name
    except Exception:
        pass

    try:
        row = {
            "employee_name": employee_name,
            "filename": unique_name,
            "duration_seconds": duration,
        }
        resp = supabase.table("audio_reports").insert(row).execute()
        current_app.logger.info("Employee '%s' uploaded audio report: %s", employee_name, unique_name)

        # Automatically log to employee_activity_logs
        try:
            user = getattr(request, "user", None)
            ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
            if "," in ip:
                ip = ip.split(",")[0].strip()
            supabase.table("employee_activity_logs").insert({
                "user_id": user.id if user else "00000000-0000-0000-0000-000000000000",
                "employee_name": employee_name,
                "employee_email": getattr(user, "email", employee_name) if user else employee_name,
                "event_type": "AUDIO_REPORT",
                "details": {
                    "filename": unique_name,
                    "duration_seconds": duration,
                },
                "ip_address": ip,
                "user_agent": request.headers.get("User-Agent", "")[:255],
            }).execute()
        except Exception as log_err:
            current_app.logger.warning("Failed to record activity log for audio report: %s", log_err)

        return _response(data=resp.data[0] if resp.data else row, status=201)
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        current_app.logger.error("Failed to save audio report: %s", e)
        return _response(error=str(e), status=500)

@employee_bp.route("/activity", methods=["POST"])
@require_auth
def record_activity():
    user = getattr(request, "user", None)
    if not user:
        return _response(error="Not authenticated", status=401)

    body = request.get_json(silent=True) or {}
    event_type = (body.get("event_type") or "GENERIC").upper().strip()
    details = body.get("details") or {}
    employee_name = body.get("employee_name")

    if not employee_name:
        try:
            p = supabase.table("user_profiles").select("display_name").eq("user_id", user.id).maybe_single().execute()
            if p and p.data and p.data.get("display_name"):
                employee_name = p.data["display_name"]
            else:
                employee_name = getattr(user, "email", "Employee")
        except Exception:
            employee_name = getattr(user, "email", "Employee")

    employee_email = getattr(user, "email", "")
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    if "," in ip:
        ip = ip.split(",")[0].strip()
    ua = request.headers.get("User-Agent", "")[:255]

    try:
        row = {
            "user_id": user.id,
            "employee_name": employee_name,
            "employee_email": employee_email,
            "event_type": event_type,
            "details": details,
            "ip_address": ip,
            "user_agent": ua,
        }
        resp = supabase.table("employee_activity_logs").insert(row).execute()
        current_app.logger.info("Activity logged: [%s] %s (%s)", event_type, employee_name, employee_email)
        return _response(data=resp.data[0] if resp.data else row, status=201)
    except Exception as e:
        current_app.logger.error("Failed to record employee activity log: %s", e)
        return _response(error=str(e), status=500)

@employee_bp.route("/products-search", methods=["GET"])
@require_auth
def search_products():
    user = getattr(request, "user", None)
    is_restricted, msg = _is_employee_restricted(user)
    if is_restricted:
        return _response(error=msg, status=403)

    query = request.args.get("q", "").strip()
    try:
        q = supabase.table("products").select("name, retail_price")
        if query:
            q = q.ilike("name", f"%{query}%").order("name").limit(100)
        else:
            q = q.order("name").limit(1000)
        resp = q.execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("Product search failed: %s", e)
        return _response(error=str(e), status=500)

@employee_bp.route("/my-role", methods=["GET"])
@require_auth
def get_my_role():
    user = getattr(request, "user", None)
    if not user:
        return _response(error="Not authenticated", status=401)
    try:
        resp = supabase.table("user_profiles").select("display_name, role").eq("user_id", user.id).execute()
        if resp.data and len(resp.data) > 0:
            return _response(data=resp.data[0])
            
        user_meta = getattr(user, "user_metadata", {}) or {}
        role = user_meta.get("role")
        if role:
            return _response(data={"display_name": user.email, "role": role})

        email = (getattr(user, "email", "") or "").lower()
        if email.startswith("admin@") or "admin" in email:
            return _response(data={"display_name": user.email, "role": "admin"})
            
        return _response(data={"display_name": user.email, "role": "employee"})
    except Exception as e:
        current_app.logger.error("Failed to get user role: %s", e)
        return _response(data={"display_name": getattr(user, "email", ""), "role": "employee"})
