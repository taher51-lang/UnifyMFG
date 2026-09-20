# backend/routes/admin_employee.py
import os
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, current_app
from middleware.auth import require_auth
from config import supabase

admin_employee_bp = Blueprint("admin_employee", __name__)

def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status

@admin_employee_bp.route("/employee-activities", methods=["GET"])
@require_auth
def list_employee_activities():
    """
    Returns chronological list of employee activity logs with filtering options.
    Query parameters:
      - user_id: UUID
      - event_type: LOGIN, LOGOUT, AUDIO_REPORT, PRICE_SEARCH
      - days: number of days back (e.g., 1, 7, 30)
      - date: YYYY-MM-DD (specific day)
      - limit: default 50, max 200
      - offset: default 0
    """
    try:
        q = supabase.table("employee_activity_logs").select("*")

        user_id = request.args.get("user_id", "").strip()
        if user_id:
            q = q.eq("user_id", user_id)

        event_type = request.args.get("event_type", "").strip().upper()
        if event_type and event_type != "ALL":
            q = q.eq("event_type", event_type)

        # Specific single day filter
        date_str = request.args.get("date", "").strip()
        if date_str:
            try:
                start_of_day = f"{date_str}T00:00:00Z"
                end_of_day = f"{date_str}T23:59:59Z"
                q = q.gte("created_at", start_of_day).lte("created_at", end_of_day)
            except Exception:
                pass
        else:
            days = request.args.get("days", "").strip()
            if days:
                try:
                    cutoff = (datetime.now(timezone.utc) - timedelta(days=int(days))).isoformat()
                    q = q.gte("created_at", cutoff)
                except ValueError:
                    pass

        try:
            limit = min(int(request.args.get("limit", 50)), 200)
        except ValueError:
            limit = 50

        try:
            offset = max(int(request.args.get("offset", 0)), 0)
        except ValueError:
            offset = 0

        q = q.order("created_at", desc=True).range(offset, offset + limit - 1)
        resp = q.execute()

        return _response(data=resp.data or [])
    except Exception as e:
        current_app.logger.error("Failed to list employee activities: %s", e)
        return _response(error=str(e), status=500)


@admin_employee_bp.route("/employee-summary", methods=["GET"])
@require_auth
def get_employee_summary():
    """
    Returns a high-level summary of employees, their last login, and activity counts.
    """
    try:
        # 1. Fetch all user profiles with role = employee
        profiles_resp = supabase.table("user_profiles").select("user_id, display_name, role, created_at").eq("role", "employee").execute()
        profiles = profiles_resp.data or []

        # 2. Today's start in UTC
        now_utc = datetime.now(timezone.utc)
        today_start_iso = now_utc.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

        # 3. Query recent activity logs (last 30 days) to calculate stats
        logs_resp = supabase.table("employee_activity_logs") \
            .select("user_id, employee_name, employee_email, event_type, created_at") \
            .gte("created_at", (now_utc - timedelta(days=30)).isoformat()) \
            .order("created_at", desc=True) \
            .limit(1000) \
            .execute()
        logs = logs_resp.data or []

        # Aggregate stats per user
        stats_by_user = {}
        for log in logs:
            uid = log.get("user_id")
            if not uid:
                continue
            if uid not in stats_by_user:
                stats_by_user[uid] = {
                    "last_active": log.get("created_at"),
                    "last_login": None,
                    "today_events": 0,
                    "total_events": 0,
                    "audio_count": 0,
                    "employee_name": log.get("employee_name", ""),
                    "employee_email": log.get("employee_email", ""),
                }
            s = stats_by_user[uid]
            s["total_events"] += 1
            if log.get("created_at", "") >= today_start_iso:
                s["today_events"] += 1
            if log.get("event_type") == "LOGIN" and not s["last_login"]:
                s["last_login"] = log.get("created_at")
            if log.get("event_type") == "AUDIO_REPORT":
                s["audio_count"] += 1

        # Combine with user_profiles
        summary_list = []
        seen_user_ids = set()

        for p in profiles:
            uid = p.get("user_id")
            seen_user_ids.add(uid)
            user_stats = stats_by_user.get(uid, {})
            summary_list.append({
                "user_id": uid,
                "display_name": p.get("display_name") or user_stats.get("employee_name", "Employee"),
                "email": user_stats.get("employee_email", ""),
                "last_login": user_stats.get("last_login"),
                "last_active": user_stats.get("last_active"),
                "is_active_today": (user_stats.get("today_events", 0) > 0),
                "today_events": user_stats.get("today_events", 0),
                "total_events": user_stats.get("total_events", 0),
                "audio_reports": user_stats.get("audio_count", 0),
            })

        # Add any employees who exist in activity logs but not yet in user_profiles
        for uid, s in stats_by_user.items():
            if uid not in seen_user_ids:
                summary_list.append({
                    "user_id": uid,
                    "display_name": s.get("employee_name", "Employee"),
                    "email": s.get("employee_email", ""),
                    "last_login": s.get("last_login"),
                    "last_active": s.get("last_active"),
                    "is_active_today": (s.get("today_events", 0) > 0),
                    "today_events": s.get("today_events", 0),
                    "total_events": s.get("total_events", 0),
                    "audio_reports": s.get("audio_count", 0),
                })

        # Overview counters
        total_employees = len(summary_list)
        active_today_count = sum(1 for e in summary_list if e["is_active_today"])
        today_total_logs = sum(e["today_events"] for e in summary_list)

        return _response(data={
            "employees": summary_list,
            "metrics": {
                "total_employees": total_employees,
                "active_today": active_today_count,
                "today_total_events": today_total_logs,
            }
        })
    except Exception as e:
        current_app.logger.error("Failed to generate employee summary: %s", e)
        return _response(error=str(e), status=500)

