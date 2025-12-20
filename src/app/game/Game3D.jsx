"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

// Lane Divider Component with perspective
function LaneDivider({ baseXPos, position }) {
  const perspectiveFactor = 0.001;
  
  const dividerGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const segmentCount = 30; // More segments for smooth perspective
    
    for (let i = 0; i <= segmentCount; i++) {
      const z = (i / segmentCount) * 300;
      const perspectiveScale = 1 / (1 + z * perspectiveFactor);
      const xPos = baseXPos * perspectiveScale;
      const width = 0.2 * perspectiveScale;
      
      vertices.push(xPos - width / 2, 0, z);
      vertices.push(xPos + width / 2, 0, z);
    }
    
    for (let i = 0; i < segmentCount; i++) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
    
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
  }, [baseXPos]);
  
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      geometry={dividerGeometry}
    >
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
    </mesh>
  );
}

// Finish Line Component
function FinishLine({ position, width }) {
  const finishTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 20;
    const ctx = canvas.getContext("2d");
    
    // Checkered pattern
    const cellSize = 10;
    for (let x = 0; x < canvas.width; x += cellSize) {
      for (let y = 0; y < canvas.height; y += cellSize) {
        const isBlack = ((x / cellSize) + (y / cellSize)) % 2 === 0;
        ctx.fillStyle = isBlack ? "#000000" : "#ffffff";
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(width / 10, 1);
    return texture;
  }, [width]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <planeGeometry args={[width, 3]} />
      <meshStandardMaterial map={finishTexture} emissive={0xffffff} emissiveIntensity={0.2} />
    </mesh>
  );
}

// 3D Road Component with proper perspective
function Road({ segments, position, laneIndex }) {
  const roadRef = useRef();
  const segmentLength = 100;
  const roadWidth = 20; // Increased road width for visibility
  const laneWidth = roadWidth / 3;
  const perspectiveFactor = 0.001; // Reduced for less dramatic perspective

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
      // Position is already set correctly in parent, so center the road at origin
      const laneX = 0;

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
function Car3D({ car, progress, position, trackIndex, carImageUrl, currentTerrain, isRacing }) {
  const carRef = useRef();
  const meshRef = useRef();
  const particlesRef = useRef([]);
  const [texture, setTexture] = useState(null);
  const totalDistance = 300; // 300m track
  const distance = (progress / 100) * totalDistance;
  const perspectiveFactor = 0.001;
  const roadWidth = 20;
  
  // Calculate Z position (car moves forward along Z axis)
  const z = distance;
  
  // Calculate scale based on distance (consistent with road perspective)
  const perspectiveScale = 1 / (1 + z * perspectiveFactor);
  const carScale = Math.max(0.4, perspectiveScale) * 3; // Larger scale for visibility

  // Calculate X position with perspective (lanes converge) - match road calculation
  const baseLaneX = (trackIndex - 1) * (roadWidth / 3); // Base lane spacing
  const perspectiveLaneX = baseLaneX * perspectiveScale;

  // Load car image texture
  useEffect(() => {
    if (carImageUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        carImageUrl,
        (loadedTexture) => {
          loadedTexture.flipY = false; // Don't flip Y for top view
          loadedTexture.generateMipmaps = true;
          loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
          loadedTexture.magFilter = THREE.LinearFilter;
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
    if (carRef.current && meshRef.current) {
      carRef.current.position.z = z;
      carRef.current.position.x = perspectiveLaneX;
      meshRef.current.scale.set(carScale, carScale, 1);
    }
  });

  // Fallback color if no image
  const name = car?.name?.toLowerCase() || "";
  let carColor = "#ef4444";
  if (name.includes("red") || name.includes("super")) carColor = "#ef4444";
  else if (name.includes("blue") || name.includes("police")) carColor = "#3b82f6";
  else if (name.includes("green") || name.includes("monster")) carColor = "#22c55e";

  // Generate particles dynamically
  useFrame(() => {
    if (isRacing && progress > 0 && progress < 100 && (currentTerrain === "desert" || currentTerrain === "muddy")) {
      // Add particles occasionally
      if (Math.random() < 0.1) {
        const particleCount = currentTerrain === "desert" ? 2 : 3;
        for (let i = 0; i < particleCount; i++) {
          const offsetX = (Math.random() - 0.5) * 1.5;
          const offsetZ = (Math.random() - 0.5) * 1.5;
          particlesRef.current.push({
            id: Date.now() + i,
            x: perspectiveLaneX + offsetX,
            y: 0.2,
            z: z + offsetZ,
            type: currentTerrain === "desert" ? "dust" : "mud",
            scale: carScale * 0.3,
            opacity: 0.8,
          });
        }
      }
      
      // Update and remove old particles
      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, y: p.y + 0.01 * p.scale, opacity: p.opacity - 0.02 }))
        .filter(p => p.opacity > 0 && p.y < 2);
    } else {
      particlesRef.current = [];
    }
  });

  return (
    <group ref={carRef} position={[perspectiveLaneX, 0.5, z]}>
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]} // Rotate to lay flat (top view)
      >
        <planeGeometry args={[3, 3]} />
        {texture ? (
          <meshBasicMaterial 
            map={texture} 
            transparent 
            alphaTest={0.05}
            side={THREE.DoubleSide}
          />
        ) : (
          <meshBasicMaterial color={carColor} side={THREE.DoubleSide} />
        )}
      </mesh>
      
      {/* Particles aligned with car position */}
      {particlesRef.current.map((particle) => (
        <mesh key={particle.id} position={[particle.x, particle.y, particle.z]}>
          <sphereGeometry args={[particle.scale, 8, 8]} />
          <meshBasicMaterial 
            color={particle.type === "dust" ? "#fbbf24" : "#78350f"} 
            transparent 
            opacity={particle.opacity} 
          />
        </mesh>
      ))}
    </group>
  );
}

