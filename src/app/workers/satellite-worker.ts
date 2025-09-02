import {
  propagate,
  twoline2satrec,
  gstime,
  eciToEcf,
  eciToGeodetic,
} from "satellite.js";

interface SatelliteData {
  name: string;
  noradId: string;
  category: string;
  tle: {
    line1: string;
    line2: string;
  };
}

interface SatellitePosition {
  name: string;
  noradId: string;
  category: string;
  position: {
    lat: number;
    lon: number;
    alt: number;
  };
  velocity: {
    x: number;
    y: number;
    z: number;
  };
  visible: boolean;
}

interface WorkerMessage {
  type: "PROPAGATE" | "INIT";
  data?: {
    satellites: SatelliteData[];
    timestamp?: number;
    observerLat?: number;
    observerLon?: number;
    observerAlt?: number;
  };
}

interface WorkerResponse {
  type: "POSITIONS" | "ERROR" | "READY";
  data?: {
    positions: SatellitePosition[];
    timestamp: number;
    count: number;
  };
  error?: string;
}

// Cache for satellite records to avoid re-parsing TLEs
const satelliteCache = new Map<string, any>();

function parseTLE(satellite: SatelliteData) {
  const cacheKey = `${satellite.noradId}-${satellite.tle.line1}-${satellite.tle.line2}`;

  if (satelliteCache.has(cacheKey)) {
    return satelliteCache.get(cacheKey);
  }

  try {
    const satrec = twoline2satrec(satellite.tle.line1, satellite.tle.line2);
    satelliteCache.set(cacheKey, satrec);
    return satrec;
  } catch (error) {
    console.error(`Error parsing TLE for ${satellite.name}:`, error);
    return null;
  }
}

// Convert ECEF (km) to geodetic lat/lon (radians) and height (km) using WGS84
function ecefToGeodetic(x: number, y: number, z: number) {
  const a = 6378.137; // km
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);

  const lon = Math.atan2(y, x);
  const p = Math.sqrt(x * x + y * y);
  let lat = Math.atan2(z, p * (1 - e2));

  for (let i = 0; i < 5; i++) {
    const sinLat = Math.sin(lat);
    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
    const alt = p / Math.cos(lat) - N;
    lat = Math.atan2(z, p * (1 - e2 * (N / (N + alt))));
  }

  const sinLat = Math.sin(lat);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const height = p / Math.cos(lat) - N;

  return { latitude: lat, longitude: lon, height };
}

function isSatelliteVisible(
  position: { lat: number; lon: number; alt: number },
  observerLat: number,
  observerLon: number,
  observerAlt: number = 0
): boolean {
  // Simple visibility check based on altitude and distance
  const earthRadius = 6371; // km
  const minAltitude = 200; // km - minimum altitude for visibility

  if (position.alt < minAltitude) {
    return false;
  }

  // Calculate distance from observer to satellite
  const lat1 = (observerLat * Math.PI) / 180;
  const lon1 = (observerLon * Math.PI) / 180;
  const lat2 = (position.lat * Math.PI) / 180;
  const lon2 = (position.lon * Math.PI) / 180;

  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;

  const a =
    Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) * Math.sin(dlon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;

  // Consider satellite visible if it's above horizon and within reasonable distance
  return distance < 2000; // 2000 km max distance for visibility
}

