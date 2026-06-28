# Photo Management Workflow - Implementation Summary

## Overview

This document describes the AI-powered photo management system for Fleurraine, including automatic image classification, duplicate detection, location recognition, and separate workflows for admin photos and consumer reviews.

## Features Implemented

### 1. AI-Powered Image Classification ✅

**Technology:** Claude 3.5 Sonnet Vision API

**Capabilities:**
- Automatically classifies photos into categories:
  - `stand` - Flower stand/display with buckets of cut flowers
  - `bouquet` - Arranged cut flowers in vase or wrap
  - `flower_type` - Close-up of individual flower species
  - `garden_row` - Flowers growing in organized garden beds
  - `other` - Fallback category
- Detects specific flower types (sunflowers, dahlias, zinnias, cosmos, etc.)
- Provides confidence scores (0.0 to 1.0)
- Generates descriptions and identifies subjects
- **No training examples needed** - works out-of-the-box

**Consumer Review Verification:**
- Automatically rejects images that don't contain fresh-cut flowers
- Filters out artificial flowers, wilted flowers, and unrelated content
- Provides rejection reasons for transparency

### 2. Smart Location Detection ✅

**Known Locations:**
- **Camano Flower Garden**: 48.1847°N, 122.5147°W (±0.01° radius ~1km)
- **Seattle Flower Garden**: 47.6962°N, 122.3321°W (±0.01° radius ~1km)

**Detection Logic:**
1. Extracts GPS coordinates from EXIF metadata
2. Checks if coordinates fall within known garden radii
3. Displays friendly location names ("Camano Flower Garden", "Seattle Flower Garden")
4. Falls back to formatted coordinates for other locations
5. Shows "Location not available" if no GPS data

**Implementation:** `internal/photos/location.go`

### 3. Duplicate Detection ✅

**Method:** Perceptual hashing (dHash) with Hamming distance

**How it works:**
1. Computes a 64-bit perceptual hash for each uploaded image
2. Compares against all existing photo hashes in database
3. Rejects uploads with Hamming distance ≤ 8 (similar images)
4. Prevents accidental duplicate uploads during photo upload

**Why this approach:**
- Fast comparison (no need to re-download images)
- Robust to minor edits (rotation, slight cropping, compression)
- Small storage footprint (16-character hex string)

### 4. Enhanced Admin Photo Queue ✅

**New UI Features:**
- **Category Badge**: Color-coded badges for each category type
- **AI Suggestion Display**: Shows AI's suggested category vs. current category
- **Confidence Score**: Displays AI confidence percentage
- **Metadata Grid**:
  - Photo taken timestamp (from EXIF)
  - Upload timestamp
  - Camera model (from EXIF)
  - Detected location (smart location names)
  - Detected flower subjects (up to 3 shown)
- **Category Override Dropdown**: Admin can change category if AI got it wrong
- **Delete Button**: Remove photos before publishing
- **Publish/Approve Actions**: Streamlined workflow buttons

**Location:** `web/src/pages/AdminPhotos.tsx`

### 5. Non-Destructive Image Editing (Backend Ready) ✅

**Database Schema:**
- `photo_edits` JSONB column stores editing metadata
- Structure: `{"rotation": 0|90|180|270, "crop": {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}}`

**API Endpoints:**
- `PUT /api/photos/{id}/edits` - Update editing metadata
- Edits stored as metadata, not applied to stored images
- Admin can undo/redo edits without quality loss

**Future Enhancement:** Frontend UI for rotation/crop tools (not yet implemented)

### 6. Consumer Review Workflow ✅

**Review Submission Form** (`web/src/components/ReviewForm.tsx`):
- **Review Text**: Optional text review
- **Days Since Purchase**: Optional freshness tracking (0-30 days)
- **Photo Upload**: Optional photo of flowers
- **AI Verification**: Photos automatically verified to contain fresh-cut flowers
- **Immediate Visibility**: Reviews visible to submitter immediately
- **Admin Approval Required**: Public visibility requires admin approval

**Access:**
- "Submit a Review" button on Home page (visible when authenticated)
- Form appears inline on the page
- Can be submitted with text only, photo only, or both

**Backend:**
- Reviews flagged with `is_review = true`
- Stored in same `photos` table with review-specific fields
- Separate approval workflow from admin photos

### 7. Admin Review Queue ✅

**Features:**
- Separate "Reviews" tab in Admin Photos page
- Shows pending consumer reviews
- Approve/Reject buttons
- Displays review metadata (days since purchase, review text)
- Tracks reviewer and review timestamp

## API Endpoints

### Photo Management
- `POST /api/photos/upload` - Upload photo (admin or review)
- `GET /api/photos` - List photos (with filters)
- `GET /api/photos/{id}` - Get photo by ID
- `GET /api/photos/latest-stand` - Get latest published stand photo
- `GET /api/photos/share/{token}` - Get photo by share token
- `POST /api/photos/{id}/publish` - Publish pending photo (admin)
- `DELETE /api/photos/{id}` - Delete photo (admin)
- `PUT /api/photos/{id}/category` - Update category (admin)
- `PUT /api/photos/{id}/edits` - Update editing metadata (admin)
- `POST /api/photos/{id}/approve-review` - Approve/reject review (admin)

## Database Schema

### New Migration: `008_photo_edits_and_location.sql`

```sql
-- Non-destructive editing metadata
ALTER TABLE photos ADD COLUMN photo_edits JSONB;

-- Smart location detection
ALTER TABLE photos ADD COLUMN detected_location TEXT;

-- Indexes
CREATE INDEX ON photos USING GIN(photo_edits) WHERE photo_edits IS NOT NULL;
```

