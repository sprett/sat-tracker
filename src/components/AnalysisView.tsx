"use client";

import React, { useMemo } from "react";
import { useSatelliteDetailsStore } from "@/app/state/satelliteStore";

interface AnalysisViewProps {
  className?: string;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ className = "" }) => {
  const satelliteData = useSatelliteDetailsStore((s) => s.satelliteData);

  // Calculate comprehensive analysis metrics
  const analysisData = useMemo(() => {
    if (satelliteData.length === 0) return null;

    // Basic statistics
    const total = satelliteData.length;
    const visible = satelliteData.filter((sat) => sat.visible).length;
    const invisible = total - visible;

    // Category breakdown
    const categoryCounts = satelliteData.reduce((acc, sat) => {
      acc[sat.category] = (acc[sat.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Altitude analysis
    const altitudes = satelliteData.map((sat) => sat.position.alt);
    const minAltitude = Math.min(...altitudes);
    const maxAltitude = Math.max(...altitudes);
    const avgAltitude = altitudes.reduce((sum, alt) => sum + alt, 0) / total;

    // Altitude distribution
    const altitudeRanges = [
      { name: "Low Earth Orbit (0-2000km)", min: 0, max: 2000, count: 0 },
      {
        name: "Medium Earth Orbit (2000-35786km)",
        min: 2000,
        max: 35786,
        count: 0,
      },
      {
        name: "Geostationary Orbit (35786km+)",
        min: 35786,
        max: Infinity,
        count: 0,
      },
    ];

    altitudeRanges.forEach((range) => {
      range.count = satelliteData.filter(
        (sat) => sat.position.alt >= range.min && sat.position.alt < range.max
      ).length;
    });

    // Velocity analysis
    const velocities = satelliteData.map((sat) =>
      Math.sqrt(sat.velocity.x ** 2 + sat.velocity.y ** 2 + sat.velocity.z ** 2)
    );
    const avgVelocity = velocities.reduce((sum, vel) => sum + vel, 0) / total;
    const maxVelocity = Math.max(...velocities);

    // Geographic distribution
    const latRanges = [
      { name: "Polar (80°-90°)", min: 80, max: 90, count: 0 },
      { name: "High Latitude (60°-80°)", min: 60, max: 80, count: 0 },
      { name: "Mid Latitude (30°-60°)", min: 30, max: 60, count: 0 },
      { name: "Low Latitude (0°-30°)", min: 0, max: 30, count: 0 },
    ];

    latRanges.forEach((range) => {
      range.count = satelliteData.filter(
        (sat) =>
          Math.abs(sat.position.lat) >= range.min &&
          Math.abs(sat.position.lat) < range.max
      ).length;
    });

    return {
      total,
      visible,
      invisible,
      categoryCounts,
      altitude: { min: minAltitude, max: maxAltitude, avg: avgAltitude },
      altitudeRanges,
      velocity: { avg: avgVelocity, max: maxVelocity },
      latRanges,
    };
  }, [satelliteData]);

  if (!analysisData) {
    return (
      <div className={`bg-gray-900 text-white p-6 ${className}`}>
        <div className="text-center text-gray-400">
          No satellite data available for analysis
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 text-white p-6 overflow-y-auto ${className}`}>
      <h2 className="text-2xl font-bold mb-6 text-blue-400">
        Satellite Analysis
      </h2>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-400">
            {analysisData.total}
          </div>
          <div className="text-sm text-gray-400">Total Satellites</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-400">
            {analysisData.visible}
          </div>
          <div className="text-sm text-gray-400">Visible</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-400">
            {Object.keys(analysisData.categoryCounts).length}
          </div>
          <div className="text-sm text-gray-400">Categories</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-400">
            {Math.round(analysisData.altitude.avg)}km
          </div>
          <div className="text-sm text-gray-400">Avg Altitude</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-blue-400">
            Category Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(analysisData.categoryCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <div
                  key={category}
                  className="flex items-center justify-between"
                >
                  <span className="text-gray-300">{category}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${(count / analysisData.total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-400 w-12 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Altitude Distribution */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-green-400">
            Altitude Distribution
          </h3>
          <div className="space-y-3">
            {analysisData.altitudeRanges.map((range) => (
              <div
                key={range.name}
                className="flex items-center justify-between"
              >
                <span className="text-gray-300 text-sm">{range.name}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(range.count / analysisData.total) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-400 w-12 text-right">
                    {range.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Altitude Statistics */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-purple-400">
            Altitude Statistics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Minimum</span>
              <span className="text-purple-400">
                {Math.round(analysisData.altitude.min)} km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Maximum</span>
              <span className="text-purple-400">
                {Math.round(analysisData.altitude.max)} km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Average</span>
              <span className="text-purple-400">
                {Math.round(analysisData.altitude.avg)} km
              </span>
            </div>
          </div>
        </div>

        {/* Velocity Statistics */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-yellow-400">
            Velocity Statistics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Average Speed</span>
              <span className="text-yellow-400">
                {Math.round(analysisData.velocity.avg)} km/s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Maximum Speed</span>
              <span className="text-yellow-400">
                {Math.round(analysisData.velocity.max)} km/s
              </span>
            </div>
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="bg-gray-800 p-6 rounded-lg lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-red-400">
            Geographic Distribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analysisData.latRanges.map((range) => (
              <div key={range.name} className="text-center">
                <div className="text-2xl font-bold text-red-400">
                  {range.count}
                </div>
                <div className="text-sm text-gray-400">{range.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
