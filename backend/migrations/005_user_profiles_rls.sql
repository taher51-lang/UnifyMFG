-- ============================================================================
-- Migration 005: Row Level Security for user_profiles
-- CRITICAL: Prevents users from reading other profiles or self-promoting to admin
-- ============================================================================

-- 1. Enable Row Level Security on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Users can SELECT only their own profile
--    This allows the frontend (using anon key + JWT) to look up their own role
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Policy: Only service_role can INSERT profiles (backend/admin operations)
--    This prevents users from creating fake admin profiles
CREATE POLICY "Service role can insert profiles"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 4. Policy: Only service_role can UPDATE profiles (backend/admin operations)
--    This prevents users from self-promoting to admin
CREATE POLICY "Service role can update profiles"
  ON user_profiles
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Policy: Only service_role can DELETE profiles
CREATE POLICY "Service role can delete profiles"
  ON user_profiles
  FOR DELETE
  USING (auth.role() = 'service_role');
