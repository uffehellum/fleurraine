// Package photos - location detection helpers
package photos

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"
)

// Known garden locations
const (
	// Camano Flower Garden: 45 E N Camano Dr, Camano Island, WA 98282
	camanoLat = 48.1847
	camanoLng = -122.5147

	// Seattle Flower Garden: 1241 NE 89th St, Seattle, WA 98115
	seattleLat = 47.6962
	seattleLng = -122.3321
)

type nominatimResponse struct {
	DisplayName string `json:"display_name"`
	Address     struct {
		HouseNumber string `json:"house_number"`
		Road        string `json:"road"`
		City        string `json:"city"`
		Town        string `json:"town"`
		Village     string `json:"village"`
		County      string `json:"county"`
		State       string `json:"state"`
		Postcode    string `json:"postcode"`
		Country     string `json:"country"`
	} `json:"address"`
}

// haversineDistance calculates the great-circle distance between two points in meters
func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000.0 // meters
	dLat := (lat2 - lat1) * math.Pi / 180.0
	dLon := (lon2 - lon1) * math.Pi / 180.0

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180.0)*math.Cos(lat2*math.Pi/180.0)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}

// DetectLocation determines the location name based on GPS coordinates.
// Returns one of:
// - "Camano Flower Garden" if within 300m of Camano location
// - "Seattle Flower Garden" if within 300m of Seattle location
// - Geocoded street address via OpenStreetMap Nominatim
// - Formatted coordinates if offline or geocoding fails
// - Empty string if no GPS data
func DetectLocation(lat, lng *float64) string {
	if lat == nil || lng == nil {
		return ""
	}

	// 1. Check if within 300 meters of Camano Flower Garden
	distCamano := haversineDistance(*lat, *lng, camanoLat, camanoLng)
	if distCamano <= 300.0 {
		return "Camano Flower Garden"
	}

	// 2. Check if within 300 meters of Seattle Flower Garden
	distSeattle := haversineDistance(*lat, *lng, seattleLat, seattleLng)
	if distSeattle <= 300.0 {
		return "Seattle Flower Garden"
	}

	// 3. Fallback: Reverse Geocode via OpenStreetMap Nominatim
	address, err := reverseGeocode(*lat, *lng)
	if err == nil && address != "" {
		return address
	}

	// 4. Ultimate fallback: return formatted coordinates
	return formatCoordinates(*lat, *lng)
}

// reverseGeocode performs reverse geocoding via Nominatim OpenStreetMap API
func reverseGeocode(lat, lng float64) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	url := fmt.Sprintf("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%f&lon=%f", lat, lng)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}

	// Nominatim policy requires a valid User-Agent
	req.Header.Set("User-Agent", "FleurraineFlowerStandCompanion/1.0 (uffe.hellum@gmail.com)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("geocoder returned status %d", resp.StatusCode)
	}

	var nominatim nominatimResponse
	if err := json.NewDecoder(resp.Body).Decode(&nominatim); err != nil {
		return "", err
	}

	// Construct a clean, compact street address
	var parts []string
	street := ""
	if nominatim.Address.HouseNumber != "" && nominatim.Address.Road != "" {
		street = nominatim.Address.HouseNumber + " " + nominatim.Address.Road
	} else if nominatim.Address.Road != "" {
		street = nominatim.Address.Road
	}

	if street != "" {
		parts = append(parts, street)
	}

	city := ""
	if nominatim.Address.City != "" {
		city = nominatim.Address.City
	} else if nominatim.Address.Town != "" {
		city = nominatim.Address.Town
	} else if nominatim.Address.Village != "" {
		city = nominatim.Address.Village
	}

	if city != "" {
		parts = append(parts, city)
	}

	if nominatim.Address.State != "" {
		parts = append(parts, nominatim.Address.State)
	}

	if len(parts) > 0 {
		return strings.Join(parts, ", "), nil
	}

	// Fallback to display name if details aren't parsed
	if nominatim.DisplayName != "" {
		// Truncate to first 3 segments of display name to avoid long strings
		segments := strings.Split(nominatim.DisplayName, ", ")
		if len(segments) > 3 {
			return strings.Join(segments[:3], ", "), nil
		}
		return nominatim.DisplayName, nil
	}

	return "", fmt.Errorf("no address found")
}

// formatCoordinates formats GPS coordinates as a readable string
func formatCoordinates(lat, lng float64) string {
	latDir := "N"
	if lat < 0 {
		latDir = "S"
		lat = -lat
	}

	lngDir := "E"
	if lng < 0 {
		lngDir = "W"
		lng = -lng
	}

	return fmt.Sprintf("%.4f°%s, %.4f°%s", lat, latDir, lng, lngDir)
}
