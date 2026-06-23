CREATE TABLE analytics_events (
  id               BIGSERIAL PRIMARY KEY,
  anon_session_id  TEXT NOT NULL,
  is_authenticated BOOLEAN NOT NULL,
  page             TEXT NOT NULL,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON analytics_events(recorded_at DESC);
