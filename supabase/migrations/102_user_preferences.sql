-- Per-user preferences stored as JSONB on profiles.
-- Currently supports: { "uniform_background": true/false }

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Ensure users can update their own preferences (RLS already allows own profile update).
-- No additional policy needed — users_update_own_profile covers UPDATE on profiles.
