"use client";

import { create } from "zustand";

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

export interface FilterState {
  searchTerm: string;
  category: string;
  altitudeRange: [number, number];
  visibility: "all" | "visible" | "invisible";
  showOnlyActive: boolean;
}

export type ViewMode = "globe" | "analysis" | "details";

type SatellitePositionsState = {
  positionsF32: Float32Array | null;
  count: number;
  setPositionsF32: (array: Float32Array, count: number) => void;
};

type SatelliteDetailsState = {
  selectedSatellite: SatellitePosition | null;
  setSelectedSatellite: (satellite: SatellitePosition | null) => void;
  satelliteData: SatellitePosition[];
  setSatelliteData: (data: SatellitePosition[]) => void;
  filteredSatelliteData: SatellitePosition[];
  setFilteredSatelliteData: (data: SatellitePosition[]) => void;
};

type FilterStoreState = {
  filters: FilterState;
  viewMode: ViewMode;
  setFilters: (filters: FilterState) => void;
  setViewMode: (mode: ViewMode) => void;
  applyFilters: (
    satelliteData: SatellitePosition[],
    filters: FilterState
  ) => SatellitePosition[];
};

export const useSatellitePositionsStore = create<SatellitePositionsState>(
  (set) => ({
    positionsF32: null,
    count: 0,
    setPositionsF32: (array: Float32Array, count: number) =>
      set({ positionsF32: array, count }),
  })
);

export const useSatelliteDetailsStore = create<SatelliteDetailsState>(
  (set) => ({
    selectedSatellite: null,
    setSelectedSatellite: (satellite: SatellitePosition | null) =>
      set({ selectedSatellite: satellite }),
    satelliteData: [],
    setSatelliteData: (data: SatellitePosition[]) =>
      set({ satelliteData: data }),
    filteredSatelliteData: [],
    setFilteredSatelliteData: (data: SatellitePosition[]) =>
      set({ filteredSatelliteData: data }),
  })
);

export const useFilterStore = create<FilterStoreState>((set, get) => ({
  filters: {
    searchTerm: "",
    category: "all",
    altitudeRange: [0, 2000],
    visibility: "all",
    showOnlyActive: false,
  },
  viewMode: "globe",
  setFilters: (filters: FilterState) => set({ filters }),
  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  applyFilters: (satelliteData: SatellitePosition[], filters: FilterState) => {
    return satelliteData.filter((satellite) => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch =
          satellite.name.toLowerCase().includes(searchLower) ||
          satellite.noradId.toLowerCase().includes(searchLower) ||
          satellite.category.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (
        filters.category !== "all" &&
        satellite.category !== filters.category
      ) {
        return false;
      }

      // Altitude range filter
      const altitude = satellite.position.alt;
      if (
        altitude < filters.altitudeRange[0] ||
        altitude > filters.altitudeRange[1]
      ) {
        return false;
      }

      // Visibility filter
      if (filters.visibility === "visible" && !satellite.visible) {
        return false;
      }
      if (filters.visibility === "invisible" && satellite.visible) {
        return false;
      }

      return true;
    });
  },
}));
