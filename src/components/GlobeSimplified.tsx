"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useSatellitesSimplified } from "@/app/hooks/useSatellitesSimplified";

interface GlobeSimplifiedProps {
  className?: string;
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
  visible: boolean;
  launchDate?: string;
  intDesignator?: string;
}

interface N2YOPosition {
  satlatitude: number;
  satlongitude: number;
  sataltitude: number;
  timestamp: number;
}

// Mapbox access token from environment variable
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

const INITIAL_VIEW_STATE = {
  latitude: 0,
  longitude: 0,
  zoom: 1,
  minZoom: 0,
  maxZoom: 20,
};

// Color mapping for different satellite categories
const CATEGORY_COLORS: Record<string, [number, number, number, number]> = {
  starlink: [0, 255, 0, 255], // Green
  iss: [255, 255, 255, 255], // White
  gps: [0, 0, 255, 255], // Blue
  weather: [255, 165, 0, 255], // Orange
  noaa: [255, 0, 0, 255], // Red
  geostationary: [255, 0, 255, 255], // Magenta
  iridium: [0, 255, 255, 255], // Cyan
  "amateur-radio": [255, 255, 0, 255], // Yellow
  military: [128, 0, 128, 255], // Purple
  default: [128, 128, 128, 255], // Gray
};

