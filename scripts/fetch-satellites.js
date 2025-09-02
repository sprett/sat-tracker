#!/usr/bin/env node

/**
 * Cron job script to fetch satellite TLE data from CelesTrak
 * Run this every 6-12 hours to keep satellite data fresh
 *
 * Usage:
 *   node scripts/fetch-satellites.js
 *   node scripts/fetch-satellites.js --categories=active,starlink,gnss
 *   node scripts/fetch-satellites.js --force
 */

const https = require("https");
const fs = require("fs").promises;
const path = require("path");
const { gzip } = require("zlib");
const { promisify } = require("util");

const gzipAsync = promisify(gzip);

// Parse command line arguments
const args = process.argv.slice(2);
const categories = args
  .find((arg) => arg.startsWith("--categories="))
  ?.split("=")[1]
  ?.split(",") || [
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
const force = args.includes("--force");

// CelesTrak API endpoints
const CELESTRAK_ENDPOINTS = {
  active: "https://celestrak.org/NORAD/elements/active.txt",
  starlink: "https://celestrak.org/NORAD/elements/starlink.txt",
  gnss: "https://celestrak.org/NORAD/elements/gnss.txt",
  weather: "https://celestrak.org/NORAD/elements/weather.txt",
  noaa: "https://celestrak.org/NORAD/elements/noaa.txt",
  geo: "https://celestrak.org/NORAD/elements/geo.txt",
  iridium: "https://celestrak.org/NORAD/elements/iridium.txt",
  iridiumNEXT: "https://celestrak.org/NORAD/elements/iridium-NEXT.txt",
  tle: "https://celestrak.org/NORAD/elements/tle.txt",
  visual: "https://celestrak.org/NORAD/elements/visual.txt",
  amateur: "https://celestrak.org/NORAD/elements/amateur.txt",
  x_comm: "https://celestrak.org/NORAD/elements/x-comm.txt",
  other_comm: "https://celestrak.org/NORAD/elements/other-comm.txt",
  gorizont: "https://celestrak.org/NORAD/elements/gorizont.txt",
  raduga: "https://celestrak.org/NORAD/elements/raduga.txt",
  molniya: "https://celestrak.org/NORAD/elements/molniya.txt",
  gps_ops: "https://celestrak.org/NORAD/elements/gps-ops.txt",
  glonass: "https://celestrak.org/NORAD/elements/glonass.txt",
  galileo: "https://celestrak.org/NORAD/elements/galileo.txt",
  beidou: "https://celestrak.org/NORAD/elements/beidou.txt",
  sbas: "https://celestrak.org/NORAD/elements/sbas.txt",
  nnss: "https://celestrak.org/NORAD/elements/nnss.txt",
  moscow: "https://celestrak.org/NORAD/elements/moscow.txt",
  intelsat: "https://celestrak.org/NORAD/elements/intelsat.txt",
  ses: "https://celestrak.org/NORAD/elements/ses.txt",
  iridium_33_debris:
    "https://celestrak.org/NORAD/elements/iridium-33-debris.txt",
  cosmos_2251_debris:
    "https://celestrak.org/NORAD/elements/cosmos-2251-debris.txt",
  last_30_days: "https://celestrak.org/NORAD/elements/last-30-days.txt",
  stations: "https://celestrak.org/NORAD/elements/stations.txt",
};

async function fetchTLEFromCelesTrak(url, category) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "SatTracker/1.0 (Educational Project)",
        },
      },
      (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          try {
            const lines = data.trim().split("\n");
            const satellites = [];

            // Parse TLE format: name, line1, line2
            for (let i = 0; i < lines.length; i += 3) {
              if (i + 2 < lines.length) {
                const name = lines[i].trim();
                const line1 = lines[i + 1].trim();
                const line2 = lines[i + 2].trim();

                // Extract NORAD ID from line 2 (columns 3-7) which are more reliable
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

            resolve(satellites);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });
  });
}

async function saveCompressedData(data, filename) {
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

async function main() {
  try {
    console.log(`Fetching TLE data for categories: ${categories.join(", ")}`);

    // Check if we have recent data (less than 6 hours old)
    const dataDir = path.join(process.cwd(), "data");
    const cacheFile = path.join(dataDir, "satellites.json.gz");

    if (!force) {
      try {
        const stats = await fs.stat(cacheFile);
        const ageHours =
          (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

        if (ageHours < 6) {
          console.log(`Using cached data (${ageHours.toFixed(1)} hours old)`);
          return;
        }
      } catch (error) {
        // Cache file doesn't exist, continue with fetch
      }
    }

    // Fetch data from CelesTrak
    const allSatellites = [];

    for (const category of categories) {
      const endpoint = CELESTRAK_ENDPOINTS[category];
      if (!endpoint) {
        console.warn(`Unknown category: ${category}`);
        continue;
      }

      console.log(`Fetching ${category}...`);
      try {
        const tleData = await fetchTLEFromCelesTrak(endpoint, category);

        const satellites = tleData.map((tle) => ({
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
      } catch (error) {
        console.error(`Error fetching ${category}:`, error.message);
      }
    }

    console.log(`Total satellites fetched: ${allSatellites.length}`);

    // Save compressed data
    await saveCompressedData(allSatellites, "satellites.json.gz");

    console.log("Satellite data fetch completed successfully!");
  } catch (error) {
    console.error("Error fetching satellite data:", error);
    process.exit(1);
  }
}

// Run the script
main();
