"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

// 3D Road Component with proper perspective
function Road({ segments, position, laneIndex }) {
  const roadRef = useRef();
  const segmentLength = 100;
  const roadWidth = 20; // Increased road width for visibility
  const laneWidth = roadWidth / 3;
  const perspectiveFactor = 0.002; // How much road narrows per unit distance

  // Create road geometry with proper 3D perspective
  const roadGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const uvs = [];
    const colors = [];
    const normals = [];

    segments.forEach((terrain, idx) => {
      const z = idx * segmentLength;
      const nextZ = (idx + 1) * segmentLength;
      
      // Terrain colors
      let color;
      if (terrain === "desert") {
        color = new THREE.Color(0xd4a574);
      } else if (terrain === "muddy") {
        color = new THREE.Color(0x6b4423);
      } else {
        color = new THREE.Color(0x2a2d35);
      }

      // Perspective: road gets narrower as it goes away (larger Z)
      const perspectiveAtZ = 1 / (1 + z * perspectiveFactor);
      const perspectiveAtNextZ = 1 / (1 + nextZ * perspectiveFactor);
      
      const widthAtZ = roadWidth * perspectiveAtZ;
      const widthAtNextZ = roadWidth * perspectiveAtNextZ;
      const laneX = (laneIndex - 1) * (roadWidth / 3);

      // Vertices for this segment (trapezoid shape for perspective)
      const v0 = new THREE.Vector3(laneX - widthAtZ / 2, 0, z);
      const v1 = new THREE.Vector3(laneX + widthAtZ / 2, 0, z);
      const v2 = new THREE.Vector3(laneX + widthAtNextZ / 2, 0, nextZ);
      const v3 = new THREE.Vector3(laneX - widthAtNextZ / 2, 0, nextZ);

      const baseIndex = vertices.length / 3;
      vertices.push(v0.x, v0.y, v0.z);
      vertices.push(v1.x, v1.y, v1.z);
      vertices.push(v2.x, v2.y, v2.z);
      vertices.push(v3.x, v3.y, v3.z);

      // Indices for two triangles
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
      indices.push(baseIndex, baseIndex + 2, baseIndex + 3);

      // UVs
      uvs.push(0, 0);
      uvs.push(1, 0);
      uvs.push(1, 1);
      uvs.push(0, 1);

      // Colors
      colors.push(color.r, color.g, color.b);
      colors.push(color.r, color.g, color.b);
      colors.push(color.r, color.g, color.b);
      colors.push(color.r, color.g, color.b);

      // Normals (pointing up)
      for (let i = 0; i < 4; i++) {
        normals.push(0, 1, 0);
      }
    });

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);

    return geometry;
  }, [segments, laneIndex]);

  return (
    <mesh ref={roadRef} geometry={roadGeometry} position={position} receiveShadow>
      <meshStandardMaterial 
        vertexColors 
        roughness={0.7} 
        metalness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Car Component using top-view image sprite
function Car3D({ car, progress, position, trackIndex, carImageUrl }) {
  const carRef = useRef();
  const [texture, setTexture] = useState(null);
  const totalDistance = 300; // 300m track
  const distance = (progress / 100) * totalDistance;
  const perspectiveFactor = 0.002;
  
  // Calculate Z position (car moves forward along Z axis)
  const z = distance;
  
  // Calculate scale based on distance (realistic perspective)
  const perspectiveScale = 1 / (1 + z * perspectiveFactor);
  const carScale = Math.max(0.3, perspectiveScale) * 2; // Scale for visibility

  // Calculate X position with perspective (lanes converge)
  const baseLaneX = (trackIndex - 1) * (20 / 3); // Base lane spacing (matches road width)
  const perspectiveLaneX = baseLaneX * perspectiveScale;

  // Load car image texture
  useEffect(() => {
    if (carImageUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        carImageUrl,
        (loadedTexture) => {
          loadedTexture.flipY = false; // Don't flip Y for top view
          setTexture(loadedTexture);
        },
        undefined,
        (error) => {
          console.error("Error loading car image:", error);
        }
      );
    }
  }, [carImageUrl]);

  useFrame(() => {
    if (carRef.current) {
      carRef.current.position.z = z;
      carRef.current.position.x = perspectiveLaneX;
      carRef.current.scale.set(carScale, carScale, 1);
    }
  });

  // Fallback color if no image
  const name = car?.name?.toLowerCase() || "";
  let carColor = "#ef4444";
  if (name.includes("red") || name.includes("super")) carColor = "#ef4444";
  else if (name.includes("blue") || name.includes("police")) carColor = "#3b82f6";
  else if (name.includes("green") || name.includes("monster")) carColor = "#22c55e";

  return (
    <mesh
      ref={carRef}
      position={[perspectiveLaneX, 0.3, z]}
      rotation={[-Math.PI / 2, 0, 0]} // Rotate to lay flat (top view)
    >
      <planeGeometry args={[2, 2]} />
      {texture ? (
        <meshStandardMaterial map={texture} transparent alphaTest={0.1} />
      ) : (
        <meshStandardMaterial color={carColor} />
      )}
    </mesh>
  );
}