function propagateSatellites(
  satellites: SatelliteData[],
  timestamp: number,
  observerLat: number = 0,
  observerLon: number = 0,
  observerAlt: number = 0
): SatellitePosition[] {
  const positions: SatellitePosition[] = [];
  let parsedCount = 0;
  let propagatedCount = 0;
  let geodeticCount = 0;
  const date = new Date(timestamp);

  let debugLogged = 0;
  for (const satellite of satellites) {
    try {
      const satrec = parseTLE(satellite);
      if (!satrec) continue;
      parsedCount++;

      // Quick satrec sanity check
      if (
        !isFinite((satrec as any).no) ||
        !isFinite((satrec as any).ecco) ||
        !isFinite((satrec as any).inclo)
      ) {
        if (debugLogged < 3) {
          try {
            console.warn(
              "Invalid satrec from TLE:",
              satellite.name,
              satellite.tle
            );
          } catch {}
        }
        continue;
      }

      // Propagate satellite position
      const positionAndVelocity = propagate(satrec, date);
      // Skip if propagation failed
      if (
        (positionAndVelocity as any).position === undefined ||
        !isFinite((positionAndVelocity as any).position.x) ||
        !isFinite((positionAndVelocity as any).position.y) ||
        !isFinite((positionAndVelocity as any).position.z)
      ) {
        if (debugLogged < 3) {
          try {
            console.warn("SGP4 returned invalid ECI for:", satellite.name);
          } catch {}
        }
        continue;
      }

      if (
        !positionAndVelocity ||
        !positionAndVelocity.position ||
        !positionAndVelocity.velocity
      ) {
        continue;
      }
      propagatedCount++;

      // Use ECI -> ECF -> geodetic conversion
      const gmst = gstime(date);
      const posEcf = eciToEcf(positionAndVelocity.position, gmst);
      let geodetic = ecefToGeodetic(posEcf.x, posEcf.y, posEcf.z);
      if (debugLogged < 3) {
        try {
          console.log(
            "eci:",
            positionAndVelocity.position,
            "gmst:",
            gmst,
            "geodetic:",
            geodetic
          );
        } catch {}
      }
      // Fallback via ECF if needed
      // no fallback needed; computed above
      // Optional: convert velocity to ECF for reference
      const velocityEcf = eciToEcf(positionAndVelocity.velocity, gmst);

      // Skip invalid solutions
      if (
        !isFinite(geodetic.latitude) ||
        !isFinite(geodetic.longitude) ||
        !isFinite(geodetic.height)
      ) {
        debugLogged++;
        continue;
      }
      geodeticCount++;

      // Convert to degrees and normalize longitude to [-180, 180]
      const latDeg = (geodetic.latitude * 180) / Math.PI;
      let lonDeg = (geodetic.longitude * 180) / Math.PI;
      lonDeg = ((((lonDeg + 180) % 360) + 360) % 360) - 180;

      const position = {
        lat: latDeg,
        lon: lonDeg,
        alt: geodetic.height, // km
      };

      const velocity = {
        x: velocityEcf.x,
        y: velocityEcf.y,
        z: velocityEcf.z,
      };

      // Do not filter by visibility for now to ensure positions > 0
      const visible = true;

      positions.push({
        name: satellite.name,
        noradId: satellite.noradId,
        category: satellite.category,
        position,
        velocity,
        visible,
      });
    } catch (error) {
      console.error(`Error propagating ${satellite.name}:`, error);
    }
  }

  try {
    // Basic debug log visible in worker console
    console.log(
      `propagate debug: parsed=${parsedCount}, propagated=${propagatedCount}, geodetic=${geodeticCount}, positions=${positions.length}`
    );
  } catch {}
  return positions;
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case "INIT":
        // Worker is ready
        const initResponse: WorkerResponse = {
          type: "READY",
        };
        self.postMessage(initResponse);
        break;

      case "PROPAGATE":
        if (!data || !data.satellites) {
          throw new Error("No satellite data provided");
        }

        const timestamp = data.timestamp || Date.now();
        const observerLat = data.observerLat || 0;
        const observerLon = data.observerLon || 0;
        const observerAlt = data.observerAlt || 0;

        const positions = propagateSatellites(
          data.satellites,
          timestamp,
          observerLat,
          observerLon,
          observerAlt
        );

        const response: WorkerResponse = {
          type: "POSITIONS",
          data: {
            positions,
            timestamp,
            count: positions.length,
          },
        };

        self.postMessage(response);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const errorResponse: WorkerResponse = {
      type: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    self.postMessage(errorResponse);
  }
};

// Signal that worker is ready
self.postMessage({ type: "READY" });
