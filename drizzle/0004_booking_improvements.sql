CREATE TABLE IF NOT EXISTS waitlist_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  service_id uuid REFERENCES service(id) ON DELETE SET NULL,
  zone_id uuid REFERENCES zone(id) ON DELETE SET NULL,
  date date NOT NULL,
  party_size int NOT NULL,
  preferred_time time,
  status text NOT NULL DEFAULT 'open',
  special_requests text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (party_size > 0),
  CHECK (status IN ('open', 'notified', 'booked', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date
  ON waitlist_entry(restaurant_id, date, status);

CREATE INDEX IF NOT EXISTS idx_waitlist_customer
  ON waitlist_entry(customer_id, created_at DESC);
