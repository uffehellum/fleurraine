// Package photos handles photo upload, EXIF extraction, rendition generation,
// perceptual hashing, AI categorization, and photo CRUD operations.
package photos

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"math/bits"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/corona10/goimagehash"
	"github.com/disintegration/imaging"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rwcarlsen/goexif/exif"

	"github.com/uffehellum/fleurraine/internal/ai"
	"github.com/uffehellum/fleurraine/internal/email"
	"github.com/uffehellum/fleurraine/internal/storage"
)

// ---- Rendition constants (5.2) ----------------------------------------

const (
	// ThumbMaxWidth is the maximum width of the thumbnail rendition in pixels.
	ThumbMaxWidth = 150
	// MobileMaxWidth is the maximum width of the mobile rendition in pixels.
	MobileMaxWidth = 1200
	// ThumbJPEGQuality is the JPEG encoding quality for thumbnails.
	ThumbJPEGQuality = 80
	// MobileJPEGQuality is the JPEG encoding quality for the mobile rendition.
	MobileJPEGQuality = 85
)

// Renditions holds the encoded JPEG bytes for each generated rendition.
type Renditions struct {
	// Thumb is the thumbnail rendition (≤150 px wide), JPEG quality 80.
	Thumb []byte
	// Mobile is the mobile-friendly rendition (≤1200 px wide), JPEG quality 85.
	Mobile []byte
}

// GenerateRenditions decodes src as an image and produces thumbnail and mobile
// renditions. The original image is not modified or re-encoded here; callers
// should store the raw original bytes separately.
func GenerateRenditions(src image.Image) (*Renditions, error) {
	thumb, err := encodeResized(src, ThumbMaxWidth, ThumbJPEGQuality)
	if err != nil {
		return nil, fmt.Errorf("photos: generate thumbnail: %w", err)
	}

	mobile, err := encodeResized(src, MobileMaxWidth, MobileJPEGQuality)
	if err != nil {
		return nil, fmt.Errorf("photos: generate mobile rendition: %w", err)
	}

	return &Renditions{Thumb: thumb, Mobile: mobile}, nil
}

