-- Add photo editing metadata and location detection support

-- Add photo_edits JSONB column for non-destructive editing
-- Stores rotation (0, 90, 180, 270) and crop coordinates
ALTER TABLE photos ADD COLUMN photo_edits JSONB;

-- Add detected_location for smart location display
-- Will store "Camano Flower Garden", "Seattle Flower Garden", or geocoded address
ALTER TABLE photos ADD COLUMN detected_location TEXT;

-- Add index for photo_edits
CREATE INDEX ON photos USING GIN(photo_edits) WHERE photo_edits IS NOT NULL;

-- Add comment explaining photo_edits structure
COMMENT ON COLUMN photos.photo_edits IS 'Non-destructive edit metadata: {"rotation": 0|90|180|270, "crop": {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}}';
