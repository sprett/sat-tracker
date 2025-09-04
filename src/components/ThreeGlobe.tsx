"use client";

import React, { Suspense, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import Satellites from "./Satellites";
import SatelliteDetailsModal from "./SatelliteDetailsModal";
import StarField from "./StarField";
import FilterBar from "./FilterBar";
import SearchBar from "./SearchBar";
import AnalysisView from "./AnalysisView";
import { useSatellites } from "@/app/hooks/useSatellites";
import {
  useSatelliteDetailsStore,
  useFilterStore,
  FilterState,
  ViewMode,
} from "@/app/state/satelliteStore";

// Solar position calculation (simplified but accurate to ~0.1°)
function calculateSolarPosition(date: Date): THREE.Vector3 {
  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const n = julianDay - 2451545.0;

  // Mean longitude of the Sun
  const L = (280.46 + 0.9856474 * n) % 360;
  const L_rad = (L * Math.PI) / 180;

  // Mean anomaly
  const g = (357.528 + 0.9856003 * n) % 360;
  const g_rad = (g * Math.PI) / 180;

  // Ecliptic longitude
  const lambda =
    L_rad +
    ((1.915 * Math.sin(g_rad) + 0.02 * Math.sin(2 * g_rad)) * Math.PI) / 180;

  // Obliquity of the ecliptic
  const epsilon = 23.439 - 0.0000004 * n;
  const epsilon_rad = (epsilon * Math.PI) / 180;

  // Right ascension and declination
  const alpha = Math.atan2(
    Math.cos(epsilon_rad) * Math.sin(lambda),
    Math.cos(lambda)
  );
  const delta = Math.asin(Math.sin(epsilon_rad) * Math.sin(lambda));

  // Convert to Earth-centered direction vector
  const x = Math.cos(delta) * Math.cos(alpha);
  const y = Math.cos(delta) * Math.sin(alpha);
  const z = Math.sin(delta);

  return new THREE.Vector3(x, y, z);
}

function Earth() {
  const dayTexture = useTexture("assets/earth-dayv2.png");
  const nightTexture = useTexture("assets/earth-night.png");
  const [sunDirection, setSunDirection] = useState(new THREE.Vector3(1, 0, 0));

  // Update sun direction in real-time
  useFrame(() => {
    const now = new Date();
    const sunPos = calculateSolarPosition(now);
    setSunDirection(sunPos);
  });

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTexture },
        nightTexture: { value: nightTexture },
        sunDirection: { value: sunDirection },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldNormal;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          
          // Calculate world space normal
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          
          gl_Position = projectionMatrix * vec4(vPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;
        uniform float time;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldNormal;
        
        void main() {
          // Sample both textures
          vec3 dayColor = texture2D(dayTexture, vUv).rgb;
          vec3 nightColor = texture2D(nightTexture, vUv).rgb;
          
          // Calculate dot product between world space normal and sun direction
          float sunDot = dot(vWorldNormal, sunDirection);
          
          // Create smooth day/night transition
          float dayNightMix = smoothstep(-0.1, 0.1, sunDot);
          
          // Blend day and night textures
          vec3 finalColor = mix(nightColor, dayColor, dayNightMix);
          
          // Add subtle atmospheric glow at terminator
          float terminator = 1.0 - abs(sunDot);
          vec3 atmosphereGlow = vec3(0.1, 0.2, 0.4) * terminator * 0.3;
          finalColor += atmosphereGlow;
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }, [dayTexture, nightTexture]);

  // Update sun direction uniform
  React.useEffect(() => {
    if (material.uniforms) {
      material.uniforms.sunDirection.value = sunDirection;
    }
  }, [sunDirection, material]);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 96, 96]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}

export default function ThreeGlobe() {
  // Initialize worker fetch + propagation loop so Satellites InstancedMesh receives updates
  useSatellites({ updateInterval: 1000 });

  // Store hooks
  const selectedSatellite = useSatelliteDetailsStore(
    (s) => s.selectedSatellite
  );
  const setSelectedSatellite = useSatelliteDetailsStore(
    (s) => s.setSelectedSatellite
  );
  const satelliteData = useSatelliteDetailsStore((s) => s.satelliteData);
  const setFilteredSatelliteData = useSatelliteDetailsStore(
    (s) => s.setFilteredSatelliteData
  );

  const filters = useFilterStore((s) => s.filters);
  const viewMode = useFilterStore((s) => s.viewMode);
  const setFilters = useFilterStore((s) => s.setFilters);
  const setViewMode = useFilterStore((s) => s.setViewMode);
  const applyFilters = useFilterStore((s) => s.applyFilters);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Apply filters whenever satellite data or filters change
  useEffect(() => {
    if (satelliteData.length > 0) {
      const filtered = applyFilters(satelliteData, filters);
      setFilteredSatelliteData(filtered);
    }
  }, [satelliteData, filters, applyFilters, setFilteredSatelliteData]);

  // Show modal when a satellite is selected
  React.useEffect(() => {
    if (selectedSatellite) {
      setIsModalOpen(true);
    }
  }, [selectedSatellite]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSatellite(null);
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleSearchChange = (searchTerm: string) => {
    setFilters({ ...filters, searchTerm });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const renderView = () => {
    switch (viewMode) {
      case "analysis":
        return <AnalysisView className="h-full" />;
      case "globe":
      default:
        return (
          <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
            <color attach="background" args={["#000011"]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 3, 5]} intensity={1.2} />
            <Suspense fallback={null}>
              <StarField />
              <Earth />
              <Satellites />
            </Suspense>
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              zoomSpeed={0.3}
              minDistance={1.5}
              maxDistance={14}
            />
          </Canvas>
        );
    }
  };

  return (
    <div
      className="w-full h-screen flex flex-col"
      style={{ background: "#000011" }}
    >
      <SearchBar
        onSearchChange={handleSearchChange}
        onFilterChange={handleFilterChange}
        searchTerm={filters.searchTerm}
        filters={filters}
      />
      <FilterBar
        onFilterChange={handleFilterChange}
        onViewModeChange={handleViewModeChange}
      />
      <div className="flex-1 relative">{renderView()}</div>
      <SatelliteDetailsModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  );
}
