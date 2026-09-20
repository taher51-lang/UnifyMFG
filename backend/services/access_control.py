# backend/services/access_control.py
import json
import os
from datetime import datetime, timezone, timedelta
try:
    from zoneinfo import ZoneInfo
    IST = ZoneInfo("Asia/Kolkata")
except Exception:
    IST = timezone(timedelta(hours=5, minutes=30))

from config import supabase

SETTING_KEY = "employee_access_restriction"
LOCAL_CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance", "access_control.json")

DEFAULT_SETTINGS = {
    "enabled": True,                  # Enforce working hours schedule
    "immediate_lockdown": False,      # One-click emergency lockdown (block all employee access now)
    "start_time": "09:00",            # 9:00 AM IST
    "end_time": "19:00",              # 7:00 PM IST
    "allowed_days": [1, 2, 3, 4, 5, 6],  # 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat (7=Sun is off)
    "timezone": "Asia/Kolkata",
    "custom_message": "Employee logins are restricted outside normal business hours (9:00 AM – 7:00 PM, Mon–Sat). Please contact administration if you require access."
}

_memory_cache = None

def _load_from_disk():
    try:
        if os.path.exists(LOCAL_CACHE_FILE):
            with open(LOCAL_CACHE_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return None

def _save_to_disk(data):
    try:
        os.makedirs(os.path.dirname(LOCAL_CACHE_FILE), exist_ok=True)
        with open(LOCAL_CACHE_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

def get_access_settings():
    """
    Fetches settings from Supabase system_settings table, falling back to memory/disk.
    """
    global _memory_cache
    try:
        resp = supabase.table("system_settings").select("value").eq("key", SETTING_KEY).maybe_single().execute()
        if resp and resp.data and resp.data.get("value"):
            val = resp.data["value"]
            # Merge with defaults to ensure all keys exist
            merged = {**DEFAULT_SETTINGS, **val}
            _memory_cache = merged
            _save_to_disk(merged)
            return merged
    except Exception:
        # Fallback to local or memory cache
        pass

    if _memory_cache:
        return _memory_cache

    disk_data = _load_from_disk()
    if disk_data:
        _memory_cache = disk_data
        return disk_data

    _memory_cache = dict(DEFAULT_SETTINGS)
    return _memory_cache

def update_access_settings(new_settings, user_id=None):
    """
    Updates access settings in Supabase and local cache.
    """
    global _memory_cache
    current = get_access_settings()
    updated = {**current, **new_settings}

    # Persist in Supabase
    try:
        supabase.table("system_settings").upsert({
            "key": SETTING_KEY,
            "value": updated,
            "description": "Controls employee login hours and immediate activity lockdown",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user_id
        }).execute()
    except Exception:
        pass

    _memory_cache = updated
    _save_to_disk(updated)
    return updated

def evaluate_employee_access(settings=None):
    """
    Evaluates whether an employee is currently allowed to access the system.
    Returns:
      {
        "allowed": bool,
        "reason": "OK" | "IMMEDIATE_LOCKDOWN" | "OUTSIDE_HOURS" | "DISALLOWED_DAY",
        "message": str,
        "current_time_str": str,
        "current_day_str": str,
        "settings": dict
      }
    """
    if settings is None:
        settings = get_access_settings()

    now_ist = datetime.now(IST)
    weekday = now_ist.isoweekday()  # 1=Mon ... 7=Sun
    day_name = now_ist.strftime("%A")
    time_str = now_ist.strftime("%H:%M")
    full_str = now_ist.strftime("%Y-%m-%d %I:%M %p IST")

    # 1. Immediate lockdown check
    if settings.get("immediate_lockdown"):
        return {
            "allowed": False,
            "reason": "IMMEDIATE_LOCKDOWN",
            "message": "Employee activity is currently restricted by the administrator.",
            "current_time_str": full_str,
            "current_day_str": day_name,
            "settings": settings
        }

    # 2. Check if working hours enforcement is active
    if not settings.get("enabled"):
        return {
            "allowed": True,
            "reason": "OK",
            "message": "Access is unrestricted (working hours enforcement is disabled).",
            "current_time_str": full_str,
            "current_day_str": day_name,
            "settings": settings
        }

    # 3. Check allowed day of week
    allowed_days = settings.get("allowed_days", [1, 2, 3, 4, 5, 6])
    if weekday not in allowed_days:
        return {
            "allowed": False,
            "reason": "DISALLOWED_DAY",
            "message": f"Employee logins are disabled on {day_name}s. Normal operating days are Mon–Sat.",
            "current_time_str": full_str,
            "current_day_str": day_name,
            "settings": settings
        }

    # 4. Check time window
    start_time = settings.get("start_time", "09:00")
    end_time = settings.get("end_time", "19:00")

    if not (start_time <= time_str <= end_time):
        formatted_start = datetime.strptime(start_time, "%H:%M").strftime("%I:%M %p")
        formatted_end = datetime.strptime(end_time, "%H:%M").strftime("%I:%M %p")
        return {
            "allowed": False,
            "reason": "OUTSIDE_HOURS",
            "message": f"Employee logins are restricted outside business hours ({formatted_start} to {formatted_end}).",
            "current_time_str": full_str,
            "current_day_str": day_name,
            "settings": settings
        }

    return {
        "allowed": True,
        "reason": "OK",
        "message": "Access permitted within working hours.",
        "current_time_str": full_str,
        "current_day_str": day_name,
        "settings": settings
    }
