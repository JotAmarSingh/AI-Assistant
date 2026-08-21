/**
 * Location & Geofencing Engine for DayTrace
 * Implements Section 13 location-based reminder triggers & continuous geofence monitoring
 */

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

// Default approximate reference locations (can be calibrated dynamically by user)
export const KNOWN_LOCATIONS: { [key: string]: GeoCoordinate } = {
  HOME: { latitude: 37.7749, longitude: -122.4194 },
  OFFICE: { latitude: 37.7899, longitude: -122.4008 },
  GYM: { latitude: 37.7833, longitude: -122.4167 },
};

/**
 * Calculates distance in meters between two coordinates (Haversine formula)
 */
export function calculateDistanceMeters(coord1: GeoCoordinate, coord2: GeoCoordinate): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (coord1.latitude * Math.PI) / 180;
  const phi2 = (coord2.latitude * Math.PI) / 180;
  const deltaPhi = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLambda = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class LocationService {
  private watchId: number | null = null;
  private onLocationChangeCallback?: (locationName: string, coords: GeoCoordinate) => void;

  public startWatching(onLocationChange: (locationName: string, coords: GeoCoordinate) => void) {
    this.onLocationChangeCallback = onLocationChange;

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords: GeoCoordinate = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          this.evaluateProximity(coords);
        },
        (err) => {
          console.warn('Geolocation watching error', err.message);
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 }
      );
    }
  }

  public stopWatching() {
    if (this.watchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private evaluateProximity(currentCoords: GeoCoordinate) {
    for (const [name, targetCoords] of Object.entries(KNOWN_LOCATIONS)) {
      const distance = calculateDistanceMeters(currentCoords, targetCoords);
      if (distance <= 300) {
        // within 300m geofence radius
        const formatted = name.charAt(0) + name.slice(1).toLowerCase();
        this.onLocationChangeCallback?.(formatted, currentCoords);
        return;
      }
    }
  }
}

export const locationService = new LocationService();
