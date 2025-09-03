import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { gzip } from "zlib";
import { promisify } from "util";
import { createHash } from "crypto";

const gzipAsync = promisify(gzip);

// CelesTrak GP endpoints (updated to new PHP format)
const CELESTRAK_ENDPOINTS = {
  active: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
  starlink:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
  gnss: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gnss&FORMAT=tle",
  weather:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle",
  noaa: "https://celestrak.org/NORAD/elements/gp.php?GROUP=noaa&FORMAT=tle",
  geo: "https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=tle",
  iridium:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium&FORMAT=tle",
  iridiumNEXT:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-NEXT&FORMAT=tle",
  tle: "https://celestrak.org/NORAD/elements/gp.php?GROUP=tle&FORMAT=tle",
  visual: "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
  amateur:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle",
  x_comm: "https://celestrak.org/NORAD/elements/gp.php?GROUP=x-comm&FORMAT=tle",
  other_comm:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=other-comm&FORMAT=tle",
  gorizont:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=gorizont&FORMAT=tle",
  raduga: "https://celestrak.org/NORAD/elements/gp.php?GROUP=raduga&FORMAT=tle",
  molniya:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=molniya&FORMAT=tle",
  gps_ops:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle",
  glonass:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=glonass&FORMAT=tle",
  galileo:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle",
  beidou: "https://celestrak.org/NORAD/elements/gp.php?GROUP=beidou&FORMAT=tle",
  sbas: "https://celestrak.org/NORAD/elements/gp.php?GROUP=sbas&FORMAT=tle",
  nnss: "https://celestrak.org/NORAD/elements/gp.php?GROUP=nnss&FORMAT=tle",
  moscow: "https://celestrak.org/NORAD/elements/gp.php?GROUP=moscow&FORMAT=tle",
  intelsat:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=intelsat&FORMAT=tle",
  ses: "https://celestrak.org/NORAD/elements/gp.php?GROUP=ses&FORMAT=tle",
  iridium_33_debris:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle",
  cosmos_2251_debris:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle",
  last_30_days:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=tle",
  stations:
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
};

interface TLEData {
  name: string;
  line1: string;
  line2: string;
  category: string;
  noradId: string;
}

interface SatelliteData {
  name: string;
  noradId: string;
  category: string;
  tle: {
    line1: string;
    line2: string;
  };
  position?: {
    lat: number;
    lon: number;
    alt: number;
  };
  velocity?: {
    x: number;
    y: number;
    z: number;
  };
}

async function fetchTLEFromCelesTrak(
  url: string,
  category: string
): Promise<TLEData[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SatTracker/1.0 (Educational Project)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${category}: ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.trim().split("\n");
    const satellites: TLEData[] = [];

    // Parse TLE format: name, line1, line2
    for (let i = 0; i < lines.length; i += 3) {
      if (i + 2 < lines.length) {
        const name = lines[i].trim();
        const line1 = lines[i + 1].trim();
        const line2 = lines[i + 2].trim();

        // Extract NORAD ID from line 2 (columns 3-7) which are more reliable
        // Fallback to line1 if parsing fails
        let noradId = line2.substring(2, 7).trim();
        if (!/^[0-9]+$/.test(noradId)) {
          noradId = line1.substring(2, 7).trim();
        }

        satellites.push({
          name,
          line1,
          line2,
          category,
          noradId,
        });
      }
    }

    return satellites;
  } catch (error) {
    console.error(`Error fetching ${category}:`, error);
    return [];
  }
}

async function saveCompressedData(
  data: SatelliteData[],
  filename: string
): Promise<void> {
  const dataDir = path.join(process.cwd(), "data");

  // Ensure data directory exists
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  const jsonData = JSON.stringify(data);
  const compressed = await gzipAsync(Buffer.from(jsonData, "utf8"));

  const filePath = path.join(dataDir, filename);
  await fs.writeFile(filePath, compressed);

  console.log(
    `Saved compressed data to ${filePath} (${compressed.length} bytes)`
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categories = searchParams.get("categories")?.split(",") || [
      "active",
      "starlink",
      "gnss",
      "weather",
      "geo",
      "iridium",
      "amateur",
      "noaa",
      "visual",
    ];
    const force = searchParams.get("force") === "true";
    const compressed = searchParams.get("compressed") !== "false"; // Default to compressed

    console.log(`Fetching TLE data for categories: ${categories.join(", ")}`);

    // Build a cache key based on the requested category set so different
    // combinations don't collide in a single cache file
    const categoriesKey = categories.slice().sort().join(",");
    const categoriesHash = createHash("sha1")
      .update(categoriesKey)
      .digest("hex")
      .slice(0, 12);

    // Check if we have recent data (less than 6 hours old)
    const dataDir = path.join(process.cwd(), "data");
    const cacheFile = path.join(
      dataDir,
      `satellites-${categoriesHash}.json.gz`
    );

    if (!force) {
      try {
        const stats = await fs.stat(cacheFile);
        const ageHours =
          (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

        if (ageHours < 6) {
          console.log(`Using cached data (${ageHours.toFixed(1)} hours old)`);
          const cachedData = await fs.readFile(cacheFile);

          if (compressed) {
            return new NextResponse(cachedData, {
              headers: {
                "Content-Type": "application/gzip",
                "Content-Encoding": "gzip",
                "Cache-Control": "public, max-age=21600", // 6 hours
              },
            });
          } else {
            // Decompress cached data for uncompressed response
            const { gunzip } = require("zlib");
            const { promisify } = require("util");
            const gunzipAsync = promisify(gunzip);
            const decompressed = await gunzipAsync(cachedData);
            return new NextResponse(decompressed, {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=21600", // 6 hours
              },
            });
          }
        }
      } catch (error) {
        // Cache file doesn't exist, continue with fetch
      }
    }

    // Fetch data from CelesTrak
    const allSatellites: SatelliteData[] = [];

    for (const category of categories) {
      const endpoint =
        CELESTRAK_ENDPOINTS[category as keyof typeof CELESTRAK_ENDPOINTS];
      if (!endpoint) {
        console.warn(`Unknown category: ${category}`);
        continue;
      }

      console.log(`Fetching ${category}...`);
      const tleData = await fetchTLEFromCelesTrak(endpoint, category);

      const satellites: SatelliteData[] = tleData.map((tle) => ({
        name: tle.name,
        noradId: tle.noradId,
        category: tle.category,
        tle: {
          line1: tle.line1,
          line2: tle.line2,
        },
      }));

      allSatellites.push(...satellites);
      console.log(`Fetched ${satellites.length} satellites from ${category}`);
    }

    console.log(`Total satellites fetched: ${allSatellites.length}`);

    // Save compressed data
    await saveCompressedData(
      allSatellites,
      `satellites-${categoriesHash}.json.gz`
    );

    // Return response based on compression preference
    const jsonData = JSON.stringify(allSatellites);

    if (compressed) {
      const compressedData = await gzipAsync(Buffer.from(jsonData, "utf8"));
      return new NextResponse(compressedData, {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Encoding": "gzip",
          "Cache-Control": "public, max-age=21600", // 6 hours
        },
      });
    } else {
      return new NextResponse(jsonData, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=21600", // 6 hours
        },
      });
    }
  } catch (error) {
    console.error("Error fetching TLE data:", error);
    return NextResponse.json(
      { error: "Failed to fetch satellite data" },
      { status: 500 }
    );
  }
}

// POST endpoint for manual trigger (useful for testing)
export async function POST(request: NextRequest) {
  return GET(request);
}
