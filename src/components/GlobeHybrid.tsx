"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useSatellites } from "@/app/hooks/useSatellites";

// Try static imports as fallback
let DeckGL: any, OrbitView: any, ScatterplotLayer: any, SolidPolygonLayer: any;
try {
  const deckGLModule = require("@deck.gl/react");
  const coreModule = require("@deck.gl/core");
  const layersModule = require("@deck.gl/layers");

  DeckGL = deckGLModule.default;
  OrbitView = coreModule.OrbitView;
  ScatterplotLayer = layersModule.ScatterplotLayer;
  SolidPolygonLayer = layersModule.SolidPolygonLayer;

  console.log("Static Deck.gl imports successful");
} catch (error) {
  console.log("Static Deck.gl imports failed, will use dynamic imports");
}

interface GlobeHybridProps {
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
  velocity: {
    x: number;
    y: number;
    z: number;
  };
  visible: boolean;
}

// Category colors for different satellite types
const CATEGORY_COLORS: Record<string, [number, number, number, number]> = {
  starlink: [255, 0, 0, 255], // Red
  active: [0, 255, 0, 255], // Green
  gnss: [0, 0, 255, 255], // Blue
  weather: [255, 255, 0, 255], // Yellow
  geo: [255, 0, 255, 255], // Magenta
  iridium: [0, 255, 255, 255], // Cyan
  amateur: [255, 128, 0, 255], // Orange
  noaa: [128, 0, 255, 255], // Purple
  visual: [255, 192, 203, 255], // Pink
  default: [255, 255, 255, 255], // White
};

