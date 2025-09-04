"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

// Predetermined star positions for consistent rendering
const generateStarPositions = () => {
  const starCount = 2000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  // Use a fixed seed for consistent star positions
  const random = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < starCount; i++) {
    // Generate random points on a sphere using deterministic seed
    const radius = 15 + random(i * 1.1) * 5; // Random distance from center
    const theta = random(i * 1.3) * Math.PI * 2; // Random azimuth
    const phi = Math.acos(2 * random(i * 1.7) - 1); // Random elevation

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Star colors with slight variations (mostly white with some blue/red tints)
    const colorVariation = 0.4 + random(i * 1.5) * 0.6;
    colors[i * 3] = colorVariation; // R
    colors[i * 3 + 1] = colorVariation * (0.8 + random(i * 1.9) * 0.4); // G
    colors[i * 3 + 2] = colorVariation * (0.9 + random(i * 2.1) * 0.2); // B
  }

  return { positions, colors };
};

export default function StarField() {
  const stars = useMemo(() => generateStarPositions(), []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[stars.positions, 3]}
        />
        <bufferAttribute attach="attributes-color" args={[stars.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        sizeAttenuation={true}
        vertexColors={true}
        transparent={true}
        opacity={0.9}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
