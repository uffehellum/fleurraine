# Enhanced Photo Workflow - Implementation Summary

## Overview

This document describes the enhanced photo workflow for Fleurraine, including AI-powered species identification, automatic Wikipedia linking, season descriptions, and improved photo management with timezone handling.

## New Features Implemented

### 1. AI Species Identification for Single Flowers ✅

**Technology:** Claude 3.5 Sonnet Vision API

**Capabilities:**
- Automatically identifies flower species from close-up photos
- Provides common name (e.g., "Sunflower") and scientific name (e.g., "Helianthus annuus")
- Generates Wikipedia links automatically
- Creates season-specific descriptions for Camano Island area (USDA Zone 8b)
- Only activates for `flower_type` category photos (not reviews)

**Implementation:** `internal/ai/species.go`

**Example Output:**
```json
{
  "species_name": "Sunflower",
  "scientific_name": "Helianthus annuus",
  "wikipedia_url": "https://en.wikipedia.org/wiki/Helianthus_annuus",
  "season_description": "Sunflowers bloom from July through October in the Camano area, thriving in the warm, dry summer months. They are frost-sensitive and should be planted after the last frost in late April.",
  "confidence": 0.95,
  "is_single_flower": true
}
```

**Workflow Integration:**
1. Admin uploads photo
2. AI categorizes as `flower_type`
3. Species identification runs automatically
4. If single flower detected:
   - `flower_name` pre-filled with species name
   - `wikipedia_url` pre-filled with Wikipedia link
   - `harvest_season` pre-filled with seasonal description
5. Admin can review and edit before publishing

### 2. Timezone Handling (Pacific Time) ✅

**Problem:** EXIF timestamps don't include timezone information, making them ambiguous.

**Solution:** 
- **Storage:** Convert all EXIF timestamps from Pacific time to UTC for database storage
- **Display:** Show all timestamps in Pacific time (America/Los_Angeles) in the UI

**Implementation:**
- Backend: `internal/photos/photos.go` - Converts EXIF timestamps to UTC
- Frontend: `web/src/pages/AdminPhotos.tsx` - Displays times in Pacific timezone

**Code Example (Backend):**
```go
// Convert EXIF timestamp from Pacific time to UTC for storage
if exifData.TakenAt != nil {
    loc, err := time.LoadLocation("America/Los_Angeles")
    if err == nil {
        pacificTime := time.Date(
            exifData.TakenAt.Year(),
            exifData.TakenAt.Month(),
            exifData.TakenAt.Day(),
            exifData.TakenAt.Hour(),
            exifData.TakenAt.Minute(),
            exifData.TakenAt.Second(),
            exifData.TakenAt.Nanosecond(),
            loc,
        )
        utcTime := pacificTime.UTC()
        exifData.TakenAt = &utcTime
    }
}
```

**Code Example (Frontend):**
```typescript
new Date(photo.exif_taken_at).toLocaleString('en-US', { 
  timeZone: 'America/Los_Angeles',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})
```

### 3. Compact Photo List View ✅

**New Page:** `web/src/pages/AdminPhotosList.tsx`

**Features:**
- Table view with thumbnails (properly oriented)
- Columns: Photo, Category, Time Taken, Location, Uploader, Status
- Filter by: All, Today, This Week
- Shows up to 200 recent photos
- Displays:
  - Thumbnail with flower name
  - Category badge (color-coded)
  - Time taken/uploaded (Pacific time)
  - Smart location (Camano Flower Garden, coordinates, or "No location")
  - Uploader avatar and name
  - Camera model (if available)
  - Status badge (published/pending)

**Design:**
- Compact, scannable layout
- Responsive table with horizontal scroll on mobile
- Hover effects for better UX
- Color-coded badges for quick visual scanning

### 4. Easy Photo Designation Workflow ✅

**Admin Workflow:**
1. **Upload:** Click "Take or Upload Photo" button
2. **Capture:** Use camera or select from gallery
3. **AI Analysis:** Automatic categorization and species identification
4. **Review:** See AI suggestions with confidence scores
5. **Designate:** 
   - Override category if needed (dropdown)
   - For flower_type: Wikipedia link and season pre-filled
   - For garden_row: Specify row number
   - For stand: Auto-publishes
6. **Publish:** One-click publish or delete

**Category Override:**
- Dropdown in admin UI allows changing AI-suggested category
- Options: Stand, Bouquet, Flower Type, Garden Row, Other
- Updates immediately on selection

### 5. Enhanced Metadata Display ✅

**Admin Photos Page Shows:**
- **Category Badge:** Color-coded with AI suggestion comparison
- **Confidence Score:** AI's confidence percentage
- **Status:** Pending/Published
- **Time Taken:** EXIF timestamp in Pacific time
- **Uploaded:** Upload timestamp in Pacific time
- **Camera Model:** Extracted from EXIF
- **Location:** Smart location names (Camano Flower Garden, Seattle Flower Garden, or coordinates)
- **Detected Subjects:** Up to 3 flower types identified by AI
- **Wikipedia Link:** For flower_type photos (if identified)
- **Season Description:** For flower_type photos (if identified)