// encodeResized resizes img so that its width is at most maxWidth (preserving
// aspect ratio), then encodes it as JPEG at the given quality. If the image is
// already narrower than maxWidth it is encoded without resizing.
func encodeResized(img image.Image, maxWidth, quality int) ([]byte, error) {
	if img.Bounds().Dx() > maxWidth {
		img = imaging.Resize(img, maxWidth, 0, imaging.Lanczos)
	}

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// ---- EXIF extractor (5.3) -----------------------------------------------

// EXIFData holds the EXIF fields of interest extracted from a photo.
type EXIFData struct {
	// TakenAt is the value of the DateTimeOriginal EXIF tag (UTC not guaranteed
	// by the spec — stored as-is from the EXIF string).
	TakenAt *time.Time
	// GPSLat is the GPS latitude in decimal degrees, nil if not present.
	GPSLat *float64
	// GPSLng is the GPS longitude in decimal degrees, nil if not present.
	GPSLng *float64
}

// ExtractEXIF reads EXIF metadata from raw JPEG or WebP image data.
// Fields that are not present in the EXIF block are left as nil.
// A missing or unreadable EXIF block is not treated as an error.
func ExtractEXIF(data []byte) (*EXIFData, error) {
	result := &EXIFData{}

	x, err := exif.Decode(bytes.NewReader(data))
	if err != nil {
		// No EXIF data or unreadable — not a hard error.
		return result, nil //nolint:nilerr
	}

	// DateTimeOriginal
	if tag, err := x.Get(exif.DateTimeOriginal); err == nil {
		if s, err := tag.StringVal(); err == nil {
			// EXIF datetime format: "2006:01:02 15:04:05"
			if t, err := time.Parse("2006:01:02 15:04:05", s); err == nil {
				result.TakenAt = &t
			}
		}
	}

	// GPS coordinates
	if lat, lng, err := x.LatLong(); err == nil {
		latCopy := lat
		lngCopy := lng
		result.GPSLat = &latCopy
		result.GPSLng = &lngCopy
	}

	return result, nil
}

// ---- Perceptual hasher (5.4) --------------------------------------------

// ComputeDHash computes a dHash (difference hash) of img using the
// github.com/corona10/goimagehash library. The hash is returned as a
// 16-character lowercase hex string.
func ComputeDHash(img image.Image) (string, error) {
	h, err := goimagehash.DifferenceHash(img)
	if err != nil {
		return "", fmt.Errorf("photos: dhash: %w", err)
	}
	return fmt.Sprintf("%016x", h.GetHash()), nil
}

// IsDuplicate queries the photos table for any existing photo whose
// perceptual_hash has a Hamming distance ≤ 8 from the given hash.
// pool is a *pgxpool.Pool; hash is the pre-computed dHash of the new upload.
func IsDuplicate(ctx context.Context, pool *pgxpool.Pool, hash string) (bool, error) {
	// Decode the hex hash to a uint64 for Hamming distance comparison.
	newHash, err := parseHexHash(hash)
	if err != nil {
		return false, fmt.Errorf("photos: IsDuplicate parse hash: %w", err)
	}

	// Fetch all non-null perceptual hashes from the DB, excluding deleted photos.
	// For Lorraine's use case the photo count is small enough that a full scan is fine.
	rows, err := pool.Query(ctx,
		`SELECT perceptual_hash FROM photos WHERE perceptual_hash IS NOT NULL AND deleted_at IS NULL`)
	if err != nil {
		return false, fmt.Errorf("photos: IsDuplicate query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var existing string
		if err := rows.Scan(&existing); err != nil {
			continue
		}
		existingHash, err := parseHexHash(existing)
		if err != nil {
			continue
		}
		if hammingDistance(newHash, existingHash) <= 8 {
			return true, nil
		}
	}
	return false, rows.Err()
}

// parseHexHash parses a 16-character hex string into a uint64.
func parseHexHash(h string) (uint64, error) {
	return strconv.ParseUint(h, 16, 64)
}

// hammingDistance returns the Hamming distance between two uint64 values.
func hammingDistance(a, b uint64) int {
	return bits.OnesCount64(a ^ b)
}

// ---- Key naming (5.5) ---------------------------------------------------

// KeyOriginal returns the Tigris storage key for the original rendition.
//
//	photos/{uuid}/original.{ext}
func KeyOriginal(uuid, ext string) string {
	return fmt.Sprintf("photos/%s/original.%s", uuid, ext)
}

// KeyMobile returns the Tigris storage key for the mobile rendition.
//
//	photos/{uuid}/mobile.jpg
func KeyMobile(uuid string) string {
	return fmt.Sprintf("photos/%s/mobile.jpg", uuid)
}

// KeyThumb returns the Tigris storage key for the thumbnail rendition.
//
//	photos/{uuid}/thumb.jpg
func KeyThumb(uuid string) string {
	return fmt.Sprintf("photos/%s/thumb.jpg", uuid)
}

// ---- Photo service (upload, retrieval, management) ----------------------

// Service provides photo upload, retrieval, and management operations.
type Service struct {
	db      *pgxpool.Pool
	storage *storage.Client
}

// NewService creates a new photo service.
func NewService(db *pgxpool.Pool, storage *storage.Client) *Service {
	return &Service{db: db, storage: storage}
}

// Photo represents a photo record from the database.
type Photo struct {
	ID               string                 `json:"id"`
	Category         string                 `json:"category"`
	Status           string                 `json:"status"`
	StorageKeyOrig   string                 `json:"storage_key_orig"`
	StorageKeyThumb  string                 `json:"storage_key_thumb"`
	StorageKeyMobile string                 `json:"storage_key_mobile"`
	EXIFTakenAt      *time.Time             `json:"exif_taken_at,omitempty"`
	EXIFGPSLat       *float64               `json:"exif_gps_lat,omitempty"`
	EXIFGPSLng       *float64               `json:"exif_gps_lng,omitempty"`
	EXIFMetadata     map[string]interface{} `json:"exif_metadata,omitempty"`
	CameraModel      *string                `json:"camera_model,omitempty"`
	PerceptualHash   *string                `json:"perceptual_hash,omitempty"`
	AISuggestion     *string                `json:"ai_suggestion,omitempty"`
	AIAnalysis       map[string]interface{} `json:"ai_analysis,omitempty"`
	FlowerName       *string                `json:"flower_name,omitempty"`
	HarvestSeason    *string                `json:"harvest_season,omitempty"`
	RowNumber        *int16                 `json:"row_number,omitempty"`
	Description      *string                `json:"description,omitempty"`
	FreshnessDays    *int16                 `json:"freshness_days,omitempty"`
	UploadedBy       string                 `json:"uploaded_by"`
	UploadedByEmail  *string                `json:"uploaded_by_email,omitempty"`
	UploadedByName   *string                `json:"uploaded_by_name,omitempty"`
	UploadedAt       time.Time              `json:"uploaded_at"`
	PublishedAt      *time.Time             `json:"published_at,omitempty"`
	IsReview         bool                   `json:"is_review"`
	ReviewVerified   *bool                  `json:"review_verified,omitempty"`
	ReviewApproved   *bool                  `json:"review_approved,omitempty"`
	ReviewedBy       *string                `json:"reviewed_by,omitempty"`
	ReviewedAt       *time.Time             `json:"reviewed_at,omitempty"`
	WikipediaURL     *string                `json:"wikipedia_url,omitempty"`
	ShareToken       *string                `json:"share_token,omitempty"`
	PhotoEdits       map[string]interface{} `json:"photo_edits,omitempty"`
	DetectedLocation *string                `json:"detected_location,omitempty"`
	BouquetNumber    *int                   `json:"bouquet_number,omitempty"`
	PriceCents       *int                   `json:"price_cents,omitempty"`
	DetectedFlowers  []string               `json:"detected_flowers,omitempty"`
	PurchasedBy      *string                `json:"purchased_by,omitempty"`
	SoldAt           *time.Time             `json:"sold_at,omitempty"`
	ReplacedPhotoID  *string                `json:"replaced_photo_id,omitempty"`
	RowNumbers       []int32                `json:"row_numbers,omitempty"`
	FlowerNames      []string               `json:"flower_names,omitempty"`
}

// UploadRequest contains all parameters for uploading a photo.
type UploadRequest struct {
	File          multipart.File
	Filename      string
	UserID        string
	Category      string // Optional: if empty, AI will suggest
	FlowerName    string // Optional: for flower_type category
	WikipediaURL  string // Optional: for flower catalog
	HarvestSeason string // Optional: for flower catalog
	RowNumber     *int16 // Optional: for garden_row category
	Description   string // Optional: user-provided description
	IsReview      bool   // True for consumer reviews
}

// UploadPhoto handles the complete photo upload workflow:
// 1. Read and validate image data
// 2. Extract EXIF metadata
// 3. Generate renditions (thumbnail, mobile, keep original)
// 4. Compute perceptual hash for duplicate detection
// 5. Analyze with AI for category and content
// 6. Store all renditions in object storage
// 7. Create database record with all metadata
func (s *Service) UploadPhoto(ctx context.Context, req UploadRequest) (*Photo, error) {
	// Read the uploaded file
	data, err := io.ReadAll(req.File)
	if err != nil {
		return nil, fmt.Errorf("photos: read upload: %w", err)
	}

	// Detect MIME type
	mimeType := http.DetectContentType(data)
	if !strings.HasPrefix(mimeType, "image/") {
		return nil, fmt.Errorf("photos: invalid file type: %s", mimeType)
	}

	// Decode image and auto-orient based on EXIF
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("photos: decode image: %w", err)
	}

	// Extract EXIF metadata BEFORE auto-orient (need orientation tag)
	exifData, err := ExtractEXIF(data)
	if err != nil {
		return nil, fmt.Errorf("photos: extract EXIF: %w", err)
	}

	// Extract full EXIF as JSON for metadata storage
	exifMetadata := extractFullEXIF(data)

	// Extract camera model from EXIF
	var cameraModel *string
	if model, ok := exifMetadata["Model"].(string); ok && model != "" {
		cameraModel = &model
	}

	// Auto-orient image based on EXIF orientation tag
	// This ensures thumbnails are generated with correct orientation
	img = autoOrientImage(img, getImageOrientation(exifMetadata))

	// Convert EXIF timestamp from Pacific time to UTC for storage
	// Only assume Pacific time for iPhone cameras
	if exifData.TakenAt != nil {
		isIPhone := cameraModel != nil && strings.Contains(strings.ToLower(*cameraModel), "iphone")
		if isIPhone {
			// Assume EXIF timestamp is in Pacific time (America/Los_Angeles)
			loc, err := time.LoadLocation("America/Los_Angeles")
			if err == nil {
				// Parse as Pacific time and convert to UTC
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
		// For non-iPhone cameras, keep the timestamp as-is (camera's local time)
	}

	// Generate renditions (now from properly oriented image)
	renditions, err := GenerateRenditions(img)
	if err != nil {
		return nil, fmt.Errorf("photos: generate renditions: %w", err)
	}

	// Compute perceptual hash
	dhash, err := ComputeDHash(img)
	if err != nil {
		return nil, fmt.Errorf("photos: compute hash: %w", err)
	}

	// Check for duplicates
	isDup, err := IsDuplicate(ctx, s.db, dhash)
	if err != nil {
		return nil, fmt.Errorf("photos: duplicate check: %w", err)
	}
	if isDup {
		return nil, fmt.Errorf("photos: duplicate image detected")
	}

	// AI analysis with enhanced bouquet detection
	aiResp, err := ai.AnalyzeImage(ctx, ai.AnalyzeImageRequest{
		ImageData: data,
		MimeType:  mimeType,
	})
	if err != nil {
		// Log but don't fail on AI error
		fmt.Printf("photos: AI analysis failed: %v\n", err)
	}

	// Handle numbered bouquet detection and photo replacement
	var replacedPhotoID *string
	var bouquetNumber *int
	var priceCents *int
	var detectedFlowers []string

	if aiResp != nil {
		// Store detected flowers
		if len(aiResp.DetectedFlowers) > 0 {
			detectedFlowers = aiResp.DetectedFlowers
		}

		// If AI detected a numbered bouquet, handle it
		if aiResp.IsNumberedBouquet && aiResp.BouquetNumber != nil {
			bouquetNumber = aiResp.BouquetNumber
			defaultPrice := 1500 // Default $15.00
			if defaultPriceStr := os.Getenv("DEFAULT_BOUQUET_PRICE_CENTS"); defaultPriceStr != "" {
				if dp, err := strconv.Atoi(defaultPriceStr); err == nil {
					defaultPrice = dp
				}
			}
			priceCents = &defaultPrice

			// Check if this bouquet number already exists
			existingPhoto, err := s.GetPhotoByBouquetNumber(ctx, *aiResp.BouquetNumber)
			if err == nil && existingPhoto != nil {
				// Replace the old photo with this new one
				err = s.ReplacePhoto(ctx, existingPhoto.ID, "Replaced with better photo")
				if err != nil {
					fmt.Printf("photos: failed to replace photo: %v\n", err)
				} else {
					replacedPhotoID = &existingPhoto.ID
				}
			}
		}
	}

	// For reviews, verify the image contains flowers
	if req.IsReview {
		containsFlowers, err := ai.VerifyFlowerImage(ctx, data)
		if err != nil {
			return nil, fmt.Errorf("photos: review verification failed: %w", err)
		}
		if !containsFlowers {
			return nil, fmt.Errorf("photos: review image rejected")
		}
	}

	// Determine category (use AI suggestion if not provided)
	category := req.Category
	if category == "" && aiResp != nil {
		category = aiResp.Category
	}
	if category == "" {
		category = "other"
	}

	// For single flower photos (flower_type category), identify species and get Wikipedia link
	var speciesInfo *ai.SpeciesIdentificationResponse
	if category == "flower_type" && !req.IsReview {
		speciesInfo, err = ai.IdentifyFlowerSpecies(ctx, ai.SpeciesIdentificationRequest{
			ImageData: data,
			MimeType:  mimeType,
		})
		if err != nil {
			// Log but don't fail on species identification error
			fmt.Printf("photos: species identification failed: %v\n", err)
		} else if speciesInfo != nil && speciesInfo.IsSingleFlower {
			// Pre-fill flower name, Wikipedia URL, and season description
			if req.FlowerName == "" && speciesInfo.SpeciesName != "" {
				req.FlowerName = speciesInfo.SpeciesName
			}
			if req.WikipediaURL == "" && speciesInfo.WikipediaURL != "" {
				req.WikipediaURL = speciesInfo.WikipediaURL
			}
			if req.HarvestSeason == "" && speciesInfo.SeasonDescription != "" {
				req.HarvestSeason = speciesInfo.SeasonDescription
			}
		}
	}

	// Generate UUID for storage keys
	photoID, err := generateUUID()
	if err != nil {
		return nil, fmt.Errorf("photos: generate UUID: %w", err)
	}

	// Determine file extension
	ext := format
	if ext == "jpeg" {
		ext = "jpg"
	}

	// Generate storage keys
	keyOrig := KeyOriginal(photoID, ext)
	keyMobile := KeyMobile(photoID)
	keyThumb := KeyThumb(photoID)

	// Upload to storage
	if err := s.storage.Put(ctx, keyOrig, mimeType, bytes.NewReader(data)); err != nil {
		return nil, fmt.Errorf("photos: upload original: %w", err)
	}
	if err := s.storage.Put(ctx, keyMobile, "image/jpeg", bytes.NewReader(renditions.Mobile)); err != nil {
		return nil, fmt.Errorf("photos: upload mobile: %w", err)
	}
	if err := s.storage.Put(ctx, keyThumb, "image/jpeg", bytes.NewReader(renditions.Thumb)); err != nil {
		return nil, fmt.Errorf("photos: upload thumb: %w", err)
	}

	// Detect location from GPS coordinates
	detectedLocation := DetectLocation(exifData.GPSLat, exifData.GPSLng)
	var detectedLocationPtr *string
	if detectedLocation != "" {
		detectedLocationPtr = &detectedLocation
	}

	// Generate share token
	shareToken, err := generateShareToken()
	if err != nil {
		return nil, fmt.Errorf("photos: generate share token: %w", err)
	}

	// Prepare AI analysis JSON
	var aiAnalysisJSON map[string]interface{}
	if aiResp != nil {
		aiAnalysisJSON = map[string]interface{}{
			"category":    aiResp.Category,
			"description": aiResp.Description,
			"confidence":  aiResp.Confidence,
		}
	}

	// Insert into database
	var aiSuggestion *string
	if aiResp != nil {
		aiSuggestion = &aiResp.Category
	}

	// Auto-publish stand photos, keep others pending
	status := "pending"
	var publishedAt *time.Time
	if category == "stand" && !req.IsReview {
		status = "published"
		now := time.Now()
		publishedAt = &now
	}

	const insertQuery = `
		INSERT INTO photos (
			id, category, status, storage_key_orig, storage_key_thumb, storage_key_mobile,
			exif_taken_at, exif_gps_lat, exif_gps_lng, exif_metadata, camera_model,
			perceptual_hash, ai_suggestion, ai_analysis,
			flower_name, harvest_season, row_number, description,
			uploaded_by, uploaded_at, published_at,
			is_review, share_token, wikipedia_url, detected_location,
			bouquet_number, price_cents, detected_flowers,
			row_numbers, flower_names
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14,
			$15, $16, $17, $18,
			$19, now(), $20,
			$21, $22, $23, $24,
			$25, $26, $27, $28, $29
		)
		RETURNING id, uploaded_at
	`

	var flowerName, harvestSeason, description, wikipediaURL *string
	if req.FlowerName != "" {
		flowerName = &req.FlowerName
	}
	if req.HarvestSeason != "" {
		harvestSeason = &req.HarvestSeason
	}
	if req.Description != "" {
		description = &req.Description
	}
	if req.WikipediaURL != "" {
		wikipediaURL = &req.WikipediaURL
	}

	var rowNumbers []int32
	if req.RowNumber != nil {
		rowNumbers = []int32{int32(*req.RowNumber)}
	}
	var flowerNames []string
	if req.FlowerName != "" {
		flowerNames = []string{req.FlowerName}
	} else if len(detectedFlowers) > 0 {
		flowerNames = detectedFlowers
	}

	var uploadedAt time.Time
	err = s.db.QueryRow(ctx, insertQuery,
		photoID, category, status, keyOrig, keyThumb, keyMobile,
		exifData.TakenAt, exifData.GPSLat, exifData.GPSLng, exifMetadata, cameraModel,
		dhash, aiSuggestion, aiAnalysisJSON,
		flowerName, harvestSeason, req.RowNumber, description,
		req.UserID, publishedAt,
		req.IsReview, shareToken, wikipediaURL, detectedLocationPtr,
		bouquetNumber, priceCents, detectedFlowers,
		rowNumbers, flowerNames,
	).Scan(&photoID, &uploadedAt)
	if err != nil {
		return nil, fmt.Errorf("photos: insert record: %w", err)
	}

	return &Photo{
		ID:               photoID,
		Category:         category,
		Status:           status,
		StorageKeyOrig:   keyOrig,
		StorageKeyThumb:  keyThumb,
		StorageKeyMobile: keyMobile,
		EXIFTakenAt:      exifData.TakenAt,
		EXIFGPSLat:       exifData.GPSLat,
		EXIFGPSLng:       exifData.GPSLng,
		EXIFMetadata:     exifMetadata,
		CameraModel:      cameraModel,
		PerceptualHash:   &dhash,
		AISuggestion:     aiSuggestion,
		AIAnalysis:       aiAnalysisJSON,
		FlowerName:       flowerName,
		HarvestSeason:    harvestSeason,
		RowNumber:        req.RowNumber,
		Description:      description,
		UploadedBy:       req.UserID,
		UploadedAt:       uploadedAt,
		PublishedAt:      publishedAt,
		IsReview:         req.IsReview,
		ShareToken:       &shareToken,
		WikipediaURL:     wikipediaURL,
		DetectedLocation: detectedLocationPtr,
		BouquetNumber:    bouquetNumber,
		PriceCents:       priceCents,
		DetectedFlowers:  detectedFlowers,
		ReplacedPhotoID:  replacedPhotoID,
	}, nil
}

// GetLatestStandPhoto returns the most recent published flower stand photo.
func (s *Service) GetLatestStandPhoto(ctx context.Context) (*Photo, error) {
	const query = `
		SELECT id, category, status, storage_key_orig, storage_key_thumb, storage_key_mobile,
		       exif_taken_at, exif_gps_lat, exif_gps_lng, camera_model,
		       flower_name, description, uploaded_by, uploaded_at, published_at, share_token
		FROM photos
		WHERE category = 'stand' AND status = 'published'
		ORDER BY COALESCE(exif_taken_at, uploaded_at) DESC
		LIMIT 1
	`

	var p Photo
	err := s.db.QueryRow(ctx, query).Scan(
		&p.ID, &p.Category, &p.Status, &p.StorageKeyOrig, &p.StorageKeyThumb, &p.StorageKeyMobile,
		&p.EXIFTakenAt, &p.EXIFGPSLat, &p.EXIFGPSLng, &p.CameraModel,
		&p.FlowerName, &p.Description, &p.UploadedBy, &p.UploadedAt, &p.PublishedAt, &p.ShareToken,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("photos: get latest stand photo: %w", err)
	}
	return &p, nil
}

// GetPhotoByID retrieves a photo by its ID.
func (s *Service) GetPhotoByID(ctx context.Context, id string) (*Photo, error) {
	const query = `
		SELECT p.id, p.category, p.status, p.storage_key_orig, p.storage_key_thumb, p.storage_key_mobile,
		       p.exif_taken_at, p.exif_gps_lat, p.exif_gps_lng, p.exif_metadata, p.camera_model,
		       p.perceptual_hash, p.ai_suggestion, p.ai_analysis,
		       p.flower_name, p.harvest_season, p.row_number, p.description, p.freshness_days,
		       p.uploaded_by, p.uploaded_at, p.published_at,
		       p.is_review, p.review_verified, p.review_approved, p.reviewed_by, p.reviewed_at,
		       p.wikipedia_url, p.share_token, p.photo_edits, p.detected_location,
		       p.bouquet_number, p.price_cents, p.row_numbers, p.flower_names,
		       p.purchased_by, p.sold_at,
		       u.email, u.display_name
		FROM photos p
		LEFT JOIN users u ON p.uploaded_by = u.id
		WHERE p.id = $1
	`

	var p Photo
	var exifMetadataJSON, aiAnalysisJSON, photoEditsJSON []byte
	err := s.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Category, &p.Status, &p.StorageKeyOrig, &p.StorageKeyThumb, &p.StorageKeyMobile,
		&p.EXIFTakenAt, &p.EXIFGPSLat, &p.EXIFGPSLng, &exifMetadataJSON, &p.CameraModel,
		&p.PerceptualHash, &p.AISuggestion, &aiAnalysisJSON,
		&p.FlowerName, &p.HarvestSeason, &p.RowNumber, &p.Description, &p.FreshnessDays,
		&p.UploadedBy, &p.UploadedAt, &p.PublishedAt,
		&p.IsReview, &p.ReviewVerified, &p.ReviewApproved, &p.ReviewedBy, &p.ReviewedAt,
		&p.WikipediaURL, &p.ShareToken, &photoEditsJSON, &p.DetectedLocation,
		&p.BouquetNumber, &p.PriceCents, &p.RowNumbers, &p.FlowerNames,
		&p.PurchasedBy, &p.SoldAt,
		&p.UploadedByEmail, &p.UploadedByName,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("photos: get by ID: %w", err)
	}

	// Parse JSON fields
	if len(exifMetadataJSON) > 0 {
		json.Unmarshal(exifMetadataJSON, &p.EXIFMetadata)
	}
	if len(aiAnalysisJSON) > 0 {
		json.Unmarshal(aiAnalysisJSON, &p.AIAnalysis)
	}
	if len(photoEditsJSON) > 0 {
		json.Unmarshal(photoEditsJSON, &p.PhotoEdits)
	}

	return &p, nil
}

// GetPhotoByShareToken retrieves a photo by its share token.
func (s *Service) GetPhotoByShareToken(ctx context.Context, token string) (*Photo, error) {
	const query = `
		SELECT id, category, status, storage_key_orig, storage_key_thumb, storage_key_mobile,
		       exif_taken_at, exif_gps_lat, exif_gps_lng, camera_model,
		       flower_name, description, uploaded_by, uploaded_at, published_at, share_token
		FROM photos
		WHERE share_token = $1 AND status = 'published'
	`

	var p Photo
	err := s.db.QueryRow(ctx, query, token).Scan(
		&p.ID, &p.Category, &p.Status, &p.StorageKeyOrig, &p.StorageKeyThumb, &p.StorageKeyMobile,
		&p.EXIFTakenAt, &p.EXIFGPSLat, &p.EXIFGPSLng, &p.CameraModel,
		&p.FlowerName, &p.Description, &p.UploadedBy, &p.UploadedAt, &p.PublishedAt, &p.ShareToken,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("photos: get by share token: %w", err)
	}
	return &p, nil
}

// ListPhotos returns photos filtered by category and status.
func (s *Service) ListPhotos(ctx context.Context, category, status string, limit int) ([]*Photo, error) {
	query := `
		SELECT p.id, p.category, p.status, p.storage_key_thumb, p.storage_key_mobile, p.storage_key_orig,
		       p.exif_taken_at, p.flower_name, p.description, p.uploaded_at, p.published_at, p.share_token,
		       p.ai_analysis, p.is_review, p.review_approved, p.camera_model, p.detected_location,
		       p.exif_gps_lat, p.exif_gps_lng, p.uploaded_by, p.bouquet_number, p.price_cents,
		       p.row_numbers, p.flower_names,
		       u.email, u.display_name
		FROM photos p
		LEFT JOIN users u ON p.uploaded_by = u.id
		WHERE 1=1
	`
	args := []interface{}{}
	argNum := 1

	if category != "" {
		query += fmt.Sprintf(" AND p.category = $%d", argNum)
		args = append(args, category)
		argNum++
	}
	if status != "" {
		query += fmt.Sprintf(" AND p.status = $%d", argNum)
		args = append(args, status)
		argNum++
	}

	query += " ORDER BY COALESCE(p.exif_taken_at, p.uploaded_at) DESC"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argNum)
		args = append(args, limit)
	}

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("photos: list: %w", err)
	}
	defer rows.Close()

	photos := make([]*Photo, 0)
	for rows.Next() {
		var p Photo
		var aiAnalysisJSON []byte
		err := rows.Scan(
			&p.ID, &p.Category, &p.Status, &p.StorageKeyThumb, &p.StorageKeyMobile, &p.StorageKeyOrig,
			&p.EXIFTakenAt, &p.FlowerName, &p.Description, &p.UploadedAt, &p.PublishedAt, &p.ShareToken,
			&aiAnalysisJSON, &p.IsReview, &p.ReviewApproved, &p.CameraModel, &p.DetectedLocation,
			&p.EXIFGPSLat, &p.EXIFGPSLng, &p.UploadedBy, &p.BouquetNumber, &p.PriceCents,
			&p.RowNumbers, &p.FlowerNames,
			&p.UploadedByEmail, &p.UploadedByName,
		)
		if err != nil {
			return nil, fmt.Errorf("photos: scan row: %w", err)
		}

		// Parse AI analysis JSON
		if len(aiAnalysisJSON) > 0 {
			json.Unmarshal(aiAnalysisJSON, &p.AIAnalysis)
		}

		photos = append(photos, &p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return photos, nil
}

// PublishPhoto marks a photo as published.
func (s *Service) PublishPhoto(ctx context.Context, id string) error {
	const query = `
		UPDATE photos
		SET status = 'published', published_at = now()
		WHERE id = $1
	`
	_, err := s.db.Exec(ctx, query, id)
	return err
}

// ApproveReview approves a consumer review photo.
func (s *Service) ApproveReview(ctx context.Context, photoID, reviewerID string, approved bool) error {
	const query = `
		UPDATE photos
		SET review_approved = $1, reviewed_by = $2, reviewed_at = now()
		WHERE id = $3 AND is_review = true
	`
	_, err := s.db.Exec(ctx, query, approved, reviewerID, photoID)
	return err
}

// DeletePhoto performs a soft delete: marks the photo as deleted in the database
// and HARD deletes the physical files from storage for audit purposes.
func (s *Service) DeletePhoto(ctx context.Context, id, deleterEmail string) error {
	// Get photo details first
	photo, err := s.GetPhotoByID(ctx, id)
	if err != nil {
		return fmt.Errorf("photos: get photo for deletion: %w", err)
	}
	if photo == nil {
		return fmt.Errorf("photos: photo not found")
	}

	// HARD delete from storage (physical files removed)
	if err := s.storage.Delete(ctx, photo.StorageKeyOrig); err != nil {
		return fmt.Errorf("photos: delete original: %w", err)
	}
	if err := s.storage.Delete(ctx, photo.StorageKeyMobile); err != nil {
		return fmt.Errorf("photos: delete mobile: %w", err)
	}
	if err := s.storage.Delete(ctx, photo.StorageKeyThumb); err != nil {
		return fmt.Errorf("photos: delete thumb: %w", err)
	}

	// SOFT delete in database (mark as deleted for audit)
	const query = `
		UPDATE photos 
		SET deleted_at = now(), deleted_by_email = $1, status = 'deleted'
		WHERE id = $2
	`
	_, err = s.db.Exec(ctx, query, deleterEmail, id)
	return err
}

// UpdatePhotoEdits updates the photo_edits metadata for non-destructive editing.
func (s *Service) UpdatePhotoEdits(ctx context.Context, id string, edits map[string]interface{}) error {
	const query = `
		UPDATE photos
		SET photo_edits = $1
		WHERE id = $2
	`
	_, err := s.db.Exec(ctx, query, edits, id)
	return err
}

// UpdatePhotoCategory updates the category of a photo (for admin override).
func (s *Service) UpdatePhotoCategory(ctx context.Context, id, category string) error {
	const query = `
		UPDATE photos
		SET category = $1
		WHERE id = $2
	`
	_, err := s.db.Exec(ctx, query, category, id)
	return err
}

// ReanalyzePhoto re-runs AI classification on an existing photo.
func (s *Service) ReanalyzePhoto(ctx context.Context, id string) error {
	// Get the photo
	photo, err := s.GetPhotoByID(ctx, id)
	if err != nil {
		return fmt.Errorf("photos: get photo: %w", err)
	}
	if photo == nil {
		return fmt.Errorf("photos: photo not found")
	}

	// Download the original image from storage
	data, err := s.storage.Get(ctx, photo.StorageKeyOrig)
	if err != nil {
		return fmt.Errorf("photos: download image: %w", err)
	}

	// Detect MIME type
	mimeType := http.DetectContentType(data)

	// Run AI analysis
	aiResp, err := ai.AnalyzeImage(ctx, ai.AnalyzeImageRequest{
		ImageData: data,
		MimeType:  mimeType,
	})
	if err != nil {
		return fmt.Errorf("photos: AI analysis failed: %w", err)
	}

	// Prepare AI analysis JSON
	aiAnalysisJSON := map[string]interface{}{
		"category":    aiResp.Category,
		"description": aiResp.Description,
		"confidence":  aiResp.Confidence,
	}

	// Update the database with new AI analysis
	const query = `
		UPDATE photos
		SET ai_suggestion = $1, ai_analysis = $2
		WHERE id = $3
	`
	_, err = s.db.Exec(ctx, query, aiResp.Category, aiAnalysisJSON, id)
	if err != nil {
		return fmt.Errorf("photos: update AI analysis: %w", err)
	}

	// If it's a flower_type, also re-run species identification
	if aiResp.Category == "flower_type" {
		speciesInfo, err := ai.IdentifyFlowerSpecies(ctx, ai.SpeciesIdentificationRequest{
			ImageData: data,
			MimeType:  mimeType,
		})
		if err == nil && speciesInfo != nil && speciesInfo.IsSingleFlower {
			// Update flower info
			const updateFlowerQuery = `
				UPDATE photos
				SET flower_name = $1, wikipedia_url = $2, harvest_season = $3
				WHERE id = $4
			`
			_, err = s.db.Exec(ctx, updateFlowerQuery,
				speciesInfo.SpeciesName,
				speciesInfo.WikipediaURL,
				speciesInfo.SeasonDescription,
				id,
			)
			if err != nil {
				// Log but don't fail
				fmt.Printf("photos: failed to update species info: %v\n", err)
			}
		}
	}

	return nil
}

// GetPhotoByBouquetNumber finds an active photo with the given bouquet number.
func (s *Service) GetPhotoByBouquetNumber(ctx context.Context, number int) (*Photo, error) {
	const query = `
		SELECT id, category, bouquet_number, price_cents, storage_key_mobile, storage_key_thumb
		FROM photos
		WHERE bouquet_number = $1 
		  AND deleted_at IS NULL 
		  AND purchased_by IS NULL
		LIMIT 1
	`

	var p Photo
	err := s.db.QueryRow(ctx, query, number).Scan(
		&p.ID, &p.Category, &p.BouquetNumber, &p.PriceCents,
		&p.StorageKeyMobile, &p.StorageKeyThumb,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("photos: get by bouquet number: %w", err)
	}
	return &p, nil
}

// ReplacePhoto marks an old photo as replaced (soft delete).
func (s *Service) ReplacePhoto(ctx context.Context, photoID string, reason string) error {
	const query = `
		UPDATE photos 
		SET deleted_at = now(), 
		    admin_notes = $2,
		    status = 'replaced'
		WHERE id = $1
	`
	_, err := s.db.Exec(ctx, query, photoID, reason)
	if err != nil {
		return fmt.Errorf("photos: replace photo: %w", err)
	}
	return nil
}

// UpdateBouquetInfo updates the bouquet number and price for a photo.
func (s *Service) UpdateBouquetInfo(ctx context.Context, photoID string, bouquetNumber int, priceCents int) error {
	const query = `
		UPDATE photos
		SET bouquet_number = $1, price_cents = $2
		WHERE id = $3
	`
	_, err := s.db.Exec(ctx, query, bouquetNumber, priceCents, photoID)
	if err != nil {
		return fmt.Errorf("photos: update bouquet info: %w", err)
	}
	return nil
}

// GetAvailableBouquets returns all bouquets available for purchase.
func (s *Service) GetAvailableBouquets(ctx context.Context) ([]*Photo, error) {
	const query = `
		SELECT id, bouquet_number, price_cents, storage_key_mobile, storage_key_thumb,
		       description, exif_taken_at, detected_flowers, ai_analysis, uploaded_at
		FROM photos
		WHERE bouquet_number IS NOT NULL 
		  AND purchased_by IS NULL 
		  AND deleted_at IS NULL
		  AND category = 'bouquet'
		ORDER BY COALESCE(exif_taken_at, uploaded_at) DESC
	`

	rows, err := s.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("photos: get available bouquets: %w", err)
	}
	defer rows.Close()

	bouquets := make([]*Photo, 0)
	for rows.Next() {
		var p Photo
		var detectedFlowersArray []string
		var aiAnalysisJSON []byte

		err := rows.Scan(
			&p.ID, &p.BouquetNumber, &p.PriceCents, &p.StorageKeyMobile, &p.StorageKeyThumb,
			&p.Description, &p.EXIFTakenAt, &detectedFlowersArray, &aiAnalysisJSON, &p.UploadedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("photos: scan bouquet row: %w", err)
		}

		p.DetectedFlowers = detectedFlowersArray

		// Parse AI analysis JSON
		if len(aiAnalysisJSON) > 0 {
			json.Unmarshal(aiAnalysisJSON, &p.AIAnalysis)
		}

		bouquets = append(bouquets, &p)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return bouquets, nil
}

// GetAllBouquets returns all bouquets (available, sold, active).
func (s *Service) GetAllBouquets(ctx context.Context) ([]*Photo, error) {
	const query = `
		SELECT id, bouquet_number, price_cents, storage_key_mobile, storage_key_thumb,
		       description, exif_taken_at, detected_flowers, ai_analysis, uploaded_at,
		       purchased_by, sold_at
		FROM photos
		WHERE bouquet_number IS NOT NULL 
		  AND deleted_at IS NULL
		  AND category = 'bouquet'
		ORDER BY COALESCE(exif_taken_at, uploaded_at) DESC
	`

	rows, err := s.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("photos: get all bouquets: %w", err)
	}
	defer rows.Close()

	bouquets := make([]*Photo, 0)
	for rows.Next() {
		var p Photo
		var detectedFlowersArray []string
		var aiAnalysisJSON []byte

		err := rows.Scan(
			&p.ID, &p.BouquetNumber, &p.PriceCents, &p.StorageKeyMobile, &p.StorageKeyThumb,
			&p.Description, &p.EXIFTakenAt, &detectedFlowersArray, &aiAnalysisJSON, &p.UploadedAt,
			&p.PurchasedBy, &p.SoldAt,
		)
		if err != nil {
			return nil, fmt.Errorf("photos: scan bouquet row: %w", err)
		}

		p.DetectedFlowers = detectedFlowersArray

		// Parse AI analysis JSON
		if len(aiAnalysisJSON) > 0 {
			json.Unmarshal(aiAnalysisJSON, &p.AIAnalysis)
		}

		bouquets = append(bouquets, &p)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return bouquets, nil
}

// HoldBouquet marks a bouquet as pending (Venmo hold) and triggers email.
func (s *Service) HoldBouquet(ctx context.Context, id string, userID string, userEmail string, userName string) error {
	// Get bouquet details first
	photo, err := s.GetPhotoByID(ctx, id)
	if err != nil {
		return fmt.Errorf("photos: failed to find bouquet for hold: %w", err)
	}
	if photo == nil {
		return fmt.Errorf("photos: bouquet not found")
	}
	if photo.Category != "bouquet" || photo.BouquetNumber == nil {
		return fmt.Errorf("photos: photo is not a numbered bouquet")
	}
	if photo.Status != "published" {
		return fmt.Errorf("photos: bouquet is not active for hold")
	}
	if photo.PurchasedBy != nil {
		return fmt.Errorf("photos: bouquet is already sold")
	}

	// Place on hold by moving back to pending status
	const query = `
		UPDATE photos
		SET status = 'pending'
		WHERE id = $1 AND category = 'bouquet' AND status = 'published' AND purchased_by IS NULL
	`
	_, err = s.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("photos: failed to place hold: %w", err)
	}

	// Trigger Email Notification to Lorraine
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "lorraine.hellum@gmail.com"
	}

	subject := fmt.Sprintf("⏳ Venmo Hold: Bouquet #%d", *photo.BouquetNumber)
	body := fmt.Sprintf(`Hi Lorraine,

Customer %s (%s) has selected Bouquet #%d and has been redirected to Venmo to complete payment.

The bouquet has been placed on a temporary "Pending" hold to prevent other customers from purchasing it. It is no longer visible on the stand.

Please verify the payment on your Venmo account. Once confirmed, you can mark it as "Sold" or manually update its status from your Admin Queue.

Best,
Fleurraine System`, userName, userEmail, *photo.BouquetNumber)

	err = email.Send(ctx, subject, body)
	if err != nil {
		fmt.Printf("Warning: failed to send hold email: %v\n", err)
	}

	return nil
}

