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
	"strconv"
	"strings"
	"time"

	"github.com/corona10/goimagehash"
	"github.com/disintegration/imaging"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rwcarlsen/goexif/exif"

	"github.com/uffehellum/fleurraine/internal/ai"
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

	// Fetch all non-null perceptual hashes from the DB. For Lorraine's use
	// case the photo count is small enough that a full scan is fine.
	rows, err := pool.Query(ctx,
		`SELECT perceptual_hash FROM photos WHERE perceptual_hash IS NOT NULL`)
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
//   photos/{uuid}/original.{ext}
func KeyOriginal(uuid, ext string) string {
	return fmt.Sprintf("photos/%s/original.%s", uuid, ext)
}

// KeyMobile returns the Tigris storage key for the mobile rendition.
//   photos/{uuid}/mobile.jpg
func KeyMobile(uuid string) string {
	return fmt.Sprintf("photos/%s/mobile.jpg", uuid)
}

// KeyThumb returns the Tigris storage key for the thumbnail rendition.
//   photos/{uuid}/thumb.jpg
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
	UploadedAt       time.Time              `json:"uploaded_at"`
	PublishedAt      *time.Time             `json:"published_at,omitempty"`
	IsReview         bool                   `json:"is_review"`
	ReviewVerified   *bool                  `json:"review_verified,omitempty"`
	ReviewApproved   *bool                  `json:"review_approved,omitempty"`
	ReviewedBy       *string                `json:"reviewed_by,omitempty"`
	ReviewedAt       *time.Time             `json:"reviewed_at,omitempty"`
	WikipediaURL     *string                `json:"wikipedia_url,omitempty"`
	ShareToken       *string                `json:"share_token,omitempty"`
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

	// Decode image
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("photos: decode image: %w", err)
	}

	// Extract EXIF metadata
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

	// Generate renditions
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

	// AI analysis
	aiResp, err := ai.AnalyzeImage(ctx, ai.AnalyzeImageRequest{
		ImageData: data,
		MimeType:  mimeType,
	})
	if err != nil {
		// Log but don't fail on AI error
		fmt.Printf("photos: AI analysis failed: %v\n", err)
	}

	// For reviews, verify the image contains flowers
	if req.IsReview {
		containsFlowers, reason, err := ai.VerifyFlowerImage(ctx, data, mimeType)
		if err != nil {
			return nil, fmt.Errorf("photos: review verification failed: %w", err)
		}
		if !containsFlowers {
			return nil, fmt.Errorf("photos: review image rejected: %s", reason)
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
			"subjects":    aiResp.Subjects,
			"location":    aiResp.Location,
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
			is_review, share_token, wikipedia_url
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14,
			$15, $16, $17, $18,
			$19, now(), $20,
			$21, $22, $23
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

	var uploadedAt time.Time
	err = s.db.QueryRow(ctx, insertQuery,
		photoID, category, status, keyOrig, keyThumb, keyMobile,
		exifData.TakenAt, exifData.GPSLat, exifData.GPSLng, exifMetadata, cameraModel,
		dhash, aiSuggestion, aiAnalysisJSON,
		flowerName, harvestSeason, req.RowNumber, description,
		req.UserID, publishedAt,
		req.IsReview, shareToken, wikipediaURL,
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
		SELECT id, category, status, storage_key_orig, storage_key_thumb, storage_key_mobile,
		       exif_taken_at, exif_gps_lat, exif_gps_lng, exif_metadata, camera_model,
		       perceptual_hash, ai_suggestion, ai_analysis,
		       flower_name, harvest_season, row_number, description, freshness_days,
		       uploaded_by, uploaded_at, published_at,
		       is_review, review_verified, review_approved, reviewed_by, reviewed_at,
		       wikipedia_url, share_token
		FROM photos
		WHERE id = $1
	`

	var p Photo
	var exifMetadataJSON, aiAnalysisJSON []byte
	err := s.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Category, &p.Status, &p.StorageKeyOrig, &p.StorageKeyThumb, &p.StorageKeyMobile,
		&p.EXIFTakenAt, &p.EXIFGPSLat, &p.EXIFGPSLng, &exifMetadataJSON, &p.CameraModel,
		&p.PerceptualHash, &p.AISuggestion, &aiAnalysisJSON,
		&p.FlowerName, &p.HarvestSeason, &p.RowNumber, &p.Description, &p.FreshnessDays,
		&p.UploadedBy, &p.UploadedAt, &p.PublishedAt,
		&p.IsReview, &p.ReviewVerified, &p.ReviewApproved, &p.ReviewedBy, &p.ReviewedAt,
		&p.WikipediaURL, &p.ShareToken,
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
		SELECT id, category, status, storage_key_thumb, storage_key_mobile,
		       exif_taken_at, flower_name, description, uploaded_at, published_at, share_token
		FROM photos
		WHERE 1=1
	`
	args := []interface{}{}
	argNum := 1

	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", argNum)
		args = append(args, category)
		argNum++
	}
	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argNum)
		args = append(args, status)
		argNum++
	}

	query += " ORDER BY COALESCE(exif_taken_at, uploaded_at) DESC"

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
		err := rows.Scan(
			&p.ID, &p.Category, &p.Status, &p.StorageKeyThumb, &p.StorageKeyMobile,
			&p.EXIFTakenAt, &p.FlowerName, &p.Description, &p.UploadedAt, &p.PublishedAt, &p.ShareToken,
		)
		if err != nil {
			return nil, fmt.Errorf("photos: scan row: %w", err)
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