// Main 3D Scene
function Scene3D({ game, raceProgress, gameStatus, tracks, cars }) {
  const progressMap = raceProgress || {};
  const isRacing = gameStatus === "racing";
  const isPredictions = gameStatus === "predictions";

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.5} />

      {/* Ground/grass with proper perspective */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 150]} receiveShadow>
        <planeGeometry args={[100, 400]} />
        <meshStandardMaterial color="#1f9d55" roughness={1} />
      </mesh>

      {/* Main road surface (all lanes combined) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 150]} receiveShadow>
        <planeGeometry args={[30, 300]} />
        <meshStandardMaterial color="#2a2d35" roughness={0.8} />
      </mesh>

      {/* Individual lane roads with terrain */}
      {tracks?.map((track, index) => (
        <Road
          key={index}
          segments={track.segments || ["regular", "regular", "regular"]}
          position={[(index - 1) * (20 / 3), 0.01, 0]} // Slightly above ground
          laneIndex={index + 1}
        />
      ))}

      {/* Lane dividers */}
      {[1, 2].map((dividerIndex) => {
        const xPos = (dividerIndex - 1.5) * (20 / 3);
        return (
          <mesh
            key={dividerIndex}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[xPos, 0.02, 150]}
          >
            <planeGeometry args={[0.2, 300]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        );
      })}

      {/* Cars */}
      {cars?.map((assignment, index) => {
        const car = assignment?.carId || assignment;
        if (!car) return null;
        const carId = car?._id?.toString() || car?.toString() || car?._id || car;
        const progress = isRacing ? (progressMap[carId]?.progress || 0) : 0;
        const trackNumber = assignment?.trackNumber || index + 1;
        const carImageUrl = car?.topViewImage || null;

        return (
          <Car3D
            key={carId}
            car={car}
            progress={progress}
            position={[0, 0, 0]}
            trackIndex={trackNumber}
            carImageUrl={carImageUrl}
          />
        );
      })}

      {/* Camera controls - fixed perspective from start line */}
      <PerspectiveCamera
        makeDefault
        position={[0, 15, 30]}
        fov={70}
        near={0.1}
        far={500}
      />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={25}
        maxDistance={100}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI / 2}
        target={[0, 0, 100]}
        enableRotate={false}
      />
    </>
  );
}

// Main 3D Game Component
export default function Game3D({ game, raceProgress, gameStatus, tracks, cars }) {
  // Default tracks if none provided
  const defaultTracks = [
    { segments: ["regular", "regular", "regular"] },
    { segments: ["desert", "desert", "desert"] },
    { segments: ["muddy", "muddy", "muddy"] },
  ];
  
  const gameTracks = tracks && tracks.length > 0 ? tracks : defaultTracks;
  const gameCars = cars && cars.length > 0 ? cars : [];

  return (
    <div style={{ width: "100%", height: "100%", background: "#1f9d55" }}>
      <Canvas shadows>
        <Scene3D
          game={game}
          raceProgress={raceProgress || {}}
          gameStatus={gameStatus || "waiting"}
          tracks={gameTracks}
          cars={gameCars}
        />
      </Canvas>
    </div>
  );
}

