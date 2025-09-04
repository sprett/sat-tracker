"use client";

import React, { useEffect, useState } from "react";
import { useSatelliteDetailsStore } from "@/app/state/satelliteStore";

interface SatelliteDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SatelliteDetailsModal({
  isOpen,
  onClose,
}: SatelliteDetailsModalProps) {
  const selectedSatellite = useSatelliteDetailsStore(
    (state) => state.selectedSatellite
  );
  const satelliteData = useSatelliteDetailsStore(
    (state) => state.satelliteData
  );
  const [currentSatellite, setCurrentSatellite] = useState(selectedSatellite);

  // Update current satellite data in real-time
  useEffect(() => {
    if (selectedSatellite && satelliteData.length > 0) {
      const updatedSatellite = satelliteData.find(
        (sat) => sat.noradId === selectedSatellite.noradId
      );
      if (updatedSatellite) {
        setCurrentSatellite(updatedSatellite);
      }
    }
  }, [selectedSatellite, satelliteData]);

  // Update when selected satellite changes
  useEffect(() => {
    setCurrentSatellite(selectedSatellite);
  }, [selectedSatellite]);

  if (!isOpen || !currentSatellite) return null;

  // Calculate speed from velocity components
  const speed = Math.sqrt(
    currentSatellite.velocity.x ** 2 +
      currentSatellite.velocity.y ** 2 +
      currentSatellite.velocity.z ** 2
  );

  // Format coordinates - rounded to 2 decimal places
  const formatCoordinate = (value: number, isLatitude: boolean = false) => {
    const degrees = Math.abs(value).toFixed(2);
    const direction = isLatitude
      ? value >= 0
        ? "N"
        : "S"
      : value >= 0
      ? "E"
      : "W";
    return `${degrees}°${direction}`;
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className="absolute left-4 bottom-4 w-96 bg-gray-900 trans rounded-lg shadow-2xl pointer-events-auto max-h-[60vh] overflow-y-auto border border-gray-700">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white font-mono">
                {currentSatellite.name}
              </h2>
              <p className="text-sm text-gray-300 font-mono">
                NORAD ID: {currentSatellite.noradId}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold hover:cursor-pointer"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 font-mono">
                Category
              </label>
              <span className="inline-block px-3 py-1 bg-blue-900 text-blue-200 text-sm font-medium rounded-full capitalize font-mono">
                {currentSatellite.category}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 font-mono">
                  Altitude
                </label>
                <p className="text-lg font-semibold text-white font-mono">
                  {currentSatellite.position.alt.toFixed(0)} km
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 font-mono">
                  Speed
                </label>
                <p className="text-lg font-semibold text-white font-mono">
                  {speed.toFixed(1)} km/s
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  {(speed * 3600).toFixed(0)} km/h
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 font-mono">
                Position
              </label>
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400 font-mono">
                    Latitude:
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white font-mono">
                      {formatCoordinate(currentSatellite.position.lat, true)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400 font-mono">
                    Longitude:
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white font-mono">
                      {formatCoordinate(currentSatellite.position.lon)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Velocity Components
              </label>
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">X:</span>
                  <span className="text-sm font-medium text-white font-mono">
                    {currentSatellite.velocity.x.toFixed(2)} km/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Y:</span>
                  <span className="text-sm font-medium text-white font-mono">
                    {currentSatellite.velocity.y.toFixed(2)} km/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Z:</span>
                  <span className="text-sm font-medium text-white font-mono">
                    {currentSatellite.velocity.z.toFixed(2)} km/s
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    currentSatellite.visible ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>
                <span className="text-sm text-gray-300">
                  {currentSatellite.visible ? "Visible" : "Not Visible"}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-sm text-gray-400 hover:text-white px-3 py-1 rounded hover:bg-gray-800 hover:cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
