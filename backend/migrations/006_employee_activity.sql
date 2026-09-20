-- ============================================================================
-- Migration 006: Employee Activity Tracking
-- Creates employee_activity_logs table for audit trail & activity monitoring
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Create table
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    employee_name TEXT NOT NULL,
    employee_email TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'LOGIN', 'LOGOUT', 'AUDIO_REPORT', 'PRICE_SEARCH', etc.
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Performance indexes
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_emp_activity_user_id ON employee_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emp_activity_created_at ON employee_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emp_activity_event_type ON employee_activity_logs(event_type);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Row Level Security (RLS)
-- Note: If your backend uses the service_role key, it automatically bypasses RLS.
-- If your backend uses the anon key, disable RLS or allow anon insert/select.
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE employee_activity_logs DISABLE ROW LEVEL SECURITY;

-- If you prefer to keep RLS enabled instead, uncomment below:
-- ALTER TABLE employee_activity_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow backend activity logs insert"
--     ON employee_activity_logs FOR INSERT
--     TO public, anon, authenticated, service_role
--     WITH CHECK (true);
-- CREATE POLICY "Allow backend activity logs select"
--     ON employee_activity_logs FOR SELECT
--     TO public, anon, authenticated, service_role
--     USING (true);