// MarkBouquetSold marks a bouquet as sold after successful payment.
func (s *Service) MarkBouquetSold(ctx context.Context, photoID string, userID string) error {
	const query = `
		UPDATE photos 
		SET purchased_by = $1, sold_at = now()
		WHERE id = $2 AND bouquet_number IS NOT NULL
	`
	_, err := s.db.Exec(ctx, query, userID, photoID)
	if err != nil {
		return fmt.Errorf("photos: mark bouquet sold: %w", err)
	}
	return nil
}

// ---- Helper functions ----------------------------------------------------

// generateUUID generates a random UUID v4.
func generateUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // Variant 10
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}

// generateShareToken generates a random share token.
func generateShareToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// extractFullEXIF extracts all EXIF data as a map for JSON storage.
func extractFullEXIF(data []byte) map[string]interface{} {
	result := make(map[string]interface{})

	x, err := exif.Decode(bytes.NewReader(data))
	if err != nil {
		return result
	}

	// Extract common EXIF fields manually instead of using Walk
	// to avoid type compatibility issues
	if tag, err := x.Get(exif.Make); err == nil {
		if val, err := tag.StringVal(); err == nil {
			result["Make"] = val
		}
	}
	if tag, err := x.Get(exif.Model); err == nil {
		if val, err := tag.StringVal(); err == nil {
			result["Model"] = val
		}
	}
	if tag, err := x.Get(exif.DateTime); err == nil {
		if val, err := tag.StringVal(); err == nil {
			result["DateTime"] = val
		}
	}
	if tag, err := x.Get(exif.DateTimeOriginal); err == nil {
		if val, err := tag.StringVal(); err == nil {
			result["DateTimeOriginal"] = val
		}
	}
	if tag, err := x.Get(exif.Orientation); err == nil {
		if val, err := tag.Int(0); err == nil {
			result["Orientation"] = val
		}
	}
	if tag, err := x.Get(exif.ExposureTime); err == nil {
		if val, err := tag.Rat(0); err == nil {
			if f, _ := val.Float64(); f > 0 {
				result["ExposureTime"] = f
			}
		}
	}
	if tag, err := x.Get(exif.FNumber); err == nil {
		if val, err := tag.Rat(0); err == nil {
			if f, _ := val.Float64(); f > 0 {
				result["FNumber"] = f
			}
		}
	}
	if tag, err := x.Get(exif.ISOSpeedRatings); err == nil {
		if val, err := tag.Int(0); err == nil {
			result["ISO"] = val
		}
	}
	if tag, err := x.Get(exif.FocalLength); err == nil {
		if val, err := tag.Rat(0); err == nil {
			if f, _ := val.Float64(); f > 0 {
				result["FocalLength"] = f
			}
		}
	}
	if tag, err := x.Get(exif.LensModel); err == nil {
		if val, err := tag.StringVal(); err == nil {
			result["LensModel"] = val
		}
	}

	return result
}

