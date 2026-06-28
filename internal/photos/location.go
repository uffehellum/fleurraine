// Package photos - location detection helpers
package photos

import (
	"fmt"
	"math"
)

// Known garden locations
const (
	// Camano Flower Garden: 45 E N Camano Dr, Camano Island, WA 98282
	camanoLat = 48.1847
	camanoLng = -122.5147

	// Seattle Flower Garden: 1241 NE 89th St, Seattle, WA 98115
	seattleLat = 47.6962
	seattleLng = -122.3321

	// Radius in degrees (~1km = 0.01 degrees at this latitude)
	locationRadius = 0.01
)

// DetectLocation determines the location name based on GPS coordinates.
// Returns one of:
// - "Camano Flower Garden" if within radius of Camano location
// - "Seattle Flower Garden" if within radius of Seattle location
// - Formatted coordinates if GPS available but outside known locations
// - Empty string if no GPS data
func DetectLocation(lat, lng *float64) string {
	if lat == nil || lng == nil {
		return ""
	}

	// Check if within Camano radius
	if isWithinRadius(*lat, *lng, camanoLat, camanoLng, locationRadius) {
		return "Camano Flower Garden"
	}

	// Check if within Seattle radius
	if isWithinRadius(*lat, *lng, seattleLat, seattleLng, locationRadius) {
		return "Seattle Flower Garden"
	}

	// Outside known locations - return formatted coordinates
	return formatCoordinates(*lat, *lng)
}

// isWithinRadius checks if a point (lat, lng) is within radius degrees of (centerLat, centerLng)
func isWithinRadius(lat, lng, centerLat, centerLng, radius float64) bool {
	distance := math.Sqrt(math.Pow(lat-centerLat, 2) + math.Pow(lng-centerLng, 2))
	return distance <= radius
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
