import { useState, useEffect, useRef, useCallback } from "react";
import { useSatellitePositionsStore } from "@/app/state/satelliteStore";

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

interface UseSatellitesOptions {
  categories?: string[];
  updateInterval?: number;
  observerPosition?: {
    lat: number;
    lon: number;
    alt: number;
  };
}

interface UseSatellitesReturn {
  satellites: SatellitePosition[];
  loading: boolean;
  error: string | null;
  lastUpdate: number | null;
  categories: string[];
  setCategories: (categories: string[]) => void;
  refresh: () => Promise<void>;
}

export function useSatellites(
  options: UseSatellitesOptions = {}
): UseSatellitesReturn {
  const {
    categories: initialCategories = [
      "active",
      "starlink",
      "gnss",
      "weather",
      "geo",
      "iridium",
      "amateur",
      "noaa",
      "visual",
    ],
    updateInterval = 500, // 500ms for smooth real-time tracking
    observerPosition = { lat: 0, lon: 0, alt: 0 },
  } = options;

  const [satellites, setSatellites] = useState<SatellitePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>(initialCategories);

  const workerRef = useRef<Worker | null>(null);
  const satelliteDataRef = useRef<SatelliteData[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCategoriesRef = useRef<string>("");

  // Initialize Web Worker
  useEffect(() => {
    if (typeof Worker !== "undefined") {
      workerRef.current = new Worker(
        new URL("../workers/satellite-worker.ts", import.meta.url)
      );

      workerRef.current.onmessage = (event) => {
        const { type, data, error: workerError } = event.data;

        switch (type) {
          case "READY":
            console.log("Satellite worker ready");
            break;

          case "POSITIONS":
            if (data) {
              try {
                console.log("Worker POSITIONS:", data.count);
              } catch {}
              setSatellites(data.positions);
              setLastUpdate(data.timestamp);
              setError(null);
            }
            break;

          case "POSITIONS_F32":
            if (data && data.buffer && typeof data.count === "number") {
              try {
                const f32 = new Float32Array(data.buffer as ArrayBuffer);
                useSatellitePositionsStore
                  .getState()
                  .setPositionsF32(f32, data.count);
                setLastUpdate(data.timestamp ?? Date.now());
              } catch (e) {
                console.error("Failed to process POSITIONS_F32", e);
              }
            }
            break;

          case "ERROR":
            setError(workerError || "Worker error");
            break;
        }
      };

      workerRef.current.onerror = (error) => {
        console.error("Worker error:", error);
        setError("Worker error occurred");
      };
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Fetch satellite TLE data
  const fetchSatelliteData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const categoriesParam = categories.join(",");
      const categoriesChanged = lastCategoriesRef.current !== categoriesParam;
      const forceParam = categoriesChanged ? "&force=true" : "";
      const response = await fetch(
        `/api/satellites/fetch-tle?categories=${categoriesParam}&compressed=false${forceParam}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch satellite data: ${response.statusText}`
        );
      }

      // Handle response (now uncompressed by default)
      const text = await response.text();
      const satelliteData: SatelliteData[] = JSON.parse(text);

      satelliteDataRef.current = satelliteData;
      console.log(`Loaded ${satelliteData.length} satellites`);
      lastCategoriesRef.current = categoriesParam;
      // Immediately trigger a propagation so UI updates without waiting for the next tick
      if (workerRef.current && satelliteDataRef.current.length > 0) {
        workerRef.current.postMessage({
          type: "PROPAGATE",
          data: {
            satellites: satelliteDataRef.current,
            timestamp: Date.now(),
            observerLat: observerPosition.lat,
            observerLon: observerPosition.lon,
            observerAlt: observerPosition.alt,
          },
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch satellite data";
      setError(errorMessage);
      console.error("Error fetching satellite data:", err);
    } finally {
      setLoading(false);
    }
  }, [categories]);

  // Decompress gzipped data
  const decompressGzip = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      // Check if DecompressionStream is available (modern browsers)
      if (typeof DecompressionStream !== "undefined") {
        const stream = new DecompressionStream("gzip");
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        // Write the compressed data
        await writer.write(arrayBuffer);
        await writer.close();

        // Read the decompressed data
        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }

        // Combine chunks and convert to string
        const totalLength = chunks.reduce(
          (acc, chunk) => acc + chunk.length,
          0
        );
        const result = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        return new TextDecoder().decode(result);
      } else {
        // Fallback: try to parse as JSON directly (in case it's not actually gzipped)
        const text = new TextDecoder().decode(arrayBuffer);
        return text;
      }
    } catch (error) {
      console.error("Decompression error:", error);
      // Fallback: try to parse as JSON directly
      const text = new TextDecoder().decode(arrayBuffer);
      return text;
    }
  };

  // Propagate satellite positions
  const propagatePositions = useCallback(() => {
    if (workerRef.current && satelliteDataRef.current.length > 0) {
      workerRef.current.postMessage({
        type: "PROPAGATE",
        data: {
          satellites: satelliteDataRef.current,
          timestamp: Date.now(),
          observerLat: observerPosition.lat,
          observerLon: observerPosition.lon,
          observerAlt: observerPosition.alt,
        },
      });
    }
  }, [observerPosition]);

  // Set up propagation interval
  useEffect(() => {
    // Always keep the propagation ticking; it will no-op if no data yet
    propagatePositions();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(propagatePositions, updateInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [propagatePositions, updateInterval]);

  // Fetch data when categories change
  useEffect(() => {
    fetchSatelliteData();
  }, [fetchSatelliteData]);

  // Refresh function
  const refresh = useCallback(async () => {
    await fetchSatelliteData();
  }, [fetchSatelliteData]);

  return {
    satellites,
    loading,
    error,
    lastUpdate,
    categories,
    setCategories,
    refresh,
  };
}
