CREATE TABLE photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category          TEXT NOT NULL,  -- 'stand' | 'bouquet' | 'flower_type' | 'garden_row'
  status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'published'
  storage_key_orig  TEXT NOT NULL,
  storage_key_thumb TEXT NOT NULL,
  storage_key_mobile TEXT NOT NULL,
  exif_taken_at     TIMESTAMPTZ,
  exif_gps_lat      NUMERIC,
  exif_gps_lng      NUMERIC,
  perceptual_hash   TEXT,
  ai_suggestion     TEXT,
  flower_name       TEXT,
  harvest_season    TEXT,
  row_number        SMALLINT,
  description       TEXT,
  freshness_days    SMALLINT,
  uploaded_by       UUID NOT NULL REFERENCES users(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ
);

CREATE INDEX ON photos(category, status, exif_taken_at DESC);
CREATE INDEX ON photos(category, status, flower_name);
CREATE INDEX ON photos(category, status, row_number);
