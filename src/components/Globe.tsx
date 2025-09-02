"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { _GlobeView as GlobeView } from "@deck.gl/core";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface GlobeProps {
  className?: string;
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

export default function Globe({ className = "" }: GlobeProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const handleViewStateChange = useCallback(
    ({ viewState }: { viewState: any }) => {
      setViewState(viewState);
    },
    []
  );

  // Check if we have the Mapbox token
  if (!MAPBOX_ACCESS_TOKEN) {
    console.error("Mapbox access token is not defined");
  } else {
    console.log(
      "Mapbox token loaded:",
      MAPBOX_ACCESS_TOKEN.substring(0, 10) + "..."
    );
  }

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
        console.log("Map with custom style loaded successfully");
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [MAPBOX_ACCESS_TOKEN]);

  return (
    <div
      className={`relative w-full h-full ${className}`}
      style={{ background: "#000011" }}
    >
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ minHeight: "100vh" }}
      />
    </div>
  );
}
