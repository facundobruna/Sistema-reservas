CREATE TABLE IF NOT EXISTS data_privacy_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurant(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customer(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'export',
  status text NOT NULL DEFAULT 'pending',
  email citext,
  phone text,
  requester_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  handled_by uuid REFERENCES staff_user(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_privacy_request_type_chk CHECK (type IN ('export', 'delete')),
  CONSTRAINT data_privacy_request_status_chk CHECK (status IN ('pending', 'completed', 'rejected')),
  CONSTRAINT data_privacy_request_contact_chk CHECK (customer_id IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_data_privacy_request_restaurant
  ON data_privacy_request(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_privacy_request_customer
  ON data_privacy_request(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_privacy_request_status
  ON data_privacy_request(status, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  staff_user_id uuid REFERENCES staff_user(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_log_restaurant
  ON staff_audit_log(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_audit_log_staff
  ON staff_audit_log(staff_user_id, created_at DESC);