export default function GlobeSimplified({
  className = "",
}: GlobeSimplifiedProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedSatellite, setSelectedSatellite] =
    useState<SatellitePosition | null>(null);
  const [hoveredSatellite, setHoveredSatellite] =
    useState<SatellitePosition | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [track, setTrack] = useState<N2YOPosition[] | null>(null);
  const [zoom, setZoom] = useState(1);

  const {
    satellites,
    loading,
    error,
    lastUpdate,
    categories,
    setCategories,
    observerPosition,
    setObserverPosition,
  } = useSatellitesSimplified({
    categories: ["starlink", "iss", "gps", "weather"],
    updateInterval: 300000, // 5 minutes
    observerPosition: { lat: 0, lon: 0, alt: 0 },
    searchRadius: 90,
  });

  const handleViewStateChange = useCallback(
    ({ viewState }: { viewState: any }) => {
      setViewState(viewState);
    },
    []
  );

  // Initialize Mapbox map + deck.gl overlay
  useEffect(() => {
    if (map.current) return; // Initialize map only once

    if (mapContainer.current && MAPBOX_ACCESS_TOKEN) {
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/skywork/cmf2chsma000101qs9w18bov9",
        center: [0, 0],
        zoom: 1,
        projection: "globe",
        interactive: true,
      });

      map.current.on("load", () => {
        console.log("Map with satellite style loaded successfully");

        // Add sources/layers for ground track and selected sat, and init deck.gl overlay
        if (!map.current!.getSource("satellites")) {
          map.current!.addSource("satellites", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          } as any);
          map.current!.addLayer({
            id: "satellite-circles",
            type: "circle",
            source: "satellites",
            paint: {
              // Grow points with zoom so they appear larger when zoomed in
              "circle-radius": [
                "interpolate",
                ["exponential", 1.6],
                ["zoom"],
                0,
                1.5,
                3,
                3,
                6,
                8,
                10,
                14,
                14,
                22,
              ],
              "circle-color": "#ffeb3b",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 0.5,
              "circle-opacity": 0.9,
            },
          } as any);

          map.current!.on("click", "satellite-circles", (e: any) => {
            const f = e.features && e.features[0];
            if (f) {
              setSelectedSatellite({
                name: f.properties.name,
                noradId: f.properties.noradId,
                category: f.properties.category,
                position: {
                  lat: f.geometry.coordinates[1],
                  lon: f.geometry.coordinates[0],
                  alt: 0,
                },
                visible: true,
              });
            }
          });
        }

        if (!map.current!.getSource("groundtrack")) {
          map.current!.addSource("groundtrack", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          } as any);
          map.current!.addLayer({
            id: "groundtrack-line",
            type: "line",
            source: "groundtrack",
            paint: {
              "line-color": "#FFD700",
              "line-width": 2,
              "line-opacity": 0.8,
            },
          } as any);
        }

        if (!map.current!.getSource("selected-sat")) {
          map.current!.addSource("selected-sat", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          } as any);
          map.current!.addLayer({
            id: "selected-sat-point",
            type: "circle",
            source: "selected-sat",
            paint: {
              "circle-radius": 5,
              "circle-color": "#FFFF00",
              "circle-stroke-color": "#000",
              "circle-stroke-width": 1,
            },
          } as any);
        }

        overlayRef.current = new MapboxOverlay({
          interleaved: true,
          getTooltip: (info: any) => {
            const o = info.object as any;
            if (!o) return null;
            return {
              html: `
                <div style="background: rgba(0, 0, 0, 0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <div><strong>${o.name}</strong></div>
                  <div>NORAD ID: ${o.noradId}</div>
                  <div>Category: ${o.category}</div>
                  <div>Altitude: ${o.altitude.toFixed(1)} km</div>
                  <div>Status: ${o.visible ? "Visible" : "Not Visible"}</div>
                </div>
              `,
            } as any;
          },
        });
        map.current!.addControl(overlayRef.current);

        if (!map.current) return;
        const c = map.current.getCenter();
        setObserverPosition({ lat: c.lat, lon: c.lng, alt: 0 });
      });

      map.current.on("moveend", () => {
        const c = map.current!.getCenter();
        setObserverPosition({ lat: c.lat, lon: c.lng, alt: 0 });
      });

      map.current.on("zoom", () => {
        setZoom(map.current!.getZoom());
      });

      // Initialize zoom state
      setZoom(map.current.getZoom());

      map.current.on("error", (e) => {
        console.error("Map error:", e);
      });
    }

    return () => {
      if (map.current) {
        if (overlayRef.current) {
          try {
            map.current.removeControl(overlayRef.current as any);
          } catch {}
          overlayRef.current = null;
        }
        map.current.remove();
        map.current = null;
      }
    };
  }, [MAPBOX_ACCESS_TOKEN, setObserverPosition]);

  // Convert satellite data to deck.gl format
  const satelliteData = satellites.map((sat) => ({
    position: [sat.position.lon, sat.position.lat, sat.position.alt * 1000], // Convert km to meters
    color: CATEGORY_COLORS[sat.category] || CATEGORY_COLORS.default,
    radius: sat.visible ? 3 : 1,
    name: sat.name,
    noradId: sat.noradId,
    category: sat.category,
    altitude: sat.position.alt,
    visible: sat.visible,
  }));

  // Update deck.gl layer when data updates
  useEffect(() => {
    if (!overlayRef.current) return;

    const layer = new ScatterplotLayer({
      id: "satellite-points",
      data: satelliteData,
      pickable: true,
      radiusUnits: "pixels",
      getRadius: (_d: any) => {
        return Math.min(20, 2 + Math.pow(1.6, zoom));
      },
      getPosition: (d: any) => [d.position[0], d.position[1]],
      getFillColor: (d: any) => d.color,
      onClick: (info: any) => {
        if (!info.object) return;
        const d = info.object as any;
        setSelectedSatellite({
          name: d.name,
          noradId: d.noradId,
          category: d.category,
          position: { lat: d.position[1], lon: d.position[0], alt: d.altitude },
          visible: d.visible,
        });
      },
      updateTriggers: {
        getPosition: satelliteData,
        getFillColor: satelliteData,
        getRadius: zoom,
      },
    });

    overlayRef.current.setProps({ layers: [layer] });
  }, [satelliteData]);

  // Also push features into Mapbox GeoJSON source as a fallback/parallel render
  useEffect(() => {
    if (!map.current) return;
    const src = map.current.getSource("satellites") as any;
    if (!src) return;
    const features = satelliteData.map((d: any) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [d.position[0], d.position[1]] },
      properties: { name: d.name, noradId: d.noradId, category: d.category },
    }));
    const fc = { type: "FeatureCollection", features } as any;
    src.setData(fc);
  }, [satelliteData]);

  // Selected satellite ground track + current point
  useEffect(() => {
    if (!map.current) return;
    const lineSrc = map.current.getSource("groundtrack") as any;
    const pointSrc = map.current.getSource("selected-sat") as any;
    if (!lineSrc || !pointSrc) return;
    if (!track || track.length === 0) {
      lineSrc.setData({ type: "FeatureCollection", features: [] });
      pointSrc.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const lineCoords = track.map((p) => [p.satlongitude, p.satlatitude]);
    const lineFc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: lineCoords },
          properties: {},
        },
      ],
    } as any;
    lineSrc.setData(lineFc);

    const current = track[0];
    const pointFc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [current.satlongitude, current.satlatitude],
          },
          properties: {},
        },
      ],
    } as any;
    pointSrc.setData(pointFc);
  }, [track]);

  // Fetch N2YO positions when a satellite is selected
  useEffect(() => {
    let abort = false;
    async function fetchPositions() {
      if (!selectedSatellite) {
        setTrack(null);
        return;
      }
      try {
        const url = `/api/satellites/n2yo?endpoint=positions&noradId=${selectedSatellite.noradId}&observerLat=${observerPosition.lat}&observerLon=${observerPosition.lon}&observerAlt=${observerPosition.alt}&seconds=240`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        if (!abort) setTrack(json.positions as N2YOPosition[]);
      } catch (e) {
        if (!abort) setTrack(null);
      }
    }
    fetchPositions();
    return () => {
      abort = true;
    };
  }, [
    selectedSatellite,
    observerPosition.lat,
    observerPosition.lon,
    observerPosition.alt,
  ]);

  return (
    <div
      className={`relative w-full h-full ${className}`}
      style={{ background: "#000011" }}
    >
      {/* Status bar */}
      <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white p-3 rounded-lg text-sm">
        <div>Satellites: {satellites.length}</div>
        <div>
          Last Update:{" "}
          {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "Never"}
        </div>
        <div>
          Observer: {observerPosition.lat.toFixed(2)}°,{" "}
          {observerPosition.lon.toFixed(2)}°
        </div>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-400">Error: {error}</div>}
      </div>

      {/* Category filter */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-3 rounded-lg text-sm">
        <div className="mb-2">Categories:</div>
        {[
          "starlink",
          "iss",
          "gps",
          "weather",
          "noaa",
          "iridium",
          "amateur-radio",
          "military",
        ].map((cat) => (
          <label key={cat} className="block">
            <input
              type="checkbox"
              checked={categories.includes(cat)}
              onChange={(e) => {
                if (e.target.checked) {
                  setCategories([...categories, cat]);
                } else {
                  setCategories(categories.filter((c) => c !== cat));
                }
              }}
              className="mr-2"
            />
            {cat}
          </label>
        ))}
      </div>

      {/* Selected satellite info */}
      {selectedSatellite && (
        <div className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-80 text-white p-4 rounded-lg max-w-sm">
          <h3 className="font-bold text-lg mb-2">{selectedSatellite.name}</h3>
          <div className="space-y-1 text-sm">
            <div>NORAD ID: {selectedSatellite.noradId}</div>
            <div>Category: {selectedSatellite.category}</div>
            <div>
              Position: {selectedSatellite.position.lat.toFixed(4)}°,{" "}
              {selectedSatellite.position.lon.toFixed(4)}°
            </div>
            <div>Altitude: {selectedSatellite.position.alt.toFixed(1)} km</div>
            <div>
              Status: {selectedSatellite.visible ? "Visible" : "Not Visible"}
            </div>
            {selectedSatellite.launchDate && (
              <div>Launch: {selectedSatellite.launchDate}</div>
            )}
          </div>
          <button
            onClick={() => setSelectedSatellite(null)}
            className="mt-3 px-3 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500"
          >
            Close
          </button>
        </div>
      )}

      {/* Mapbox Map Container */}
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ minHeight: "100vh" }}
      />
    </div>
  );
}
