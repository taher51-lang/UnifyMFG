from functools import wraps
from flask import request, jsonify, current_app
from config import supabase

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Allow preflight requests to pass through
        if request.method == "OPTIONS":
            return f(*args, **kwargs)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid authorization header"}), 401

        token = auth_header.split(" ")[1]

        try:
            # Verify token with Supabase
            user_response = supabase.auth.get_user(token)
            if not user_response or not user_response.user:
                return jsonify({"error": "Invalid or expired token"}), 401
            
            # Attach user to request for downstream handlers
            request.user = user_response.user
        except Exception as e:
            if current_app:
                current_app.logger.error(f"Auth error: {str(e)}")
            return jsonify({"error": "Authentication failed"}), 401

        return f(*args, **kwargs)
    return decorated
