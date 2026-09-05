-- Uruchomić jako ontime_migrator PRZED pg_restore danych public
BEGIN;

CREATE TEMP TABLE auth_users_import (
  id UUID,
  email TEXT,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  raw_user_meta_data JSONB
);

\copy auth_users_import FROM 'D:/OnTime/cutover/auth_users_export.csv' CSV HEADER

INSERT INTO app_users (id, email, password_hash, email_confirmed_at, created_at)
SELECT id, lower(trim(email)), encrypted_password, email_confirmed_at, created_at
FROM auth_users_import
WHERE encrypted_password IS NOT NULL AND trim(email) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_user_invites (user_id, sales_person_id)
SELECT id,
  NULLIF(trim(raw_user_meta_data->>'sales_person_id'), '')::uuid
FROM auth_users_import
WHERE raw_user_meta_data->>'sales_person_id' IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET sales_person_id = EXCLUDED.sales_person_id;

COMMIT;

SELECT COUNT(*) AS app_users FROM app_users;
SELECT COUNT(*) AS orphan_profiles
FROM profiles p LEFT JOIN app_users u ON u.id = p.id WHERE u.id IS NULL;
