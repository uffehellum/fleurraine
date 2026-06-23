// Package photos handles photo upload, EXIF extraction, rendition generation,
// perceptual hashing, AI categorization, and photo CRUD operations.
package photos

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/jpeg"
	"math/bits"
	"strconv"
	"time"

	"github.com/corona10/goimagehash"
	"github.com/disintegration/imaging"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rwcarlsen/goexif/exif"
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
