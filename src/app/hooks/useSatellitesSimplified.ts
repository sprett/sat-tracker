import { useState, useEffect, useCallback } from "react";

interface SatellitePosition {
  name: string;
  noradId: string;
  category: string;
  position: {
    lat: number;
    lon: number;
    alt: number;
  };
  visible: boolean;
  launchDate?: string;
  intDesignator?: string;
}

interface UseSatellitesSimplifiedOptions {
  categories?: string[];
  updateInterval?: number;
  observerPosition?: {
    lat: number;
    lon: number;
    alt: number;
  };
  searchRadius?: number;
}

interface UseSatellitesSimplifiedReturn {
  satellites: SatellitePosition[];
  loading: boolean;
  error: string | null;
  lastUpdate: number | null;
  categories: string[];
  setCategories: (categories: string[]) => void;
  refresh: () => Promise<void>;
  observerPosition: {
    lat: number;
    lon: number;
    alt: number;
  };
  setObserverPosition: (position: {
    lat: number;
    lon: number;
    alt: number;
  }) => void;
}

export function useSatellitesSimplified(
  options: UseSatellitesSimplifiedOptions = {}
): UseSatellitesSimplifiedReturn {
  const {
    categories: initialCategories = ["starlink", "iss", "gps", "weather"],
    updateInterval = 300000, // 5 minutes (N2YO rate limit friendly)
    observerPosition: initialObserverPosition = { lat: 0, lon: 0, alt: 0 },
    searchRadius = 90, // 90 degrees = all satellites above horizon
  } = options;

  const [satellites, setSatellites] = useState<SatellitePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [observerPosition, setObserverPosition] = useState(
    initialObserverPosition
  );

  // Fetch satellite data from N2YO API
  const fetchSatelliteData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const categoriesParam = categories.join(",");
      const url = `/api/satellites/above?observerLat=${observerPosition.lat}&observerLon=${observerPosition.lon}&observerAlt=${observerPosition.alt}&searchRadius=${searchRadius}&categories=${categoriesParam}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch satellite data: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.satellites) {
        setSatellites(data.satellites);
        setLastUpdate(data.timestamp);
        console.log(`Loaded ${data.satellites.length} satellites from N2YO`);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch satellite data";
      setError(errorMessage);
      console.error("Error fetching satellite data:", err);
    } finally {
      setLoading(false);
    }
  }, [categories, observerPosition, searchRadius]);

  // Set up automatic refresh
  useEffect(() => {
    // Initial fetch
    fetchSatelliteData();

    // Set up interval for updates
    const interval = setInterval(fetchSatelliteData, updateInterval);

    return () => clearInterval(interval);
  }, [fetchSatelliteData, updateInterval]);

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
    observerPosition,
    setObserverPosition,
  };
}
