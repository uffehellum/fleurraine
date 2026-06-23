CREATE TABLE season_selections (
  photo_id    UUID PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
