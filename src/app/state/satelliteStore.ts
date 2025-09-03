"use client";

import { create } from "zustand";

type SatellitePositionsState = {
  positionsF32: Float32Array | null;
  count: number;
  setPositionsF32: (array: Float32Array, count: number) => void;
};

export const useSatellitePositionsStore = create<SatellitePositionsState>(
  (set) => ({
    positionsF32: null,
    count: 0,
    setPositionsF32: (array: Float32Array, count: number) =>
      set({ positionsF32: array, count }),
  })
);
