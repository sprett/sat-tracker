import { NextRequest, NextResponse } from "next/server";

// N2YO API configuration
const N2YO_API_KEY = process.env.N2YO_API_KEY;
const N2YO_BASE_URL = "https://api.n2yo.com/rest/v1/satellite";

interface N2YORequest {
  noradId: string;
  observerLat: number;
  observerLon: number;
  observerAlt: number;
  seconds: number;
}

interface N2YOPass {
  startAz: number;
  startAzCompass: string;
  startEl: number;
  startUTC: number;
  maxAz: number;
  maxAzCompass: string;
  maxEl: number;
  maxUTC: number;
  endAz: number;
  endAzCompass: string;
  endEl: number;
  endUTC: number;
  mag: number;
  duration: number;
}

interface N2YOPosition {
  satlatitude: number;
  satlongitude: number;
  sataltitude: number;
  azimuth: number;
  elevation: number;
  ra: number;
  dec: number;
  timestamp: number;
}

// Cache for API responses to respect rate limits
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(endpoint: string, params: Record<string, any>): string {
  return `${endpoint}-${JSON.stringify(params)}`;
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

// Get satellites above observer location or other endpoints
export async function GET(request: NextRequest) {
  if (!N2YO_API_KEY) {
    return NextResponse.json(
      { error: "N2YO API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");
    const noradId = searchParams.get("noradId");
    const observerLat = parseFloat(searchParams.get("observerLat") || "0");
    const observerLon = parseFloat(searchParams.get("observerLon") || "0");
    const observerAlt = parseFloat(searchParams.get("observerAlt") || "0");
    const days = parseInt(searchParams.get("days") || "10");
    const minElevation = parseFloat(searchParams.get("minElevation") || "10");
    const searchRadius = parseInt(searchParams.get("searchRadius") || "90");
    const categoryId = parseInt(searchParams.get("categoryId") || "0");

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing required parameter: endpoint" },
        { status: 400 }
      );
    }

    const cacheKey = getCacheKey(endpoint, {
      noradId,
      observerLat,
      observerLon,
      observerAlt,
      days,
      minElevation,
      searchRadius,
      categoryId,
    });

    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    let url: string;
    let response: Response;

    switch (endpoint) {
      case "above":
        // New simplified endpoint - get all satellites above observer
        url = `${N2YO_BASE_URL}/above/${observerLat}/${observerLon}/${observerAlt}/${searchRadius}/${categoryId}/&apiKey=${N2YO_API_KEY}`;
        response = await fetch(url);
        break;

      case "visualpasses":
        if (!noradId) {
          return NextResponse.json(
            { error: "Missing required parameter: noradId" },
            { status: 400 }
          );
        }
        url = `${N2YO_BASE_URL}/visualpasses/${noradId}/${observerLat}/${observerLon}/${observerAlt}/${days}/${minElevation}/&apiKey=${N2YO_API_KEY}`;
        response = await fetch(url);
        break;

      case "radiopasses":
        if (!noradId) {
          return NextResponse.json(
            { error: "Missing required parameter: noradId" },
            { status: 400 }
          );
        }
        url = `${N2YO_BASE_URL}/radiopasses/${noradId}/${observerLat}/${observerLon}/${observerAlt}/${days}/${minElevation}/&apiKey=${N2YO_API_KEY}`;
        response = await fetch(url);
        break;

      case "positions":
        if (!noradId) {
          return NextResponse.json(
            { error: "Missing required parameter: noradId" },
            { status: 400 }
          );
        }
        const seconds = parseInt(searchParams.get("seconds") || "300");
        url = `${N2YO_BASE_URL}/positions/${noradId}/${observerLat}/${observerLon}/${observerAlt}/${seconds}/&apiKey=${N2YO_API_KEY}`;
        response = await fetch(url);
        break;

      case "tle":
        if (!noradId) {
          return NextResponse.json(
            { error: "Missing required parameter: noradId" },
            { status: 400 }
          );
        }
        url = `${N2YO_BASE_URL}/tle/${noradId}/&apiKey=${N2YO_API_KEY}`;
        response = await fetch(url);
        break;

      default:
        return NextResponse.json(
          {
            error:
              "Invalid endpoint. Use: above, visualpasses, radiopasses, positions, or tle",
          },
          { status: 400 }
        );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`N2YO API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `N2YO API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Cache the response
    setCachedData(cacheKey, data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("N2YO API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from N2YO API" },
      { status: 500 }
    );
  }
}

// POST endpoint for more complex requests
export async function POST(request: NextRequest) {
  if (!N2YO_API_KEY) {
    return NextResponse.json(
      { error: "N2YO API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      endpoint,
      noradId,
      observerLat,
      observerLon,
      observerAlt,
      ...params
    } = body;

    if (!endpoint || !noradId) {
      return NextResponse.json(
        { error: "Missing required parameters: endpoint, noradId" },
        { status: 400 }
      );
    }

    const cacheKey = getCacheKey(endpoint, body);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    let url: string;
    const baseParams = `&apiKey=${N2YO_API_KEY}`;

    switch (endpoint) {
      case "visualpasses":
        const days = params.days || 10;
        const minElevation = params.minElevation || 10;
        url = `${N2YO_BASE_URL}/visualpasses/${noradId}/${observerLat}/${observerLon}/${observerAlt}/${days}/${minElevation}/${baseParams}`;
        break;

      case "radiopasses":
        const radioDays = params.days || 10;
        const radioMinElevation = params.minElevation || 10;
        url = `${N2YO_BASE_URL}/radiopasses/${noradId}/${observerLat}/${observerLon}/${observerAlt}/${radioDays}/${radioMinElevation}/${baseParams}`;
        break;

      case "positions":
        const seconds = params.seconds || 300;
        url = `${N2YO_BASE_URL}/positions/${noradId}/${observerLat}/${observerLon}/${observerAlt}/${seconds}/${baseParams}`;
        break;

      case "tle":
        url = `${N2YO_BASE_URL}/tle/${noradId}/${baseParams}`;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid endpoint" },
          { status: 400 }
        );
    }

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`N2YO API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `N2YO API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    setCachedData(cacheKey, data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("N2YO API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from N2YO API" },
      { status: 500 }
    );
  }
}
