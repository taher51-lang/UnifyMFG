-- ============================================================================
-- Migration 004: Employee Panel
-- Adds user_profiles (role-based auth) and audio_reports (voice memos)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- USER PROFILES — role-based access (admin vs employee)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- AUDIO REPORTS — voice memos from employees about warehouse stock
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audio_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    duration_seconds INTEGER,
    notes TEXT DEFAULT '',
    reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
