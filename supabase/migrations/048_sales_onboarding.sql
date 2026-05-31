-- Jednorazowy onboarding handlowca po pierwszym pełnym logowaniu.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sales_onboarding_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN profiles.sales_onboarding_completed_at IS
  'Kiedy handlowiec ukończył wizard wprowadzający w aplikacji.';

-- Istniejący użytkownicy nie przechodzą wizarda ponownie.
UPDATE profiles
SET sales_onboarding_completed_at = now()
WHERE role IN ('sales', 'sales_manager')
  AND sales_onboarding_completed_at IS NULL;
