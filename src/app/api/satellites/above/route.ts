import { NextRequest, NextResponse } from "next/server";

// N2YO API configuration
const N2YO_API_KEY = process.env.N2YO_API_KEY;
const N2YO_BASE_URL = "https://api.n2yo.com/rest/v1/satellite";

interface N2YOSatellite {
  satid: number;
  satname: string;
  intDesignator: string;
  launchDate: string;
  satlat: number;
  satlng: number;
  satalt: number;
}

interface N2YOAboveResponse {
  info: {
    category: string;
    transactionscount: number;
    satcount: number;
  };
  above: N2YOSatellite[];
}

interface SimplifiedSatellite {
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

// Cache for API responses to respect rate limits
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (longer to avoid rate limits)

function getCacheKey(params: Record<string, any>): string {
  return `above-${JSON.stringify(params)}`;
}

function getCachedData(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// N2YO category mapping for filtering
const N2YO_CATEGORIES = {
  "amateur-radio": 18,
  beidou: 35,
  brightest: 1,
  celestis: 45,
  "chinese-space-station": 54,
  cubesats: 32,
  "disaster-monitoring": 8,
  "earth-resources": 6,
  education: 29,
  engineering: 28,
  experimental: 19,
  flock: 48,
  galileo: 22,
  geodetic: 27,
  geostationary: 10,
  gps: 50,
  globalstar: 17,
  glonass: 51,
  goes: 5,
  gonets: 40,
  gorizont: 12,
  intelsat: 11,
  iridium: 15,
  irnss: 46,
  iss: 2,
  kuiper: 56,
  lemur: 49,
  military: 30,
  molniya: 14,
  "navy-navigation": 24,
  noaa: 4,
  o3b: 43,
  oneweb: 53,
  orbcomm: 16,
  parus: 38,
  qianfan: 55,
  qzss: 47,
  "radar-calibration": 31,
  raduga: 13,
  "russian-leo": 25,
  sbas: 23,
  "search-rescue": 7,
  "space-earth-science": 26,
  starlink: 52,
  strela: 39,
  tdrss: 9,
  tselina: 44,
  tsikada: 42,
  tsiklon: 41,
  tv: 34,
  weather: 3,
  westford: 37,
  "xm-sirius": 33,
  yaogan: 36,
};

export async function GET(request: NextRequest) {
  if (!N2YO_API_KEY) {
    return NextResponse.json(
      { error: "N2YO API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const observerLat = parseFloat(searchParams.get("observerLat") || "0");
    const observerLon = parseFloat(searchParams.get("observerLon") || "0");
    const observerAlt = parseFloat(searchParams.get("observerAlt") || "0");
    const searchRadius = parseInt(searchParams.get("searchRadius") || "90");
    const categories = searchParams.get("categories")?.split(",") || ["all"];
    const includeAll = categories.includes("all");

    // Build cache key
    const cacheKey = getCacheKey({
      observerLat,
      observerLon,
      observerAlt,
      searchRadius,
      categories: categories.sort(),
    });

    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    let allSatellites: SimplifiedSatellite[] = [];

    if (includeAll) {
      // Get all satellites (category 0)
      const url = `${N2YO_BASE_URL}/above/${observerLat}/${observerLon}/${observerAlt}/${searchRadius}/0/&apiKey=${N2YO_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`N2YO API error: ${response.status} - ${errorText}`);
        console.error(`N2YO API URL: ${url}`);
        return NextResponse.json(
          {
            error: `N2YO API error: ${response.statusText}`,
            details: errorText,
            url: url.replace(N2YO_API_KEY, "HIDDEN_API_KEY"),
          },
          { status: response.status }
        );
      }

      const data: any = await response.json();

      // Handle rate limit errors
      if (
        data.error &&
        data.error.includes("exceeded the number of transactions")
      ) {
        throw new Error(
          "N2YO API rate limit exceeded. Please try again later."
        );
      }

      // Handle different response formats
      const satellites = data.above || data;
      if (!Array.isArray(satellites)) {
        console.error("Response data:", data);
        throw new Error(
          `Invalid response format: expected array, got ${typeof satellites}`
        );
      }

      allSatellites = satellites.map((sat: any) => ({
        name: sat.satname,
        noradId: sat.satid.toString(),
        category: data.info.category.toLowerCase().replace(/\s+/g, "-"),
        position: {
          lat: sat.satlat,
          lon: sat.satlng,
          alt: sat.satalt,
        },
        visible: true, // All satellites from "above" endpoint are visible
        launchDate: sat.launchDate,
        intDesignator: sat.intDesignator,
      }));
    } else {
      // Get satellites for specific categories
      for (const category of categories) {
        const categoryId =
          N2YO_CATEGORIES[category as keyof typeof N2YO_CATEGORIES];
        if (!categoryId) {
          console.warn(`Unknown category: ${category}`);
          continue;
        }

        const url = `${N2YO_BASE_URL}/above/${observerLat}/${observerLon}/${observerAlt}/${searchRadius}/${categoryId}/&apiKey=${N2YO_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `N2YO API error for category ${category}: ${response.status} - ${errorText}`
          );
          console.error(`N2YO API URL: ${url}`);
          continue;
        }

        const data: any = await response.json();

        // Handle rate limit errors
        if (
          data.error &&
          data.error.includes("exceeded the number of transactions")
        ) {
          console.warn(`Rate limit exceeded for category ${category}`);
          continue;
        }

        // Handle null responses (some categories may not have satellites)
        if (!data || data === null) {
          console.log(`No satellites found for category ${category}`);
          continue;
        }

        // Handle different response formats
        const satellites = data.above || data;
        if (!Array.isArray(satellites)) {
          console.warn(
            `Invalid response format for category ${category}: expected array, got ${typeof satellites}`
          );
          continue;
        }

        const categorySatellites = satellites.map((sat: any) => ({
          name: sat.satname,
          noradId: sat.satid.toString(),
          category: category,
          position: {
            lat: sat.satlat,
            lon: sat.satlng,
            alt: sat.satalt,
          },
          visible: true,
          launchDate: sat.launchDate,
          intDesignator: sat.intDesignator,
        }));

        allSatellites.push(...categorySatellites);
      }
    }

    const result = {
      satellites: allSatellites,
      count: allSatellites.length,
      observer: {
        lat: observerLat,
        lon: observerLon,
        alt: observerAlt,
      },
      searchRadius,
      categories: includeAll ? ["all"] : categories,
      timestamp: Date.now(),
    };

    // Cache the response
    setCachedData(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching satellites above:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch satellite data",
        details: errorMessage,
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}
