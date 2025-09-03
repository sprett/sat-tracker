"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useSatellitePositionsStore } from "@/app/state/satelliteStore";
import * as THREE from "three";
import { InstancedMesh } from "three";

const EARTH_RADIUS_KM = 6371;

function latLonAltToCartesian(latDeg: number, lonDeg: number, altKm: number) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const radius = (EARTH_RADIUS_KM + altKm) / EARTH_RADIUS_KM; // normalized so Earth radius = 1.0
  const cosLat = Math.cos(lat);
  const x = radius * cosLat * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = radius * cosLat * Math.sin(lon);
  return { x, y, z };
}

const MAX_SATELLITES = 30000;

export default function Satellites() {
  const positionsF32 = useSatellitePositionsStore((s) => s.positionsF32);
  const count = useSatellitePositionsStore((s) => s.count);
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Update instance matrices when new positions arrive
  useEffect(() => {
    if (!positionsF32 || !meshRef.current) return;
    const mesh = meshRef.current;
    const n = Math.min(count, Math.floor(positionsF32.length / 3));
    mesh.count = n;
    for (let i = 0; i < n; i++) {
      const base = i * 3;
      const lat = positionsF32[base + 0];
      const lon = positionsF32[base + 1];
      const alt = positionsF32[base + 2];
      const { x, y, z } = latLonAltToCartesian(lat, lon, alt);
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.006);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [positionsF32, count, dummy]);

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xffeb3b }),
    []
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined as any, undefined as any, MAX_SATELLITES]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}
