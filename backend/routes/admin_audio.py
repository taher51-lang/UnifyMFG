# backend/routes/admin_audio.py
import os
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, send_file, current_app
from middleware.auth import require_auth
from config import supabase

admin_audio_bp = Blueprint("admin_audio", __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "audio_reports")

def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status

@admin_audio_bp.route("/audio-reports", methods=["GET"])
@require_auth
def list_audio_reports():
    try:
        q = supabase.table("audio_reports").select("*")

        reviewed = request.args.get("reviewed")
        if reviewed == "true":
            q = q.eq("reviewed", True)
        elif reviewed == "false":
            q = q.eq("reviewed", False)

        days = request.args.get("days")
        if days:
            try:
                cutoff = (datetime.now(timezone.utc) - timedelta(days=int(days))).isoformat()
                q = q.gte("created_at", cutoff)
            except ValueError:
                pass

        limit = request.args.get("limit", "50")
        try:
            limit = int(limit)
        except ValueError:
            limit = 50

        q = q.order("created_at", desc=True).limit(limit)
        resp = q.execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("Failed to list audio reports: %s", e)
        return _response(error=str(e), status=500)
# vvr
def detect_audio_mimetype(filepath, default="audio/webm"):
    try:
        with open(filepath, "rb") as f:
            header = f.read(16)
        if len(header) >= 8 and (header[4:8] == b"ftyp" or header[:4] == b"ftyp"):
            return "audio/mp4"
        if header.startswith(b"\x1a\x45\xdf\xa3"):
            return "audio/webm"
        if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WAVE":
            return "audio/wav"
        if header.startswith(b"OggS"):
            return "audio/ogg"
        if header.startswith(b"ID3") or header.startswith(b"\xff\xfb"):
            return "audio/mpeg"
    except Exception:
        pass
    ext = os.path.splitext(filepath)[1].lower()
    fallback_map = {
        ".webm": "audio/webm",
        ".mp4": "audio/mp4",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
    }
    return fallback_map.get(ext, default)

@admin_audio_bp.route("/audio-reports/<report_id>/play", methods=["GET"])
@require_auth
def play_audio(report_id):
    try:
        resp = supabase.table("audio_reports").select("filename").eq("id", report_id).execute()
        if not resp.data:
            return _response(error="Audio report not found", status=404)

        filename = resp.data[0]["filename"]
        filepath = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(filepath):
            return _response(error="Audio file not found on disk", status=404)

        mimetype = detect_audio_mimetype(filepath)
        return send_file(filepath, mimetype=mimetype, as_attachment=False, conditional=True)
    except Exception as e:
        current_app.logger.error("Failed to play audio: %s", e)
        return _response(error=str(e), status=500)

@admin_audio_bp.route("/audio-reports/<report_id>", methods=["PATCH"])
@require_auth
def update_audio_report(report_id):
    try:
        body = request.get_json()
        update = {}
        if "reviewed" in body:
            update["reviewed"] = body["reviewed"]
        if "notes" in body:
            update["notes"] = body["notes"]

        if not update:
            return _response(error="No fields to update", status=400)

        resp = supabase.table("audio_reports").update(update).eq("id", report_id).execute()
        current_app.logger.info("Audio report %s updated: %s", report_id, update)
        return _response(data=resp.data[0] if resp.data else None)
    except Exception as e:
        current_app.logger.error("Failed to update audio report: %s", e)
        return _response(error=str(e), status=500)

@admin_audio_bp.route("/audio-reports/<report_id>", methods=["DELETE"])
@require_auth
def delete_audio_report(report_id):
    try:
        resp = supabase.table("audio_reports").select("filename").eq("id", report_id).execute()
        if resp.data:
            filename = resp.data[0]["filename"]
            filepath = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(filepath):
                os.remove(filepath)

        supabase.table("audio_reports").delete().eq("id", report_id).execute()
        current_app.logger.info("Audio report %s deleted", report_id)
        return _response(data={"deleted": True})
    except Exception as e:
        current_app.logger.error("Failed to delete audio report: %s", e)
        return _response(error=str(e), status=500)

def cleanup_old_audio():
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=4)).isoformat()
        resp = supabase.table("audio_reports").select("id, filename").lt("created_at", cutoff).execute()
        if not resp.data:
            return
        count = 0
        for report in resp.data:
            filepath = os.path.join(UPLOAD_DIR, report["filename"])
            if os.path.exists(filepath):
                os.remove(filepath)
            supabase.table("audio_reports").delete().eq("id", report["id"]).execute()
            count += 1
        print(f"[Audio Cleanup] Removed {count} audio reports older than 4 days.")
    except Exception as e:
        print(f"[Audio Cleanup] Error: {e}")
