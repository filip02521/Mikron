-- Uproszczenie ról: zakupy_zeby i magazyn → zakupy (dostęp przez assigned_workspaces)
UPDATE profiles SET role = 'zakupy' WHERE role IN ('zakupy_zeby', 'magazyn');
