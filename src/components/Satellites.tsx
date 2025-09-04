"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useSatellitePositionsStore,
  useSatelliteDetailsStore,
} from "@/app/state/satelliteStore";
import * as THREE from "three";
import { InstancedMesh } from "three";
import { useFrame, useThree } from "@react-three/fiber";

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
  const satelliteData = useSatelliteDetailsStore((s) => s.satelliteData);
  const filteredSatelliteData = useSatelliteDetailsStore(
    (s) => s.filteredSatelliteData
  );
  const setSelectedSatellite = useSatelliteDetailsStore(
    (s) => s.setSelectedSatellite
  );

  // Use filtered data if available, otherwise fall back to all data
  const displayData =
    filteredSatelliteData.length > 0 ? filteredSatelliteData : satelliteData;
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { camera, raycaster, pointer } = useThree();
  const [hoveredInstance, setHoveredInstance] = useState<number | null>(null);

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

  // Keep material color constant
  useEffect(() => {
    if (material) {
      material.color.setHex(0xffeb3b); // Always yellow
    }
  }, [material]);

  // Handle hover detection
  const handlePointerMove = (event: any) => {
    if (!meshRef.current || displayData.length === 0) return;

    // Update raycaster with mouse position
    raycaster.setFromCamera(pointer, camera);

    // Get intersections with the instanced mesh
    const intersects = raycaster.intersectObject(meshRef.current);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const instanceId = intersection.instanceId;

      if (instanceId !== undefined && instanceId < displayData.length) {
        setHoveredInstance(instanceId);
        // Change cursor to pointer when hovering over satellite
        document.body.style.cursor = "pointer";
        event.stopPropagation();
      } else {
        setHoveredInstance(null);
        document.body.style.cursor = "default";
      }
    } else {
      setHoveredInstance(null);
      document.body.style.cursor = "default";
    }
  };

  // Handle click detection
  const handleClick = (event: any) => {
    if (!meshRef.current || displayData.length === 0) return;

    // Update raycaster with mouse position
    raycaster.setFromCamera(pointer, camera);

    // Get intersections with the instanced mesh
    const intersects = raycaster.intersectObject(meshRef.current);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const instanceId = intersection.instanceId;

      if (instanceId !== undefined && instanceId < displayData.length) {
        const selectedSatellite = displayData[instanceId];
        setSelectedSatellite(selectedSatellite);
      }
    }
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined as any, undefined as any, MAX_SATELLITES]}
      frustumCulled={false}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setHoveredInstance(null);
        document.body.style.cursor = "default";
      }}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}