export default function GlobeHybrid({ className = "" }: GlobeHybridProps) {
  const [selectedSatellite, setSelectedSatellite] =
    useState<SatellitePosition | null>(null);
  const [viewState, setViewState] = useState({
    target: [0, 0, 0],
    rotationX: 0,
    rotationY: 0,
    zoom: 1,
  });
  const [deckComponents, setDeckComponents] = useState<any>(null);

  // Load deck.gl components on client side
  useEffect(() => {
    const loadDeckComponents = async () => {
      try {
        console.log("Starting to load Deck.gl components...");

        // Try static imports first
        if (DeckGL && OrbitView && ScatterplotLayer) {
          console.log("Using static Deck.gl imports");
          setDeckComponents({
            DeckGL,
            OrbitView,
            ScatterplotLayer,
            SolidPolygonLayer,
          });
          return;
        }

        // Fallback to dynamic imports
        console.log("Using dynamic Deck.gl imports");
        const [DeckGLModule, CoreModule, LayersModule] = await Promise.all([
          import("@deck.gl/react"),
          import("@deck.gl/core"),
          import("@deck.gl/layers"),
        ]);

        console.log("Deck.gl modules loaded:", {
          DeckGL: !!DeckGLModule.default,
          OrbitView: !!CoreModule.OrbitView,
          ScatterplotLayer: !!LayersModule.ScatterplotLayer,
        });

        setDeckComponents({
          DeckGL: DeckGLModule.default,
          OrbitView: CoreModule.OrbitView,
          ScatterplotLayer: LayersModule.ScatterplotLayer,
          SolidPolygonLayer: LayersModule.SolidPolygonLayer,
        });

        console.log("Deck.gl components set successfully");
      } catch (error) {
        console.error("Failed to load deck.gl components:", error);
      }
    };

    loadDeckComponents();
  }, []);

  const {
    satellites,
    loading,
    error,
    lastUpdate,
    categories,
    setCategories,
    refresh,
  } = useSatellites({
    categories: ["active", "starlink", "gnss", "weather", "geo"],
    updateInterval: 500, // 2 seconds to reduce load
    observerPosition: { lat: 0, lon: 0, alt: 0 },
  });

  // Convert satellite data to deck.gl format with scaled 3D positioning
  const satelliteData = satellites.map((sat) => {
    // Scale down coordinates for better visibility
    const scale = 0.001; // Scale factor to make everything visible
    const lat = (sat.position.lat * Math.PI) / 180;
    const lon = (sat.position.lon * Math.PI) / 180;
    const alt = sat.position.alt * scale; // Scale altitude

    // Convert to 3D cartesian coordinates
    const x = Math.cos(lat) * Math.cos(lon) * (1 + alt);
    const y = Math.cos(lat) * Math.sin(lon) * (1 + alt);
    const z = Math.sin(lat) * (1 + alt);

    return {
      position: [x, y, z],
      color: CATEGORY_COLORS[sat.category] || CATEGORY_COLORS.default,
      radius: sat.visible ? 0.01 : 0.005,
      name: sat.name,
      noradId: sat.noradId,
      category: sat.category,
      altitude: sat.position.alt,
      visible: sat.visible,
    };
  });

  // Create simple Earth sphere using ScatterplotLayer for stability
  const earthPoints = [];
  for (let lat = -90; lat <= 90; lat += 15) {
    for (let lon = -180; lon <= 180; lon += 15) {
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      const x = Math.cos(latRad) * Math.cos(lonRad);
      const y = Math.cos(latRad) * Math.sin(lonRad);
      const z = Math.sin(latRad);
      earthPoints.push({
        position: [x, y, z],
        color: [0, 100, 200, 200],
        radius: 0.05,
      });
    }
  }

  // Create the layers
  const layers = deckComponents
    ? [
        // Earth sphere (using ScatterplotLayer for stability)
        new deckComponents.ScatterplotLayer({
          id: "earth-sphere",
          data: earthPoints,
          pickable: false,
          radiusMinPixels: 2,
          radiusMaxPixels: 8,
          getPosition: (d: any) => d.position,
          getFillColor: (d: any) => d.color,
          getRadius: (d: any) => d.radius,
        }),
        // Satellites (limit to first 1000 for performance)
        new deckComponents.ScatterplotLayer({
          id: "satellite-points",
          data: satelliteData.slice(0, 1000),
          pickable: true,
          radiusMinPixels: 1,
          radiusMaxPixels: 5,
          getPosition: (d: any) => d.position,
          getFillColor: (d: any) => d.color,
          getRadius: (d: any) => d.radius,
          parameters: { depthTest: false },
          onClick: (info: any) => {
            if (!info.object) return;
            const d = info.object as any;
            setSelectedSatellite({
              name: d.name,
              noradId: d.noradId,
              category: d.category,
              position: {
                lat: d.position[1],
                lon: d.position[0],
                alt: d.altitude,
              },
              velocity: { x: 0, y: 0, z: 0 },
              visible: d.visible,
            });
          },
          updateTriggers: {
            getPosition: satelliteData,
            getFillColor: satelliteData,
            getRadius: satelliteData,
          },
        }),
      ]
    : [];

  // Debug logging
  console.log("=== GlobeHybrid Debug ===");
  console.log("Satellites count:", satellites.length);
  console.log("Loading state:", loading);
  console.log("Error state:", error);
  console.log("Last update:", lastUpdate);
  console.log("Satellite data sample:", satelliteData.slice(0, 3));
  console.log("Earth points count:", earthPoints.length);
  console.log("Layers created:", layers.length);
  console.log("Deck components loaded:", !!deckComponents);
  console.log("=========================");

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
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-400">Error: {error}</div>}
      </div>

      {/* Category filter */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-3 rounded-lg text-sm">
        <div className="mb-2">Categories:</div>
        {["active", "starlink", "gnss", "weather", "geo"].map((cat) => (
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
          </div>
          <button
            onClick={() => setSelectedSatellite(null)}
            className="mt-3 px-3 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500"
          >
            Close
          </button>
        </div>
      )}

      {/* Pure DeckGL 3D View */}
      {deckComponents ? (
        <deckComponents.DeckGL
          views={[
            new deckComponents.OrbitView({
              id: "orbit",
              controller: true,
              target: [0, 0, 0],
              rotationX: 0,
              rotationY: 0,
              zoom: 1,
            }),
          ]}
          viewState={viewState}
          onViewStateChange={({ viewState }: { viewState: any }) => {
            console.log("View state changed:", viewState);
            setViewState(viewState);
          }}
          layers={layers}
          parameters={{
            clearColor: [0, 0, 17, 1], // Dark blue background
          }}
          getTooltip={({ object }: { object: any }) => {
            if (!object) return null;
            return {
              html: `
                <div style="background: rgba(0, 0, 0, 0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <div><strong>${object.name}</strong></div>
                  <div>NORAD ID: ${object.noradId}</div>
                  <div>Category: ${object.category}</div>
                  <div>Altitude: ${object.altitude.toFixed(1)} km</div>
                  <div>Status: ${
                    object.visible ? "Visible" : "Not Visible"
                  }</div>
                </div>
              `,
            };
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-lg mb-2">Loading 3D Globe...</div>
            <div className="text-sm text-gray-400">
              Initializing deck.gl components
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
