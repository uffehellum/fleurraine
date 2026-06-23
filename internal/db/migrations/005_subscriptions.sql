CREATE TABLE subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id),
  description    TEXT NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT true,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX ON subscriptions(user_id) WHERE active = true;
