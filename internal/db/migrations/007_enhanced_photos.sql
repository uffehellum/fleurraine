-- Add additional metadata fields to photos table for comprehensive tracking

-- Add EXIF metadata as JSONB for full camera/device information
ALTER TABLE photos ADD COLUMN exif_metadata JSONB;

-- Add camera model extracted from EXIF
ALTER TABLE photos ADD COLUMN camera_model TEXT;

-- Add AI analysis results as JSONB
ALTER TABLE photos ADD COLUMN ai_analysis JSONB;

-- Add review-specific fields for consumer photo reviews
ALTER TABLE photos ADD COLUMN is_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE photos ADD COLUMN review_verified BOOLEAN;
ALTER TABLE photos ADD COLUMN review_approved BOOLEAN;
ALTER TABLE photos ADD COLUMN reviewed_by UUID REFERENCES users(id);
ALTER TABLE photos ADD COLUMN reviewed_at TIMESTAMPTZ;

-- Add Wikipedia link for flower catalog entries
ALTER TABLE photos ADD COLUMN wikipedia_url TEXT;

-- Add sharing/permalink support
ALTER TABLE photos ADD COLUMN share_token TEXT UNIQUE;

-- Add index for share tokens
CREATE INDEX ON photos(share_token) WHERE share_token IS NOT NULL;

-- Add index for reviews
CREATE INDEX ON photos(is_review, review_approved) WHERE is_review = true;

-- Add index for AI analysis (GIN index for JSONB queries)
CREATE INDEX ON photos USING GIN(ai_analysis) WHERE ai_analysis IS NOT NULL;
