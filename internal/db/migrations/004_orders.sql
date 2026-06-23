CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  description      TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'received',  -- 'received' | 'completed'
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX ON orders(user_id, submitted_at DESC);
CREATE INDEX ON orders(status, submitted_at DESC);