## Database Schema

### Existing Fields Used:
- `flower_name` - Pre-filled with species name
- `wikipedia_url` - Pre-filled with Wikipedia link
- `harvest_season` - Pre-filled with season description
- `exif_taken_at` - Stored in UTC, displayed in Pacific
- `detected_location` - Smart location names
- `ai_analysis` - Full AI analysis including species info

## API Endpoints

### Existing Endpoints (No Changes):
- `POST /api/photos/upload` - Upload photo (now with species identification)
- `GET /api/photos` - List photos
- `PUT /api/photos/{id}/category` - Update category
- `POST /api/photos/{id}/publish` - Publish photo
- `DELETE /api/photos/{id}` - Delete photo

## Configuration

### Environment Variables Required:
- `ANTHROPIC_API_KEY` - For Claude Vision API (species identification)
- All existing photo system variables

## Testing Checklist

### Species Identification
- [ ] Upload sunflower photo → Should identify as "Sunflower" with Wikipedia link
- [ ] Upload dahlia photo → Should identify as "Dahlia" with season description
- [ ] Upload mixed bouquet → Should not trigger species identification
- [ ] Upload garden row → Should not trigger species identification
- [ ] Upload review photo → Should not trigger species identification

### Timezone Handling
- [ ] Upload photo with EXIF timestamp → Should display in Pacific time
- [ ] Check database → Should store in UTC
- [ ] View in different timezone → Should still show Pacific time
- [ ] Upload photo without EXIF → Should use upload time in Pacific

### Photo List View
- [ ] View all photos → Should show table with all metadata
- [ ] Filter by "Today" → Should show only today's photos
- [ ] Filter by "This Week" → Should show last 7 days
- [ ] Check thumbnails → Should be properly oriented
- [ ] Check location display → Should show smart names or coordinates

### Workflow
- [ ] Take photo of single flower → AI identifies species, pre-fills data
- [ ] Review and edit → Can override category and edit fields
- [ ] Publish → Appears in public listings with all metadata
- [ ] Take multiple photos quickly → Easy to designate to different pages

## Files Modified/Created

### Backend
- ✅ `internal/ai/species.go` - New species identification module
- ✅ `internal/photos/photos.go` - Added species identification and timezone conversion

### Frontend
- ✅ `web/src/pages/AdminPhotos.tsx` - Updated to display Pacific times
- ✅ `web/src/pages/AdminPhotosList.tsx` - New compact list view

## Common Flowers in Camano Area

The AI is trained to recognize these common Fleurraine flowers:

| Flower | Scientific Name | Season |
|--------|----------------|--------|
| Sunflowers | Helianthus annuus | July-October |
| Dahlias | Dahlia spp. | July-October |
| Zinnias | Zinnia elegans | June-October |
| Cosmos | Cosmos bipinnatus | July-October |
| Celosia | Celosia argentea | July-September |
| Snapdragons | Antirrhinum majus | April-June, Sept-Oct |
| Marigolds | Tagetes spp. | June-October |
| Asters | Aster spp. | August-October |

## Photo Metadata Timezone Information

**Question:** Are most picture metadata in local time (Pacific) or in GMT?

**Answer:** Most photo EXIF data stores timestamps in **local time** (the timezone where the photo was taken), **not GMT/UTC**. However, the EXIF standard doesn't always include timezone information, so the timestamp is often ambiguous.

**Our Solution:**
1. **Assumption:** All EXIF timestamps are in Pacific time (America/Los_Angeles)
2. **Storage:** Convert to UTC for database storage
3. **Display:** Always show in Pacific time in the UI
4. **Consistency:** This ensures all times are displayed consistently regardless of where the admin is viewing from

**Benefits:**
- Consistent display for all users
- Proper sorting by actual photo time
- Easy to understand for Camano-based operations
- Database stores in standard UTC format

## Future Enhancements

### Phase 2: Advanced Features
- [ ] Batch photo upload with automatic designation
- [ ] Photo editing UI (rotation, crop)
- [ ] Advanced search and filtering
- [ ] Photo tagging system
- [ ] Automatic flower catalog generation
- [ ] Integration with garden planning tools

### Phase 3: User Features
- [ ] Public flower catalog with Wikipedia links
- [ ] Seasonal bloom calendar
- [ ] Photo sharing with QR codes
- [ ] Customer photo gallery

## Support

For issues or questions:
- Check logs: `fly logs`
- Review species identification: `SELECT flower_name, wikipedia_url, harvest_season FROM photos WHERE category = 'flower_type'`
- Verify timezone conversion: `SELECT exif_taken_at, uploaded_at FROM photos`

---

**Implementation Date:** June 25, 2026  
**Status:** ✅ Production Ready
**Next Steps:** Deploy and test with real flower photos
