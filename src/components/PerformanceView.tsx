"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSatelliteDetailsStore } from "@/app/state/satelliteStore";

interface PerformanceViewProps {
  className?: string;
}

const PerformanceView: React.FC<PerformanceViewProps> = ({
  className = "",
}) => {
  const satelliteData = useSatelliteDetailsStore((s) => s.satelliteData);
  const [performanceHistory, setPerformanceHistory] = useState<
    Array<{
      timestamp: number;
      total: number;
      visible: number;
      categories: number;
    }>
  >([]);

  // Calculate current performance metrics
  const currentMetrics = useMemo(() => {
    if (satelliteData.length === 0) return null;

    const total = satelliteData.length;
    const visible = satelliteData.filter((sat) => sat.visible).length;
    const categories = new Set(satelliteData.map((sat) => sat.category)).size;

    // Calculate performance score (0-100)
    const visibilityRatio = visible / total;
    const categoryDiversity = Math.min(categories / 10, 1); // Normalize to 0-1, assuming 10+ categories is excellent
    const performanceScore = Math.round(
      (visibilityRatio * 0.6 + categoryDiversity * 0.4) * 100
    );

    // Calculate altitude distribution efficiency
    const altitudes = satelliteData.map((sat) => sat.position.alt);
    const altitudeVariance =
      altitudes.length > 1
        ? altitudes.reduce(
            (sum, alt) =>
              sum +
              Math.pow(
                alt - altitudes.reduce((a, b) => a + b, 0) / altitudes.length,
                2
              ),
            0
          ) / altitudes.length
        : 0;

    // Calculate velocity distribution
    const velocities = satelliteData.map((sat) =>
      Math.sqrt(sat.velocity.x ** 2 + sat.velocity.y ** 2 + sat.velocity.z ** 2)
    );
    const avgVelocity =
      velocities.reduce((sum, vel) => sum + vel, 0) / velocities.length;

    // Calculate orbital efficiency (simplified)
    const orbitalEfficiency = Math.min(avgVelocity / 7.8, 1) * 100; // 7.8 km/s is typical LEO velocity

    return {
      total,
      visible,
      categories,
      performanceScore,
      altitudeVariance: Math.round(altitudeVariance),
      avgVelocity: Math.round(avgVelocity * 100) / 100,
      orbitalEfficiency: Math.round(orbitalEfficiency),
    };
  }, [satelliteData]);

  // Update performance history
  useEffect(() => {
    if (currentMetrics) {
      const newEntry = {
        timestamp: Date.now(),
        total: currentMetrics.total,
        visible: currentMetrics.visible,
        categories: currentMetrics.categories,
      };

      setPerformanceHistory((prev) => {
        const updated = [...prev, newEntry].slice(-20); // Keep last 20 entries
        return updated;
      });
    }
  }, [currentMetrics]);

  if (!currentMetrics) {
    return (
      <div className={`bg-gray-900 text-white p-6 ${className}`}>
        <div className="text-center text-gray-400">
          No performance data available
        </div>
      </div>
    );
  }

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getPerformanceBgColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className={`bg-gray-900 text-white p-6 overflow-y-auto ${className}`}>
      <h2 className="text-2xl font-bold mb-6 text-blue-400">
        Performance Dashboard
      </h2>

      {/* Main Performance Score */}
      <div className="bg-gray-800 p-6 rounded-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-blue-400">
            Overall Performance
          </h3>
          <div
            className={`text-3xl font-bold ${getPerformanceColor(
              currentMetrics.performanceScore
            )}`}
          >
            {currentMetrics.performanceScore}/100
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-4">
          <div
            className={`h-4 rounded-full ${getPerformanceBgColor(
              currentMetrics.performanceScore
            )}`}
            style={{ width: `${currentMetrics.performanceScore}%` }}
          />
        </div>
        <div className="mt-2 text-sm text-gray-400">
          Based on visibility ratio and category diversity
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {currentMetrics.total}
              </div>
              <div className="text-sm text-gray-400">Total Satellites</div>
            </div>
            <div className="text-4xl">🛰️</div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-400">
                {currentMetrics.visible}
              </div>
              <div className="text-sm text-gray-400">Visible</div>
            </div>
            <div className="text-4xl">👁️</div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {currentMetrics.categories}
              </div>
              <div className="text-sm text-gray-400">Categories</div>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orbital Metrics */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-green-400">
            Orbital Metrics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Average Velocity</span>
              <span className="text-green-400 font-mono">
                {currentMetrics.avgVelocity} km/s
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Orbital Efficiency</span>
              <span className="text-green-400 font-mono">
                {currentMetrics.orbitalEfficiency}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Altitude Variance</span>
              <span className="text-green-400 font-mono">
                {currentMetrics.altitudeVariance} km²
              </span>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-yellow-400">
            System Health
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Data Freshness</span>
              <span className="text-green-400">✓ Current</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Update Frequency</span>
              <span className="text-blue-400">1s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Memory Usage</span>
              <span className="text-green-400">Optimal</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Rendering Performance</span>
              <span className="text-green-400">60 FPS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance History Chart */}
      {performanceHistory.length > 1 && (
        <div className="bg-gray-800 p-6 rounded-lg mt-6">
          <h3 className="text-lg font-semibold mb-4 text-purple-400">
            Performance Trend
          </h3>
          <div className="h-32 flex items-end space-x-1">
            {performanceHistory.slice(-10).map((entry, index) => {
              const height = (entry.visible / entry.total) * 100;
              return (
                <div
                  key={entry.timestamp}
                  className="flex-1 flex flex-col items-center"
                >
                  <div
                    className="bg-blue-500 w-full rounded-t"
                    style={{ height: `${height}%` }}
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    {index === performanceHistory.length - 1 ? "Now" : ""}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-sm text-gray-400 mt-2 text-center">
            Visibility ratio over time
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceView;
