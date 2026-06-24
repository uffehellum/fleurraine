# Fleurraine Image Management System

## Overview

The Fleurraine image management system provides a comprehensive solution for uploading, storing, analyzing, and displaying photos of flowers, flower stands, bouquets, and garden rows. The system includes:

- **Secure upload** with authentication and authorization
- **AI-powered analysis** using Claude Vision API
- **Multi-size storage** (thumbnail, mobile-optimized, full resolution)
- **Metadata tracking** (EXIF, camera info, GPS, timestamps)
- **Automatic categorization** and duplicate detection
- **Consumer review system** with AI verification
- **Sharing capabilities** with permanent links

## Architecture

### Backend Components

#### 1. Photo Service (`internal/photos/photos.go`)
- **Upload workflow**: Validates images, extracts EXIF, generates renditions, computes perceptual hash, analyzes with AI, stores in Tigris
- **Retrieval**: Get photos by ID, share token, category, or status
- **Management**: Publish photos, approve reviews

#### 2. AI Service (`internal/ai/ai.go`)
- **Image analysis**: Categorizes images, detects subjects, describes content
- **Review verification**: Ensures consumer review photos actually contain flowers
- Uses Anthropic Claude Vision API (claude-3-5-sonnet-20241022)

#### 3. Storage (`internal/storage/storage.go`)
- S3-compatible Tigris object storage
- Stores three renditions per image:
  - **Thumbnail**: ≤150px wide, JPEG quality 80
  - **Mobile**: ≤1200px wide, JPEG quality 85
  - **Original**: Full resolution, original format

#### 4. Database Schema (`internal/db/migrations/`)
- **002_photos.sql**: Base photo table with categories, EXIF, AI suggestions
- **007_enhanced_photos.sql**: Enhanced metadata (JSONB EXIF, AI analysis, reviews, sharing)

### Frontend Components

#### 1. ImageUpload Component (`web/src/components/ImageUpload.tsx`)
- File selection with preview
- Category selection (for admins)
- Flower catalog fields (name, Wikipedia URL, season)
- Description and metadata input
- Progress indication and error handling

#### 2. PhotoDisplay Component (`web/src/components/PhotoDisplay.tsx`)
- Responsive image display with category badges
- Click to view full resolution
- Share functionality (native share API + clipboard fallback)
- Metadata viewer (EXIF, camera, AI analysis)
- Subject tags from AI analysis

#### 3. Home Page (`web/src/pages/Home.tsx`)
- Displays latest flower stand photo
- Auto-updates when new stand photos are uploaded
- Loading states and error handling

#### 4. Admin Photo Management (`web/src/pages/AdminPhotos.tsx`)
- Upload interface with full options
- Filter by status (all, pending, published, reviews)
- Publish pending photos
- Approve/reject consumer reviews
- View AI confidence scores

## API Endpoints

### Public Endpoints
- `GET /api/photos/latest-stand` - Get the most recent published flower stand photo
- `GET /api/photos/share/{token}` - Get a photo by its share token
- `GET /api/photos` - List photos (query params: category, status, limit)
- `GET /api/photos/{id}` - Get a photo by ID (published photos are public)
- `GET /api/storage/*` - Proxy to serve images from Tigris storage

### Authenticated Endpoints
- `POST /api/photos/upload` - Upload a photo (admins: any category, users: reviews only)

### Admin-Only Endpoints
- `POST /api/photos/{id}/publish` - Publish a pending photo
- `POST /api/photos/{id}/approve-review` - Approve or reject a consumer review

## Security Features

### 1. Upload Authorization
- All uploads require authentication
- Non-admin users can only upload reviews
- Admins can upload any category

### 2. AI Verification for Reviews
- Consumer review photos are verified to contain flowers
- Rejected if AI determines no flowers are present
- Prevents spam and irrelevant submissions

### 3. Duplicate Detection
- Perceptual hashing (dHash) computed for each image
- Hamming distance ≤ 8 triggers duplicate rejection
- Prevents accidental re-uploads

### 4. Storage Security
- Storage proxy only serves keys starting with "photos/"
- Prevents access to other storage buckets
- Public access only to published photos

## Workflow Examples

### 1. Lorraine Takes Morning Flower Stand Photo
1. Opens admin panel, clicks "Upload Photo"
2. Selects photo from phone camera
3. AI automatically detects category as "stand"
4. Photo is auto-published (stand photos publish immediately)
5. Home page updates to show the new photo
6. Consumers see fresh flowers available today

