package photos_test

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"testing"

	"github.com/rwcarlsen/goexif/exif"
	"github.com/rwcarlsen/goexif/mknote"
	"github.com/rwcarlsen/goexif/tiff"
	"github.com/uffehellum/fleurraine/internal/photos"
)

// ---- helpers ---------------------------------------------------------------

// solidImage creates a w×h solid-color image.
func solidImage(w, h int, c color.Color) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	return img
}

// encodeJPEG encodes an image to JPEG bytes.
func encodeJPEG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("encodeJPEG: %v", err)
	}
	return buf.Bytes()
}

// ---- rendition dimension tests (5.6) ----------------------------------------

func TestGenerateRenditions_ThumbWidth(t *testing.T) {
	// Wide image: 1600×900 — thumb must be ≤150 px wide.
	src := solidImage(1600, 900, color.RGBA{R: 200, G: 100, B: 50, A: 255})
	r, err := photos.GenerateRenditions(src)
	if err != nil {
		t.Fatalf("GenerateRenditions error: %v", err)
	}

	thumbImg, _, err := image.Decode(bytes.NewReader(r.Thumb))
	if err != nil {
		t.Fatalf("decode thumb: %v", err)
	}
	if w := thumbImg.Bounds().Dx(); w > photos.ThumbMaxWidth {
		t.Errorf("thumb width %d exceeds max %d", w, photos.ThumbMaxWidth)
	}
}

func TestGenerateRenditions_MobileWidth(t *testing.T) {
	// Wide image: 3000×2000 — mobile must be ≤1200 px wide.
	src := solidImage(3000, 2000, color.RGBA{R: 50, G: 150, B: 200, A: 255})
	r, err := photos.GenerateRenditions(src)
	if err != nil {
		t.Fatalf("GenerateRenditions error: %v", err)
	}

	mobileImg, _, err := image.Decode(bytes.NewReader(r.Mobile))
	if err != nil {
		t.Fatalf("decode mobile: %v", err)
	}
	if w := mobileImg.Bounds().Dx(); w > photos.MobileMaxWidth {
		t.Errorf("mobile width %d exceeds max %d", w, photos.MobileMaxWidth)
	}
}

func TestGenerateRenditions_AspectRatioPreserved(t *testing.T) {
	// 1600×400 (4:1) — after thumbnail resize the height must scale proportionally.
	src := solidImage(1600, 400, color.RGBA{R: 100, G: 200, B: 100, A: 255})
	r, err := photos.GenerateRenditions(src)
	if err != nil {
		t.Fatalf("GenerateRenditions error: %v", err)
	}

	thumbImg, _, err := image.Decode(bytes.NewReader(r.Thumb))
	if err != nil {
		t.Fatalf("decode thumb: %v", err)
	}
	b := thumbImg.Bounds()
	w, h := b.Dx(), b.Dy()
	// Expected height at width=150 for a 4:1 image is ~37-38 px.
	expectedH := w / 4
	if h < expectedH-2 || h > expectedH+2 {
		t.Errorf("aspect ratio not preserved: %dx%d (expected ~%dx%d)", w, h, 150, expectedH)
	}
}

func TestGenerateRenditions_SmallImageNotUpscaled(t *testing.T) {
	// Image smaller than thumb limit should not be enlarged.
	src := solidImage(80, 60, color.RGBA{R: 10, G: 20, B: 30, A: 255})
	r, err := photos.GenerateRenditions(src)
	if err != nil {
		t.Fatalf("GenerateRenditions error: %v", err)
	}

	thumbImg, _, err := image.Decode(bytes.NewReader(r.Thumb))
	if err != nil {
		t.Fatalf("decode thumb: %v", err)
	}
	if w := thumbImg.Bounds().Dx(); w > 80 {
		t.Errorf("small image was upscaled: got width %d, want ≤80", w)
	}
}

// ---- EXIF extraction tests (5.6) --------------------------------------------

