"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useSatellites } from "@/app/hooks/useSatellites";

interface Globe3DProps {
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

export default function Globe3D({ className = "" }: Globe3DProps) {
  const [selectedSatellite, setSelectedSatellite] =
    useState<SatellitePosition | null>(null);
  // Use uncontrolled DeckGL with initialViewState for reliable interactions
  const [deckComponents, setDeckComponents] = useState<any>(null);
  const [zoom, setZoom] = useState(0.5);

  // Dynamically load deck.gl components on client side
  useEffect(() => {
    const loadDeckComponents = async () => {
      try {
        const [DeckGLModule, CoreModule, LayersModule, GeoLayersModule] =
          await Promise.all([
            import("@deck.gl/react"),
            import("@deck.gl/core"),
            import("@deck.gl/layers"),
            import("@deck.gl/geo-layers"),
          ]);

        const GlobeViewClass =
          (CoreModule as any).GlobeView || (CoreModule as any)._GlobeView;

        setDeckComponents({
          DeckGL: DeckGLModule.default,
          GlobeView: GlobeViewClass,
          ScatterplotLayer: LayersModule.ScatterplotLayer,
          BitmapLayer: LayersModule.BitmapLayer,
          TileLayer: (GeoLayersModule as any).TileLayer,
        });
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
    categories: [
      "active",
      "starlink",
      "gnss",
      "weather",
      "geo",
      "iridium",
      "amateur",
      "noaa",
      "visual",
      "x_comm",
      "other_comm",
      "gorizont",
      "raduga",
      "molniya",
      "gps_ops",
      "glonass",
      "galileo",
      "beidou",
      "sbas",
      "nnss",
      "moscow",
      "intelsat",
      "ses",
      "last_30_days",
      "stations",
    ],
    updateInterval: 500, // 500ms for smooth real-time tracking
    observerPosition: { lat: 0, lon: 0, alt: 0 },
  });

  // Convert satellite data to deck.gl geospatial format: [lon, lat, zMeters]
  const satelliteData = satellites.map((sat) => ({
    position: [sat.position.lon, sat.position.lat, sat.position.alt * 1000], // km -> meters
    color: CATEGORY_COLORS[sat.category] || CATEGORY_COLORS.default,
    name: sat.name,
    noradId: sat.noradId,
    category: sat.category,
    altitude: sat.position.alt, // km
    visible: sat.visible,
  }));

  // Create base OSM tile layer and satellites (no Mapbox dependency)
  const layers = deckComponents
    ? [
        new deckComponents.TileLayer({
          id: "osm-tiles",
          data: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          minZoom: 0,
          maxZoom: 5,
          tileSize: 256,
          // Provide a getTileData to load image so data is an HTMLImageElement
          getTileData: ({ x, y, z }: any) =>
            new Promise((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => resolve(img);
              img.onerror = () => resolve(null);
              img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
            }),
          renderSubLayers: (props: any) => {
            const {
              tile: { bbox },
              data,
            } = props;
            const { west, south, east, north } = bbox;
            return new deckComponents.BitmapLayer(props, {
              id: `${props.id}-bitmap`,
              image: data,
              bounds: [west, south, east, north],
            });
          },
        }),
        new deckComponents.ScatterplotLayer({
          id: "satellite-points",
          data: satelliteData,
          pickable: true,
          radiusUnits: "pixels",
          getPosition: (d: any) => d.position,
          getFillColor: (d: any) => d.color,
          getRadius: (_d: any) => {
            const size = Math.min(20, 2 + Math.pow(1.7, zoom));
            return size;
          },
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
            getRadius: zoom,
          },
        }),
      ]
    : [];

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
        {[
          "active",
          "starlink",
          "gnss",
          "weather",
          "geo",
          "iridium",
          "amateur",
          "noaa",
          "visual",
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
          </div>
          <button
            onClick={() => setSelectedSatellite(null)}
            className="mt-3 px-3 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500"
          >
            Close
          </button>
        </div>
      )}

      {/* DeckGL Globe View */}
      {deckComponents ? (
        <deckComponents.DeckGL
          views={[new deckComponents.GlobeView({ id: "globe" })]}
          controller={true}
          initialViewState={{ longitude: 0, latitude: 20, zoom: 0.5 }}
          onViewStateChange={({ viewState }: any) => {
            if (typeof viewState?.zoom === "number") setZoom(viewState.zoom);
          }}
          layers={layers}
          style={{ position: "absolute", inset: 0 }}
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