### 2. Consumer Submits Review Photo
1. Consumer signs in to app
2. Navigates to review submission
3. Uploads photo of flowers at home
4. AI verifies photo contains flowers
5. Photo enters pending state for admin review
6. Admin approves/rejects in admin panel
7. Approved reviews appear in public gallery

### 3. Building Flower Catalog
1. Admin uploads photo of specific flower type
2. Enters flower name (e.g., "Sunflower")
3. Adds Wikipedia URL for reference
4. Specifies harvest season
5. AI analyzes and tags subjects
6. Photo published to flower catalog
7. Consumers can browse and identify flowers

## Configuration

### Environment Variables
```bash
# Required for image system
TIGRIS_BUCKET=your-bucket-name
TIGRIS_ACCESS_KEY_ID=your-access-key
TIGRIS_SECRET_ACCESS_KEY=your-secret-key
TIGRIS_ENDPOINT_URL=https://fly.storage.tigris.dev

# Required for AI analysis
ANTHROPIC_API_KEY=your-anthropic-api-key

# Database
DATABASE_URL=postgres://...

# Admin access
ADMIN_EMAILS=lorraine@example.com
```

## Image Categories

- **stand**: Flower stand displays with multiple flower types
- **bouquet**: Arranged cut flowers
- **flower_type**: Individual flower species for catalog
- **garden_row**: Flowers growing in organized rows
- **review**: Consumer photos of flowers at home
- **other**: Uncategorized images

## Metadata Tracked

### EXIF Data
- Date/time photo was taken
- GPS coordinates (latitude/longitude)
- Camera model and settings
- Full EXIF metadata as JSON

### AI Analysis
- Suggested category
- Content description
- Confidence score (0.0 to 1.0)
- Detected subjects (flower types, objects)
- Location type (flower_stand, garden, indoor, outdoor)

### Upload Information
- User who uploaded
- Upload timestamp
- Review status (for consumer reviews)
- Publish status and timestamp

## Future Enhancements

### Planned Features
1. **Automatic location detection**: Use GPS to auto-categorize garden rows
2. **Freshness tracking**: Link photos to freshness data (how long flowers last)
3. **Seasonal analytics**: Track which flowers are available when
4. **Consumer engagement**: Allow consumers to favorite and comment on photos
5. **Batch upload**: Upload multiple photos at once
6. **Image editing**: Crop, rotate, adjust brightness before upload
7. **Advanced search**: Search by flower type, color, season, location

### Performance Optimizations
1. **CDN integration**: Serve images through CDN for faster loading
2. **Lazy loading**: Load images as user scrolls
3. **Progressive JPEGs**: Show low-res preview while loading full image
4. **WebP support**: Use modern image formats for better compression

## Troubleshooting

### Upload Fails
- Check TIGRIS_* environment variables are set
- Verify storage bucket exists and is accessible
- Check file size (max 32MB)
- Ensure file is a valid image format

### AI Analysis Fails
- Verify ANTHROPIC_API_KEY is set and valid
- Check API quota/rate limits
- Review API error messages in logs
- Note: Upload continues even if AI fails (graceful degradation)

### Images Don't Display
- Check storage proxy endpoint is working
- Verify storage keys are correct in database
- Check browser console for CORS errors
- Ensure images were successfully uploaded to Tigris

### Duplicate Detection Too Sensitive
- Adjust Hamming distance threshold in `IsDuplicate` function
- Current threshold: ≤ 8 (can be increased for less sensitivity)

## Testing

### Manual Testing Checklist
- [ ] Upload image as admin (various categories)
- [ ] Upload review as regular user
- [ ] Verify AI categorization is accurate
- [ ] Check duplicate detection works
- [ ] Publish pending photo
- [ ] Approve/reject review
- [ ] Share photo via share link
- [ ] View full resolution image
- [ ] Check metadata display
- [ ] Verify home page shows latest stand photo

### Security Testing
- [ ] Non-admin cannot upload non-review photos
- [ ] Unauthenticated users cannot upload
- [ ] Storage proxy blocks non-photo keys
- [ ] Review verification rejects non-flower images
- [ ] Duplicate images are rejected

## Support

For issues or questions about the image system:
1. Check this documentation
2. Review error logs in server output
3. Verify environment variables are set correctly
4. Check Tigris storage dashboard for upload status
5. Review Anthropic API usage for AI analysis issues
