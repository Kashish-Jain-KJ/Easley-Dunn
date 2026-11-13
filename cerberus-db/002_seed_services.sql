-- Seed the supported third-party services (idempotent).

BEGIN;

INSERT INTO services (service_name, service_code, is_active, is_automate)
VALUES
  ('Google Play Console', 'GOOGLE_PLAY_CONSOLE', true, true),
  ('Unity',               'UNITY',               true, false),
  ('Big Query',           'BIG_QUERY',           true, true),
  ('Google Drive',        'GOOGLE_DRIVE',        true, true),
  ('Google Analytics',    'GOOGLE_ANALYTICS',    true, true),
  ('Apple Store Connect', 'APPLE_STORE_CONNECT', true, true),
  ('Assembla',            'ASSEMBLA',            true, false),
  ('Google Cloud',        'GOOGLE_CLOUD',        true, true),
  ('Firebase',            'FIREBASE',            true, true),
  ('Kanboard',            'KANBOARD',            true, true),
  ('Discord',             'DISCORD',             true, true)
ON CONFLICT (service_code) DO NOTHING;

COMMIT;

