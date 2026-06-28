-- Migration 011: Add numbered bouquets support with Apple Pay integration
-- This enables the admin to photograph bouquets with 4-digit number stickers,
-- which are automatically detected by AI and made available for purchase via Apple Pay.

-- Extend photos table for numbered bouquets
ALTER TABLE photos ADD COLUMN bouquet_number INTEGER;
ALTER TABLE photos ADD COLUMN price_cents INTEGER;
ALTER TABLE photos ADD COLUMN detected_flowers TEXT[];  -- Array of flower names detected by AI
ALTER TABLE photos ADD COLUMN purchased_by UUID REFERENCES users(id);
ALTER TABLE photos ADD COLUMN sold_at TIMESTAMPTZ;

-- Unique constraint: only one active photo per bouquet number
-- This allows photo replacement when admin uploads a better shot of the same bouquet
CREATE UNIQUE INDEX unique_active_bouquet_number 
  ON photos(bouquet_number) 
  WHERE bouquet_number IS NOT NULL 
    AND deleted_at IS NULL 
    AND purchased_by IS NULL;

CREATE INDEX ON photos(bouquet_number) WHERE bouquet_number IS NOT NULL;
CREATE INDEX ON photos(category, bouquet_number) WHERE category = 'bouquet';

-- Payment tracking table for Stripe/Apple Pay transactions
CREATE TABLE bouquet_purchases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id              UUID NOT NULL REFERENCES photos(id),
  user_id               UUID NOT NULL REFERENCES users(id),
  bouquet_number        INTEGER NOT NULL,
  stripe_payment_intent TEXT NOT NULL UNIQUE,
  amount_cents          INTEGER NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'succeeded' | 'failed' | 'canceled'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  customer_email        TEXT,
  customer_name         TEXT,
  stripe_metadata       JSONB
);

CREATE INDEX ON bouquet_purchases(stripe_payment_intent);
CREATE INDEX ON bouquet_purchases(user_id, created_at DESC);
CREATE INDEX ON bouquet_purchases(status);
CREATE INDEX ON bouquet_purchases(bouquet_number);

-- Apple ID authentication support
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id TEXT UNIQUE;
CREATE INDEX ON users(apple_id) WHERE apple_id IS NOT NULL;