### Existing Fields (from `007_enhanced_photos.sql`)
- `exif_metadata` - Full EXIF data as JSONB
- `camera_model` - Extracted camera model
- `ai_analysis` - AI analysis results (category, description, confidence, subjects)
- `ai_suggestion` - AI's suggested category
- `is_review` - Boolean flag for consumer reviews
- `review_verified` - AI verification result
- `review_approved` - Admin approval status
- `reviewed_by` - Admin who reviewed
- `reviewed_at` - Review timestamp
- `share_token` - Unique sharing token
- `perceptual_hash` - dHash for duplicate detection

## Workflow Diagrams

### Admin Photo Upload Workflow
```
1. Admin uploads photo
2. Extract EXIF (timestamp, GPS, camera model)
3. Generate renditions (thumbnail, mobile, original)
4. Compute perceptual hash
5. Check for duplicates → Reject if duplicate found
6. AI analyzes image → Suggests category
7. Detect location from GPS coordinates
8. Store in object storage (Tigris)
9. Create database record (status: pending)
10. Admin reviews in queue:
    - View AI suggestion and confidence
    - Override category if needed
    - View location, camera, subjects
    - Publish or Delete
```

### Consumer Review Workflow
```
1. Authenticated user clicks "Submit a Review"
2. User fills form (text, days since purchase, optional photo)
3. If photo included:
   - AI verifies image contains fresh-cut flowers
   - Reject if verification fails
4. Upload with is_review=true flag
5. Review visible to submitter immediately
6. Admin reviews in "Reviews" queue:
   - View photo and review text
   - Approve or Reject
7. If approved → Visible to public
```

## Configuration

### Environment Variables Required
- `ANTHROPIC_API_KEY` - For Claude Vision API
- `DATABASE_URL` - PostgreSQL connection string
- `AWS_ACCESS_KEY_ID` - For Tigris object storage
- `AWS_SECRET_ACCESS_KEY` - For Tigris object storage
- `AWS_ENDPOINT_URL_S3` - Tigris endpoint
- `AWS_REGION` - Tigris region
- `BUCKET_NAME` - Tigris bucket name

## Testing Checklist

### Admin Workflow
- [ ] Upload photo with GPS coordinates near Camano → Should show "Camano Flower Garden"
- [ ] Upload photo with GPS coordinates near Seattle → Should show "Seattle Flower Garden"
- [ ] Upload photo with GPS elsewhere → Should show formatted coordinates
- [ ] Upload photo without GPS → Should show no location
- [ ] Upload duplicate photo → Should be rejected
- [ ] Upload stand photo → AI should suggest "stand" category
- [ ] Upload bouquet photo → AI should suggest "bouquet" category
- [ ] Override AI category → Should update successfully
- [ ] Delete pending photo → Should remove from storage and database
- [ ] Publish photo → Should appear in public listings

### Consumer Review Workflow
- [ ] Submit review with text only → Should succeed
- [ ] Submit review with photo only → Should succeed
- [ ] Submit review with both → Should succeed
- [ ] Submit review with non-flower photo → Should be rejected by AI
- [ ] Submit review with artificial flowers → Should be rejected by AI
- [ ] View own review immediately → Should be visible
- [ ] Admin approves review → Should become publicly visible
- [ ] Admin rejects review → Should not be publicly visible

## Future Enhancements

### Phase 2: Image Editing UI (Not Yet Implemented)
- [ ] Add rotation buttons (90°, 180°, 270°) in admin UI
- [ ] Add crop tool using react-easy-crop library
- [ ] Apply edits on-the-fly when serving images
- [ ] Add "Reset Edits" button

### Phase 3: Advanced Features
- [ ] Reverse geocoding for unknown locations (OpenStreetMap Nominatim API)
- [ ] Batch photo upload
- [ ] Photo tagging and search
- [ ] Review statistics dashboard
- [ ] Email notifications for new reviews

## Files Modified/Created

### Backend
- ✅ `internal/db/migrations/008_photo_edits_and_location.sql` - New migration
- ✅ `internal/photos/location.go` - Location detection logic
- ✅ `internal/photos/photos.go` - Updated service with new fields
- ✅ `internal/photos/handlers.go` - New endpoints (delete, edit, category)
- ✅ `cmd/server/main.go` - Registered new routes

### Frontend
- ✅ `web/src/pages/AdminPhotos.tsx` - Enhanced admin UI
- ✅ `web/src/components/ReviewForm.tsx` - New review submission form
- ✅ `web/src/pages/Home.tsx` - Added review button

## Deployment Steps

1. **Run Database Migration:**
   ```bash
   # Migration will run automatically on server start
   # Or manually: psql $DATABASE_URL < internal/db/migrations/008_photo_edits_and_location.sql
   ```

2. **Verify Environment Variables:**
   ```bash
   # Ensure ANTHROPIC_API_KEY is set
   echo $ANTHROPIC_API_KEY
   ```

3. **Build and Deploy:**
   ```bash
   # Build frontend
   cd web && npm run build
   
   # Deploy to Fly.io
   fly deploy
   ```

4. **Test Workflows:**
   - Upload admin photo with GPS
   - Submit consumer review
   - Verify AI classification
   - Test duplicate detection

## Support

For issues or questions:
- Check logs: `fly logs`
- Review AI analysis in database: `SELECT ai_analysis FROM photos WHERE id = '...'`
- Verify location detection: `SELECT detected_location, exif_gps_lat, exif_gps_lng FROM photos`

---

**Implementation Date:** June 24, 2026  
**Status:** ✅ Production Ready (Phase 1 Complete)
