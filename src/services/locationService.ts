/**
 * Location & Geofencing Engine for DayTrace
 * Primary: Real Google Play Services Geofencing via DayTraceNative plugin
 * Fallback: Geolocation watchPosition for browser preview
 */

import { DayTraceNative, isNativeAndroid } from './nativeBridge';
import { GeofenceLocation, IgnoredLocationCluster } from '../types';
import { PluginListenerHandle } from '@capacitor/core';

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface LocationLearningOptions {
  enabled: boolean;
  dwellMinutes: number;
  ignoredClusters: IgnoredLocationCluster[];
  onNewLocationDwell: (coords: GeoCoordinate) => void;
}

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
  private onLocationChangeCallback?: (locationName: string, coords?: GeoCoordinate) => void;
  private nativeGeofenceHandle: PluginListenerHandle | null = null;
  private dwellCandidate: { coords: GeoCoordinate; firstSeenAt: number; prompted: boolean } | null = null;
  private learningOptions?: LocationLearningOptions;

  public async startWatching(
    onLocationChange: (locationName: string, coords?: GeoCoordinate) => void,
    userLocations?: GeofenceLocation[],
    learningOptions?: LocationLearningOptions,
  ) {
    this.onLocationChangeCallback = onLocationChange;
    this.learningOptions = learningOptions;

    // 1. PRIMARY: Register native geofences with Android Play Services
    if (isNativeAndroid() && userLocations && userLocations.length > 0) {
      try {
        if (this.nativeGeofenceHandle) {
          await this.nativeGeofenceHandle.remove();
        }

        this.nativeGeofenceHandle = await DayTraceNative.addListener('geofenceTransition', (data) => {
          console.log('Native geofence transition received:', data);
          this.onLocationChangeCallback?.(data.locationName);
        });

        await DayTraceNative.registerGeofences({ locations: userLocations });
      } catch (e) {
        console.warn('Native geofence registration warning:', e);
      }
    }

    // 2. Browser / WebView Geolocation watcher fallback
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords: GeoCoordinate = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          this.evaluateProximity(coords, userLocations);
        },
        (err) => {
          console.warn('Geolocation watching error', err.message);
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 }
      );
    }
  }

  public async syncLocationsToNative(locations: GeofenceLocation[]) {
    if (isNativeAndroid() && locations.length > 0) {
      try {
        await DayTraceNative.registerGeofences({ locations });
      } catch (e) {
        console.warn('Failed to sync geofences to native client:', e);
      }
    }
  }

  public async stopWatching() {
    if (this.nativeGeofenceHandle) {
      await this.nativeGeofenceHandle.remove();
      this.nativeGeofenceHandle = null;
    }

    if (isNativeAndroid()) {
      try {
        await DayTraceNative.removeAllGeofences();
      } catch {
        // ignore
      }
    }

    if (this.watchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.dwellCandidate = null;
  }

  private evaluateProximity(currentCoords: GeoCoordinate, locations?: GeofenceLocation[]) {
    for (const loc of locations || []) {
      const distance = calculateDistanceMeters(currentCoords, { latitude: loc.latitude, longitude: loc.longitude });
      if (distance <= (loc.radiusMeters || 200)) {
        this.dwellCandidate = null;
        this.onLocationChangeCallback?.(loc.name, currentCoords);
        return;
      }
    }

    const learning = this.learningOptions;
    if (!learning?.enabled) return;
    const isIgnored = learning.ignoredClusters.some((cluster) =>
      calculateDistanceMeters(currentCoords, cluster) <= (cluster.radiusMeters || 200),
    );
    if (isIgnored) {
      this.dwellCandidate = null;
      return;
    }

    const now = Date.now();
    if (!this.dwellCandidate || calculateDistanceMeters(currentCoords, this.dwellCandidate.coords) > 100) {
      this.dwellCandidate = { coords: currentCoords, firstSeenAt: now, prompted: false };
      return;
    }
    const requiredMillis = Math.max(5, learning.dwellMinutes || 10) * 60_000;
    if (!this.dwellCandidate.prompted && now - this.dwellCandidate.firstSeenAt >= requiredMillis) {
      this.dwellCandidate.prompted = true;
      learning.onNewLocationDwell(currentCoords);
    }
  }
}

export const locationService = new LocationService();