func TestExtractEXIF_NoEXIF(t *testing.T) {
	// A plain JPEG with no EXIF should return an empty EXIFData, not an error.
	img := solidImage(100, 100, color.White)
	data := encodeJPEG(t, img)

	result, err := photos.ExtractEXIF(data)
	if err != nil {
		t.Fatalf("ExtractEXIF returned error for JPEG without EXIF: %v", err)
	}
	if result.TakenAt != nil {
		t.Errorf("expected nil TakenAt, got %v", result.TakenAt)
	}
	if result.GPSLat != nil || result.GPSLng != nil {
		t.Errorf("expected nil GPS, got lat=%v lng=%v", result.GPSLat, result.GPSLng)
	}
}

func TestExtractEXIF_WithDateTimeOriginal(t *testing.T) {
	data := buildJPEGWithEXIF(t, "2023:06:15 10:30:00", 0, 0, false)

	result, err := photos.ExtractEXIF(data)
	if err != nil {
		t.Fatalf("ExtractEXIF error: %v", err)
	}
	if result.TakenAt == nil {
		t.Fatal("expected TakenAt to be set")
	}
	if result.TakenAt.Year() != 2023 || result.TakenAt.Month() != 6 || result.TakenAt.Day() != 15 {
		t.Errorf("unexpected TakenAt: %v", result.TakenAt)
	}
}

func TestExtractEXIF_WithGPS(t *testing.T) {
	data := buildJPEGWithEXIF(t, "2023:06:15 10:30:00", 47.6062, -122.3321, true)

	result, err := photos.ExtractEXIF(data)
	if err != nil {
		t.Fatalf("ExtractEXIF error: %v", err)
	}
	if result.GPSLat == nil || result.GPSLng == nil {
		t.Fatal("expected GPS coordinates to be set")
	}
	if abs(*result.GPSLat-47.6062) > 0.001 {
		t.Errorf("GPSLat: got %f, want ~47.6062", *result.GPSLat)
	}
	if abs(*result.GPSLng-(-122.3321)) > 0.001 {
		t.Errorf("GPSLng: got %f, want ~-122.3321", *result.GPSLng)
	}
}

// ---- Key naming tests (5.5) -------------------------------------------------

func TestKeyNaming(t *testing.T) {
	uuid := "550e8400-e29b-41d4-a716-446655440000"
	cases := []struct {
		name string
		got  string
		want string
	}{
		{"original jpg", photos.KeyOriginal(uuid, "jpg"), "photos/" + uuid + "/original.jpg"},
		{"original webp", photos.KeyOriginal(uuid, "webp"), "photos/" + uuid + "/original.webp"},
		{"mobile", photos.KeyMobile(uuid), "photos/" + uuid + "/mobile.jpg"},
		{"thumb", photos.KeyThumb(uuid), "photos/" + uuid + "/thumb.jpg"},
	}
	for _, tc := range cases {
		if tc.got != tc.want {
			t.Errorf("Key %s: got %q, want %q", tc.name, tc.got, tc.want)
		}
	}
}

// ---- dHash tests (5.4) ------------------------------------------------------

func TestComputeDHash_ReturnsHexString(t *testing.T) {
	img := solidImage(200, 200, color.Gray{Y: 128})
	h, err := photos.ComputeDHash(img)
	if err != nil {
		t.Fatalf("ComputeDHash error: %v", err)
	}
	if len(h) != 16 {
		t.Errorf("expected 16-char hex string, got %q (len %d)", h, len(h))
	}
	for _, c := range h {
		if !isHexChar(c) {
			t.Errorf("non-hex character %q in hash %q", c, h)
		}
	}
}

