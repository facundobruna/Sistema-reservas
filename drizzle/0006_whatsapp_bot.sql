CREATE TABLE IF NOT EXISTS whatsapp_conversation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customer(id) ON DELETE SET NULL,
  phone text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('active', 'closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversation_restaurant_phone_key
  ON whatsapp_conversation(restaurant_id, phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_customer
  ON whatsapp_conversation(customer_id);

CREATE TABLE IF NOT EXISTS whatsapp_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES whatsapp_conversation(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  direction text NOT NULL,
  meta_message_id text,
  phone text NOT NULL,
  body text,
  message_type text NOT NULL DEFAULT 'text',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (direction IN ('inbound', 'outbound'))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_conversation
  ON whatsapp_message(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_restaurant
  ON whatsapp_message(restaurant_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_message_meta_id_key
  ON whatsapp_message(meta_message_id)
  WHERE meta_message_id IS NOT NULL;
