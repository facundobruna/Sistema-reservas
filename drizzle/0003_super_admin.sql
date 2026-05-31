ALTER TABLE restaurant
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

CREATE INDEX IF NOT EXISTS idx_restaurant_suspended
  ON restaurant(suspended_at)
  WHERE suspended_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS super_admin_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CHECK (role IN ('owner', 'support'))
);

CREATE TABLE IF NOT EXISTS restaurant_feature_flag (
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES super_admin_user(id) ON DELETE SET NULL,
  PRIMARY KEY (restaurant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_key
  ON restaurant_feature_flag(key, enabled);

CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid REFERENCES super_admin_user(id) ON DELETE SET NULL,
  action text NOT NULL,
  restaurant_id uuid REFERENCES restaurant(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_restaurant
  ON super_admin_audit_log(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_admin
  ON super_admin_audit_log(super_admin_id, created_at DESC);
