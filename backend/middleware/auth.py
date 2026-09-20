import time
from functools import wraps
from flask import request, jsonify
from config import supabase

_TOKEN_CACHE = {}
_CACHE_TTL = 120  # 2 minutes cache for high-frequency requests like audio streaming

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        elif request.args.get("token"):
            token = request.args.get("token")

        if not token:
            return jsonify({"error": "Missing or invalid authorization header", "data": None}), 401

        now = time.time()
        cached = _TOKEN_CACHE.get(token)
        if cached and (now - cached["time"] < _CACHE_TTL):
            request.user = cached["user"]
            return f(*args, **kwargs)

        try:
            # Verify token via Supabase
            user_res = supabase.auth.get_user(token)
            if not user_res or not user_res.user:
                return jsonify({"error": "Invalid or expired token", "data": None}), 401
                
            # Store user in request context
            request.user = user_res.user
            _TOKEN_CACHE[token] = {"user": user_res.user, "time": now}
            
        except Exception as e:
            return jsonify({"error": f"Authentication failed: {str(e)}", "data": None}), 401

        return f(*args, **kwargs)

    return decorated

