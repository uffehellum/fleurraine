-- Migration 012: Add support for multiple flower beds and multiple flower names per photo.

-- Add array columns
ALTER TABLE photos ADD COLUMN IF NOT EXISTS row_numbers INTEGER[];
ALTER TABLE photos ADD COLUMN IF NOT EXISTS flower_names TEXT[];

-- Migrate existing row_number values to row_numbers array
UPDATE photos 
SET row_numbers = ARRAY[row_number]::INTEGER[] 
WHERE row_number IS NOT NULL AND row_numbers IS NULL;

-- Migrate existing flower_name and detected_flowers values to flower_names array
UPDATE photos 
SET flower_names = ARRAY[flower_name]::TEXT[] 
WHERE flower_name IS NOT NULL AND flower_name != '' AND flower_names IS NULL;

UPDATE photos 
SET flower_names = detected_flowers 
WHERE (flower_names IS NULL OR cardinality(flower_names) = 0) AND detected_flowers IS NOT NULL;

-- Index array columns for high-performance grouping queries
CREATE INDEX IF NOT EXISTS idx_photos_row_numbers ON photos USING GIN(row_numbers) WHERE row_numbers IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photos_flower_names ON photos USING GIN(flower_names) WHERE flower_names IS NOT NULL;
