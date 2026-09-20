# backend/config.py
# Configuration and Supabase client initialization

import os
from dotenv import load_dotenv
from supabase import create_client, Client

basedir = os.path.dirname(os.path.abspath(__file__))

# First, load the default .env (common variables)
load_dotenv(os.path.join(basedir, '.env'))

# Then, load environment-specific overrides
env = os.environ.get('FLASK_ENV', 'development')
if env == 'production':
    load_dotenv(os.path.join(basedir, '.env.production'), override=True)
else:
    load_dotenv(os.path.join(basedir, '.env.development'), override=True)

# Required environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-in-production")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

# Initialize Supabase client (reused across all routes)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
