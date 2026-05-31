CREATE TABLE billing_subscription (
  restaurant_id uuid PRIMARY KEY REFERENCES restaurant(id) ON DELETE CASCADE,
  plan_key text NOT NULL DEFAULT 'growth',
  status text NOT NULL DEFAULT 'trialing',
  mercadopago_payer_id text,
  mercadopago_preapproval_id text,
  mercadopago_plan_id text,
  mercadopago_payer_email text,
  mercadopago_init_point text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_payment_at timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  monthly_reservation_limit int NOT NULL DEFAULT 1200,
  mesa_limit int NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_plan_chk CHECK (plan_key IN ('starter', 'growth', 'scale')),
  CONSTRAINT billing_status_chk CHECK (status IN ('trialing', 'pending', 'authorized', 'active', 'paused', 'canceled', 'cancelled', 'inactive', 'finished', 'expired'))
);

CREATE UNIQUE INDEX billing_subscription_preapproval_key
  ON billing_subscription(mercadopago_preapproval_id)
  WHERE mercadopago_preapproval_id IS NOT NULL;

CREATE INDEX idx_billing_subscription_status
  ON billing_subscription(status, plan_key);

CREATE TABLE mercadopago_webhook_event (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
