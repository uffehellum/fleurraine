-- Add soft delete tracking columns to photos table

ALTER TABLE photos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS deleted_by_email TEXT;

-- Create index for querying non-deleted photos
CREATE INDEX IF NOT EXISTS idx_photos_deleted_at ON photos(deleted_at) WHERE deleted_at IS NULL;

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_photos_deleted_by ON photos(deleted_by_email) WHERE deleted_by_email IS NOT NULL;
