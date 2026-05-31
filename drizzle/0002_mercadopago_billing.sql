DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscription' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE billing_subscription RENAME COLUMN stripe_customer_id TO mercadopago_payer_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscription' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE billing_subscription RENAME COLUMN stripe_subscription_id TO mercadopago_preapproval_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscription' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE billing_subscription RENAME COLUMN stripe_price_id TO mercadopago_plan_id;
  END IF;

  IF to_regclass('public.stripe_webhook_event') IS NOT NULL
     AND to_regclass('public.mercadopago_webhook_event') IS NULL THEN
    ALTER TABLE stripe_webhook_event RENAME TO mercadopago_webhook_event;
  END IF;
END $$;

ALTER TABLE billing_subscription
  ADD COLUMN IF NOT EXISTS mercadopago_payer_email text,
  ADD COLUMN IF NOT EXISTS mercadopago_init_point text,
  ADD COLUMN IF NOT EXISTS next_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE billing_subscription
  DROP CONSTRAINT IF EXISTS billing_subscription_status_check,
  DROP CONSTRAINT IF EXISTS billing_status_chk;

ALTER TABLE billing_subscription
  ADD CONSTRAINT billing_status_chk
  CHECK (status IN ('trialing', 'pending', 'authorized', 'active', 'paused', 'canceled', 'cancelled', 'inactive', 'finished', 'expired'));

ALTER TABLE billing_subscription
  DROP COLUMN IF EXISTS cancel_at_period_end;

DROP INDEX IF EXISTS billing_subscription_customer_key;
DROP INDEX IF EXISTS billing_subscription_subscription_key;

CREATE UNIQUE INDEX IF NOT EXISTS billing_subscription_preapproval_key
  ON billing_subscription(mercadopago_preapproval_id)
  WHERE mercadopago_preapproval_id IS NOT NULL;
