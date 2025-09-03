"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import Satellites from "./Satellites";
import { useSatellites } from "@/app/hooks/useSatellites";

function Earth() {
  const colorMap = useTexture(
    "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
  );
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhongMaterial
          map={colorMap}
          specular={new THREE.Color("#222")}
          shininess={5}
        />
      </mesh>
      {/* Atmosphere */}
      <mesh scale={[1.05, 1.05, 1.05]}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          vertexShader={`
						varying vec3 vNormal;
						void main(){
							vNormal = normalize(normalMatrix * normal);
							gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
						}
					`}
          fragmentShader={`
						varying vec3 vNormal;
						void main(){
							float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
							gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
						}
					`}
        />
      </mesh>
    </group>
  );
}

export default function ThreeGlobe() {
  // Initialize worker fetch + propagation loop so Satellites InstancedMesh receives updates
  useSatellites({ updateInterval: 1000 });
  return (
    <div className="w-full h-screen" style={{ background: "#000011" }}>
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
        <color attach="background" args={["#000011"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 3, 5]} intensity={1.0} />
        <Suspense fallback={null}>
          <Earth />
          <Satellites />
        </Suspense>
        <OrbitControls enableDamping dampingFactor={0.1} />
      </Canvas>
    </div>
  );
}