// Main 3D Scene
function Scene3D({ game, raceProgress, gameStatus, tracks, cars }) {
  const progressMap = raceProgress || {};
  const isRacing = gameStatus === "racing";
  const isPredictions = gameStatus === "predictions";

  return (
    <>
      {/* Lighting - brighter for better car image visibility */}
      <ambientLight intensity={1.0} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.8} />
      <directionalLight position={[-10, 10, 5]} intensity={0.5} />

      {/* Ground/grass - extended to cover full track */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 150]} receiveShadow>
        <planeGeometry args={[150, 500]} />
        <meshStandardMaterial color="#1f9d55" roughness={1} />
      </mesh>

      {/* Main road surface (all lanes combined) - extended to cover full track */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 150]} receiveShadow>
        <planeGeometry args={[40, 350]} />
        <meshStandardMaterial color="#2a2d35" roughness={0.8} />
      </mesh>

      {/* Individual lane roads with terrain - properly aligned */}
      {tracks?.map((track, index) => {
        const laneIndex = index + 1; // 1, 2, 3
        const baseLaneX = (laneIndex - 1) * (20 / 3); // Same calculation as cars
        return (
          <Road
            key={index}
            segments={track.segments || ["regular", "regular", "regular"]}
            position={[baseLaneX, 0.01, 0]} // Aligned with car lane positions
            laneIndex={laneIndex}
          />
        );
      })}

      {/* Lane dividers with perspective - aligned with roads */}
      {[1, 2].map((dividerIndex) => {
        const baseXPos = (dividerIndex - 1.5) * (20 / 3);
        return (
          <LaneDivider
            key={dividerIndex}
            baseXPos={baseXPos}
            position={[0, 0.02, 0]}
          />
        );
      })}

      {/* Finish line - checkered pattern at the end with perspective */}
      <FinishLine position={[0, 0.03, 300]} width={20} />

      {/* Cars */}
      {cars?.map((assignment, index) => {
        const car = assignment?.carId || assignment;
        if (!car) return null;
        const carId = car?._id?.toString() || car?.toString() || car?._id || car;
        const progress = isRacing ? (progressMap[carId]?.progress || 0) : 0;
        const trackNumber = assignment?.trackNumber || index + 1;
        const carImageUrl = car?.topViewImage || null;
        
        // Calculate current terrain based on progress
        const track = tracks?.[index] || tracks?.[trackNumber - 1];
        const segmentCount = track?.segments?.length || 3;
        const segmentLength = 100; // 100m per segment
        const totalDistance = (progress / 100) * 300; // Total track is 300m
        const currentSegment = Math.min(
          Math.floor(totalDistance / segmentLength),
          segmentCount - 1
        );
        const currentTerrain = track?.segments?.[currentSegment] || "regular";

        return (
          <Car3D
            key={carId}
            car={car}
            progress={progress}
            position={[0, 0, 0]}
            trackIndex={trackNumber}
            carImageUrl={carImageUrl}
            currentTerrain={currentTerrain}
            isRacing={isRacing}
          />
        );
      })}

      {/* Camera controls - view full track from start (0%) to finish (100%) */}
      <PerspectiveCamera
        makeDefault
        position={[0, 30, -20]}
        fov={70}
        near={0.1}
        far={600}
      />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={35}
        maxDistance={120}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI / 2.02}
        target={[0, 0, 150]}
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