// getImageOrientation extracts the EXIF orientation value
func getImageOrientation(exifMetadata map[string]interface{}) int {
	if orientation, ok := exifMetadata["Orientation"].(int); ok {
		return orientation
	}
	return 1 // Default: no rotation needed
}

// autoOrientImage applies EXIF orientation to the image
// EXIF Orientation values: https://sirv.com/help/articles/rotate-photos-to-be-upright/
func autoOrientImage(img image.Image, orientation int) image.Image {
	switch orientation {
	case 1:
		// Normal - no transformation needed
		return img
	case 2:
		// Flip horizontal
		return imaging.FlipH(img)
	case 3:
		// Rotate 180°
		return imaging.Rotate180(img)
	case 4:
		// Flip vertical
		return imaging.FlipV(img)
	case 5:
		// Rotate 90° CCW and flip horizontal
		return imaging.FlipH(imaging.Rotate270(img))
	case 6:
		// Rotate 90° CCW (270° CW)
		return imaging.Rotate270(img)
	case 7:
		// Rotate 90° CW and flip horizontal
		return imaging.FlipH(imaging.Rotate90(img))
	case 8:
		// Rotate 90° CW (270° CCW)
		return imaging.Rotate90(img)
	default:
		return img
	}
}

// PurchaseBouquet registers a successful purchase of a bouquet.
func (s *Service) PurchaseBouquet(ctx context.Context, id string, userID string, userEmail string, userName string) error {
	// 1. Fetch bouquet to verify availability
	photo, err := s.GetPhotoByID(ctx, id)
	if err != nil {
		return fmt.Errorf("photos: failed to find bouquet for purchase: %w", err)
	}
	if photo == nil {
		return fmt.Errorf("photos: bouquet not found")
	}
	if photo.Category != "bouquet" || photo.BouquetNumber == nil {
		return fmt.Errorf("photos: photo is not a numbered bouquet")
	}
	if photo.PurchasedBy != nil {
		return fmt.Errorf("photos: bouquet is already sold")
	}

	// 2. Mark as sold
	err = s.MarkBouquetSold(ctx, id, userID)
	if err != nil {
		return fmt.Errorf("photos: failed to mark sold: %w", err)
	}

	// 3. Insert record into bouquet_purchases
	paymentIntent := fmt.Sprintf("apple_pay_sim_%s", photo.ID)
	const query = `
		INSERT INTO bouquet_purchases (
			photo_id, user_id, bouquet_number, stripe_payment_intent, amount_cents, status, completed_at, customer_email, customer_name
		) VALUES (
			$1, $2, $3, $4, $5, 'succeeded', now(), $6, $7
		)
	`
	_, err = s.db.Exec(ctx, query, photo.ID, userID, *photo.BouquetNumber, paymentIntent, *photo.PriceCents, userEmail, userName)
	if err != nil {
		return fmt.Errorf("photos: failed to log purchase: %w", err)
	}

	// 4. Trigger Email Notification to Lorraine
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "lorraine.hellum@gmail.com"
	}

	subject := fmt.Sprintf("💐 Bouquet #%d Sold!", *photo.BouquetNumber)
	body := fmt.Sprintf(`Hi Lorraine,

Great news! Bouquet #%d has been purchased via Apple Pay.

Customer Details:
- Name: %s
- Email: %s
- Price Paid: $%.2f

The bouquet has been marked as "sold" in your system and is no longer available on the site.

Best,
Fleurraine System`, *photo.BouquetNumber, userName, userEmail, float64(*photo.PriceCents)/100.0)

	err = email.Send(ctx, subject, body)
	if err != nil {
		fmt.Printf("Warning: failed to send sale email: %v\n", err)
	}

	return nil
}

// UpdatePhotoMetadata updates photo metadata (for admin override).
func (s *Service) UpdatePhotoMetadata(ctx context.Context, id string, category string, bouquetNumber *int, priceCents *int, flowerNames []string, rowNumbers []int32, description string) error {
	const query = `
		UPDATE photos
		SET category = $1,
		    bouquet_number = $2,
		    price_cents = $3,
		    flower_names = $4,
		    row_numbers = $5,
		    description = $6
		WHERE id = $7
	`
	_, err := s.db.Exec(ctx, query, category, bouquetNumber, priceCents, flowerNames, rowNumbers, description, id)
	if err != nil {
		return fmt.Errorf("photos: update photo metadata: %w", err)
	}
	return nil
}