@admin_employee_bp.route("/access-control", methods=["GET"])
@require_auth
def get_access_control_status():
    """
    Returns the current employee access control settings, evaluation status, and server time.
    """
    try:
        from services.access_control import get_access_settings, evaluate_employee_access
        settings = get_access_settings()
        evaluation = evaluate_employee_access(settings)
        return _response(data={
            "settings": settings,
            "status": evaluation
        })
    except Exception as e:
        current_app.logger.error("Failed to fetch access control status: %s", e)
        return _response(error=str(e), status=500)

@admin_employee_bp.route("/access-control", methods=["POST"])
@require_auth
def set_access_control_status():
    """
    Updates access control configuration (e.g. toggle immediate lockdown, change hours).
    """
    try:
        from services.access_control import update_access_settings, evaluate_employee_access
        body = request.get_json(silent=True) or {}
        user = getattr(request, "user", None)
        user_id = getattr(user, "id", None)

        updated = update_access_settings(body, user_id=user_id)
        evaluation = evaluate_employee_access(updated)

        # Audit log this admin action in employee_activity_logs
        try:
            admin_name = getattr(user, "email", "Admin")
            supabase.table("employee_activity_logs").insert({
                "user_id": user_id or "00000000-0000-0000-0000-000000000000",
                "employee_name": f"Admin ({admin_name})",
                "employee_email": getattr(user, "email", "admin"),
                "event_type": "ACCESS_CONTROL_UPDATED",
                "details": {
                    "immediate_lockdown": updated.get("immediate_lockdown"),
                    "enabled": updated.get("enabled"),
                    "start_time": updated.get("start_time"),
                    "end_time": updated.get("end_time"),
                    "allowed_days": updated.get("allowed_days"),
                },
                "ip_address": request.remote_addr or "",
                "user_agent": request.headers.get("User-Agent", "")[:255]
            }).execute()
        except Exception as log_err:
            current_app.logger.warning("Failed to log access control update: %s", log_err)

        return _response(data={
            "settings": updated,
            "status": evaluation
        })
    except Exception as e:
        current_app.logger.error("Failed to update access control: %s", e)
        return _response(error=str(e), status=500)
