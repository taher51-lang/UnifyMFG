import time
from functools import wraps
from flask import request, jsonify
from config import supabase

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        class MockUser:
            id = "8bc3fe47-6736-4f3b-a2e7-1e551df6d9d1"
            email = "test@test.com"
        request.user = MockUser()
        return f(*args, **kwargs)
    return decorated
