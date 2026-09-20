-- ============================================================================
-- Migration 007: Access Control & System Settings
-- Stores business hours, employee login restrictions, and system flags
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID
);

-- Seed default employee access control settings
INSERT INTO system_settings (key, value, description)
VALUES (
    'employee_access_restriction',
    '{
        "enabled": true,
        "immediate_lockdown": false,
        "start_time": "09:00",
        "end_time": "19:00",
        "allowed_days": [1, 2, 3, 4, 5, 6],
        "timezone": "Asia/Kolkata",
        "custom_message": "Employee logins are restricted outside normal business hours (9:00 AM – 7:00 PM, Mon–Sat). Please contact administration if you require access."
    }'::jsonb,
    'Controls employee login hours and immediate activity lockdown'
)
ON CONFLICT (key) DO NOTHING;

-- RLS: Disable RLS for backend management
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
