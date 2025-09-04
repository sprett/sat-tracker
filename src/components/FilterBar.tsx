"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  useSatelliteDetailsStore,
  FilterState,
  ViewMode,
} from "@/app/state/satelliteStore";
import { Globe, Settings, Filter, HelpCircle } from "lucide-react";

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  onViewModeChange,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: "",
    category: "all",
    altitudeRange: [0, 2000],
    visibility: "all",
    showOnlyActive: false,
  });

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const satelliteData = useSatelliteDetailsStore((s) => s.satelliteData);

  // Get unique categories from satellite data
  const categories = React.useMemo(() => {
    const cats = new Set(satelliteData.map((sat) => sat.category));
    return Array.from(cats).sort();
  }, [satelliteData]);

  // Calculate performance metrics
  const performanceMetrics = React.useMemo(() => {
    const total = satelliteData.length;
    const visible = satelliteData.filter((sat) => sat.visible).length;
    const categories = new Set(satelliteData.map((sat) => sat.category)).size;
    const avgAltitude =
      satelliteData.reduce((sum, sat) => sum + sat.position.alt, 0) / total;

    return {
      total,
      visible,
      categories,
      avgAltitude: Math.round(avgAltitude),
    };
  }, [satelliteData]);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const handleDropdownToggle = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const resetFilters = () => {
    const defaultFilters: FilterState = {
      searchTerm: "",
      category: "all",
      altitudeRange: [0, 2000],
      visibility: "all",
      showOnlyActive: false,
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeDropdown]);

  return (
    <>
      {/* Floating Icon Bar */}
      <div className="fixed top-4 right-4 z-50" ref={dropdownRef}>
        <div className="bg-gray-800/90 backdrop-blur-xs border border-gray-600 rounded-lg p-2 flex items-center space-x-1">
          {/* Globe Dropdown */}
          <div className="relative">
            <button
              onClick={() => handleDropdownToggle("globe")}
              className={`p-2 rounded transition-colors ${
                activeDropdown === "globe"
                  ? "bg-blue-600 text-white"
                  : "text-white hover:bg-gray-700"
              }`}
              title="Globe Settings"
            >
              <Globe className="w-5 h-5" />
            </button>
            {activeDropdown === "globe" && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-2">
                <div className="text-sm text-gray-300 space-y-1">
                  <div className="px-3 py-2 hover:bg-gray-700 rounded cursor-pointer">
                    View Settings
                  </div>
                  <div className="px-3 py-2 hover:bg-gray-700 rounded cursor-pointer">
                    Camera Controls
                  </div>
                  <div className="px-3 py-2 hover:bg-gray-700 rounded cursor-pointer">
                    Display Options
                  </div>
                  <div className="px-3 py-2 hover:bg-gray-700 rounded cursor-pointer">
                    Reset View
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Satellite Details Popup */}
          <div className="relative">
            <button
              onClick={() => handleDropdownToggle("details")}
              className={`p-2 rounded transition-colors ${
                activeDropdown === "details"
                  ? "bg-blue-600 text-white"
                  : "text-white hover:bg-gray-700"
              }`}
              title="Satellite Details"
            >
              <Settings className="w-5 h-5" />
            </button>
            {activeDropdown === "details" && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-4">
                <div className="text-sm text-gray-300 space-y-3">
                  <div className="font-semibold text-white mb-2">
                    Satellite Information
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Satellites:</span>
                      <span className="text-blue-400">
                        {performanceMetrics.total}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Visible:</span>
                      <span className="text-green-400">
                        {performanceMetrics.visible}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Categories:</span>
                      <span className="text-purple-400">
                        {performanceMetrics.categories}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Altitude:</span>
                      <span className="text-yellow-400">
                        {Math.round(performanceMetrics.avgAltitude)}km
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filter Settings */}
          <div className="relative">
            <button
              onClick={() => handleDropdownToggle("filter")}
              className={`p-2 rounded transition-colors ${
                activeDropdown === "filter"
                  ? "bg-blue-600 text-white"
                  : "text-white hover:bg-gray-700"
              }`}
              title="Filter Settings"
            >
              <Filter className="w-5 h-5" />
            </button>
            {activeDropdown === "filter" && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-3">
                <div className="text-sm text-gray-300 space-y-3">
                  <div className="font-semibold text-white mb-2">
                    Filter by Category
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      <span>Communication</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      <span>Navigation</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      <span>Weather</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      <span>Scientific</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      <span>Military</span>
                    </label>
                  </div>
                  <div className="pt-2 border-t border-gray-600">
                    <button className="w-full px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs">
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Help */}
          <div className="relative">
            <button
              onClick={() => handleDropdownToggle("help")}
              className={`p-2 rounded transition-colors ${
                activeDropdown === "help"
                  ? "bg-blue-600 text-white"
                  : "text-white hover:bg-gray-700"
              }`}
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            {activeDropdown === "help" && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-4">
                <div className="text-sm text-gray-300 space-y-3">
                  <div className="font-semibold text-white mb-2">
                    Help & Information
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400">
                      <strong>Globe:</strong> View and control the 3D Earth view
                    </div>
                    <div className="text-xs text-gray-400">
                      <strong>Details:</strong> View satellite statistics and
                      information
                    </div>
                    <div className="text-xs text-gray-400">
                      <strong>Filter:</strong> Filter satellites by category and
                      properties
                    </div>
                    <div className="text-xs text-gray-400">
                      <strong>Help:</strong> Get assistance and learn about
                      features
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-600">
                    <button className="w-full px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs">
                      View Documentation
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FilterBar;