func TestComputeDHash_SimilarImages(t *testing.T) {
	// Two very similar images (same solid color, slightly different shades)
	// should produce hashes close in Hamming distance.
	img1 := solidImage(200, 200, color.RGBA{R: 100, G: 150, B: 200, A: 255})
	img2 := solidImage(200, 200, color.RGBA{R: 102, G: 150, B: 200, A: 255})

	h1, err := photos.ComputeDHash(img1)
	if err != nil {
		t.Fatalf("ComputeDHash img1: %v", err)
	}
	h2, err := photos.ComputeDHash(img2)
	if err != nil {
		t.Fatalf("ComputeDHash img2: %v", err)
	}

	dist := hammingDist(h1, h2)
	// Solid color images always produce the same hash (0 difference) because
	// there are no differences between adjacent pixels.
	if dist > 8 {
		t.Errorf("similar images have large Hamming distance %d (h1=%s, h2=%s)", dist, h1, h2)
	}
}

// ---- helpers ---------------------------------------------------------------

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func isHexChar(r rune) bool {
	return (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

func hammingDist(a, b string) int {
	var ua, ub uint64
	binary.Read(bytes.NewReader(mustDecodeHex(a)), binary.BigEndian, &ua) //nolint:errcheck
	binary.Read(bytes.NewReader(mustDecodeHex(b)), binary.BigEndian, &ub) //nolint:errcheck
	x := ua ^ ub
	count := 0
	for x != 0 {
		count += int(x & 1)
		x >>= 1
	}
	return count
}

func mustDecodeHex(s string) []byte {
	b := make([]byte, 8)
	for i := 0; i < 8; i++ {
		hi := hexVal(s[i*2])
		lo := hexVal(s[i*2+1])
		b[i] = hi<<4 | lo
	}
	return b
}

func hexVal(c byte) byte {
	switch {
	case c >= '0' && c <= '9':
		return c - '0'
	case c >= 'a' && c <= 'f':
		return c - 'a' + 10
	case c >= 'A' && c <= 'F':
		return c - 'A' + 10
	}
	return 0
}

// buildJPEGWithEXIF builds a JPEG with embedded EXIF including DateTimeOriginal
// and optionally GPS coordinates. This uses the goexif/tiff package to
// construct a minimal but valid EXIF block.
func buildJPEGWithEXIF(t *testing.T, dateTime string, lat, lng float64, hasGPS bool) []byte {
	t.Helper()

	// Register makernotes to avoid panics in some exif paths.
	exif.RegisterParsers(mknote.All...)

	// Build a minimal EXIF blob and inject it into a JPEG.
	// We use the tiff package to create the IFD structure.
	exifBytes := buildMinimalEXIF(t, dateTime, lat, lng, hasGPS)

	img := solidImage(100, 100, color.White)
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("jpeg.Encode: %v", err)
	}

	// Inject EXIF APP1 segment into the JPEG.
	return injectEXIF(t, raw.Bytes(), exifBytes)
}

// buildMinimalEXIF constructs a minimal EXIF (TIFF) blob containing
// DateTimeOriginal and optionally GPS IFD.
func buildMinimalEXIF(t *testing.T, dateTime string, lat, lng float64, hasGPS bool) []byte {
	t.Helper()

	// We'll construct the TIFF/EXIF blob manually as a byte slice.
	// Format: TIFF header (II) + IFD0 with ExifIFD pointer + optional GPS IFD pointer
	//         + ExifIFD with DateTimeOriginal + optional GPS IFD.

	_ = tiff.DTByte // ensure tiff package is imported

	var buf bytes.Buffer

	// Little-endian TIFF header
	buf.WriteString("II") // byte order: little endian
	writeU16LE(&buf, 42)  // TIFF magic
	writeU32LE(&buf, 8)   // offset to IFD0 (immediately after header)

	const (
		tagExifIFD       = 0x8769
		tagGPSIFD        = 0x8825
		tagDateTimeOrig  = 0x9003
		tagGPSLatRef     = 0x0001
		tagGPSLat        = 0x0002
		tagGPSLngRef     = 0x0003
		tagGPSLng        = 0x0004
		typeASCII uint16 = 2
		typeLONG  uint16 = 4
		typeRAT   uint16 = 5
	)

	dateTimeStr := dateTime + "\x00" // null-terminated ASCII
	dateTimeLen := uint32(len(dateTimeStr))

	// Layout plan (all offsets relative to start of TIFF data, i.e. after "Exif\x00\x00"):
	//   offset 8:  IFD0
	//     IFD0 count: 1 or 2 entries (ExifIFD, optionally GPSIFD)
	//     each entry: 12 bytes
	//     next IFD: 4 bytes
	//   IFD0 size: 2 + N*12 + 4
	ifd0EntryCount := uint16(1)
	if hasGPS {
		ifd0EntryCount = 2
	}
	ifd0Size := uint32(2 + int(ifd0EntryCount)*12 + 4)
	exifIFDOffset := uint32(8) + ifd0Size

	// ExifIFD: 1 entry (DateTimeOriginal) = 2 + 1*12 + 4 = 18 bytes
	exifIFDSize := uint32(18)
	dateTimeValueOffset := exifIFDOffset + exifIFDSize

	var gpsIFDOffset uint32
	if hasGPS {
		// GPS IFD starts after the DateTimeOriginal value data
		gpsIFDOffset = dateTimeValueOffset + dateTimeLen
	}

	// ----- Write IFD0 -----
	writeU16LE(&buf, ifd0EntryCount)
	writeIFDEntry(&buf, tagExifIFD, uint16(typeLONG), 1, exifIFDOffset)
	if hasGPS {
		writeIFDEntry(&buf, tagGPSIFD, uint16(typeLONG), 1, gpsIFDOffset)
	}
	writeU32LE(&buf, 0) // next IFD = none

	// ----- Write ExifIFD -----
	writeU16LE(&buf, 1) // 1 entry
	writeIFDEntryOffset(&buf, tagDateTimeOrig, typeASCII, dateTimeLen, dateTimeValueOffset)
	writeU32LE(&buf, 0) // next IFD = none

	// ----- Write DateTimeOriginal value -----
	buf.WriteString(dateTimeStr)

	if hasGPS {
		latDMS := decimalToDMS(abs64(lat))
		lngDMS := decimalToDMS(abs64(lng))

		// LatRef and LngRef are 2-char ASCII values that fit inline in the IFD
		// entry's value field (TIFF spec: values ≤4 bytes are stored inline).
		var latRefVal uint32 = 'N' // "N\0" inline: byte 0 = 'N', bytes 1-3 = 0
		if lat < 0 {
			latRefVal = 'S'
		}
		var lngRefVal uint32 = 'E' // "E\0" inline
		if lng < 0 {
			lngRefVal = 'W'
		}

		// GPS IFD: 4 entries = 2 + 4*12 + 4 = 54 bytes
		gpsIFDSize := uint32(54)
		gpsDataBase := gpsIFDOffset + gpsIFDSize

		// GPS data layout (only rational values, refs are inline):
		//   +0:  lat DMS (3 rationals = 24 bytes)
		//   +24: lng DMS (3 rationals = 24 bytes)
		latRatOffset := gpsDataBase
		lngRatOffset := gpsDataBase + 24

		// ----- Write GPS IFD -----
		writeU16LE(&buf, 4) // 4 entries
		// GPSLatitudeRef: inline "N\0" or "S\0"
		writeIFDEntry(&buf, tagGPSLatRef, typeASCII, 2, latRefVal)
		// GPSLatitude: 3 rationals at offset
		writeIFDEntry3Rat(&buf, tagGPSLat, typeRAT, latRatOffset)
		// GPSLongitudeRef: inline "E\0" or "W\0"
		writeIFDEntry(&buf, tagGPSLngRef, typeASCII, 2, lngRefVal)
		// GPSLongitude: 3 rationals at offset
		writeIFDEntry3Rat(&buf, tagGPSLng, typeRAT, lngRatOffset)
		writeU32LE(&buf, 0) // next IFD = none

		// ----- Write GPS rational data -----
		writeRational3(&buf, latDMS) // +0: 24 bytes
		writeRational3(&buf, lngDMS) // +24: 24 bytes
	}

	// Wrap in "Exif\x00\x00" header required by JPEG APP1.
	exifHeader := []byte("Exif\x00\x00")
	result := make([]byte, 0, len(exifHeader)+buf.Len())
	result = append(result, exifHeader...)
	result = append(result, buf.Bytes()...)
	return result
}

// writeU16LE writes a uint16 in little-endian byte order.
func writeU16LE(buf *bytes.Buffer, v uint16) {
	buf.WriteByte(byte(v))
	buf.WriteByte(byte(v >> 8))
}

// writeU32LE writes a uint32 in little-endian byte order.
func writeU32LE(buf *bytes.Buffer, v uint32) {
	buf.WriteByte(byte(v))
	buf.WriteByte(byte(v >> 8))
	buf.WriteByte(byte(v >> 16))
	buf.WriteByte(byte(v >> 24))
}

// writeIFDEntry writes a 12-byte IFD entry where the value fits inline (≤4 bytes).
func writeIFDEntry(buf *bytes.Buffer, tag uint16, typ uint16, count, value uint32) {
	writeU16LE(buf, tag)
	writeU16LE(buf, typ)
	writeU32LE(buf, count)
	writeU32LE(buf, value)
}

// writeIFDEntryOffset writes a 12-byte IFD entry where the value field holds an offset.
func writeIFDEntryOffset(buf *bytes.Buffer, tag, typ uint16, count, offset uint32) {
	writeU16LE(buf, tag)
	writeU16LE(buf, typ)
	writeU32LE(buf, count)
	writeU32LE(buf, offset)
}

// writeIFDEntry3Rat writes a 12-byte IFD entry for 3 RATIONAL values at offset.
func writeIFDEntry3Rat(buf *bytes.Buffer, tag, typ uint16, offset uint32) {
	writeU16LE(buf, tag)
	writeU16LE(buf, typ)
	writeU32LE(buf, 3) // 3 rationals
	writeU32LE(buf, offset)
}

// writeRational3 writes 3 rational values (each: numerator uint32, denominator uint32).
func writeRational3(buf *bytes.Buffer, dms [3][2]uint32) {
	for _, r := range dms {
		writeU32LE(buf, r[0])
		writeU32LE(buf, r[1])
	}
}

// decimalToDMS converts a decimal degree value to degrees/minutes/seconds rationals.
func decimalToDMS(deg float64) [3][2]uint32 {
	d := uint32(deg)
	rem := (deg - float64(d)) * 60
	m := uint32(rem)
	s := (rem - float64(m)) * 60
	// Encode seconds as rational with denominator 1000 to preserve precision.
	return [3][2]uint32{
		{d, 1},
		{m, 1},
		{uint32(s * 1000), 1000},
	}
}

func abs64(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

// injectEXIF inserts an APP1 EXIF segment into a JPEG byte slice.
// The EXIF data should already include the "Exif\x00\x00" prefix.
func injectEXIF(t *testing.T, jpegData, exifData []byte) []byte {
	t.Helper()

	if len(jpegData) < 2 || jpegData[0] != 0xFF || jpegData[1] != 0xD8 {
		t.Fatal("not a valid JPEG")
	}

	// APP1 marker: FF E1, followed by 2-byte length (length includes the 2 length bytes)
	app1Len := uint16(2 + len(exifData))
	var app1 bytes.Buffer
	app1.WriteByte(0xFF)
	app1.WriteByte(0xE1)
	app1.WriteByte(byte(app1Len >> 8))
	app1.WriteByte(byte(app1Len))
	app1.Write(exifData)

	// Insert after SOI marker (first 2 bytes).
	result := make([]byte, 0, len(jpegData)+app1.Len())
	result = append(result, jpegData[:2]...)
	result = append(result, app1.Bytes()...)
	result = append(result, jpegData[2:]...)
	return result
}
