import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';

/* ── Colour palette — ultra minimalist monochrome ── */
const NODE_COLORS = [
  '#18181B', // deep zinc
  '#27272A',
  '#3F3F46',
  '#52525B',
  '#71717A',
  '#A1A1AA',
  '#D4D4D8',
];

const NODE_LABELS = [
  'AI',       'Students',    'Teachers',
  'Parents',  'Analytics',   'Quizzes',
  'Reports',  'Assessments', 'Feedback',
  'Progress', 'Grades',      'Classes',
];

/* ── Build a random graph structure ── */
function buildGraph(count = 22) {
  const rng = (a, b) => a + Math.random() * (b - a);
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: i,
    position: new THREE.Vector3(
      rng(-3.5, 3.5),
      rng(-2.5, 2.5),
      rng(-2.0, 2.0),
    ),
    color: NODE_COLORS[i % NODE_COLORS.length],
    radius: i < 3 ? 0.18 : rng(0.08, 0.14), // first 3 are "hub" nodes
    label: NODE_LABELS[i] ?? `Node ${i}`,
  }));

  const edges = [];
  // Hub → hub connections
  edges.push([0, 1], [0, 2], [0, 3]);
  // Spokes — each hub connects to ~3-4 satellites
  for (let i = 3; i < count; i++) {
    const hub = Math.floor(Math.random() * 3);
    edges.push([hub, i]);
    // Occasional satellite-to-satellite
    if (i < count - 1 && Math.random() < 0.3) {
      edges.push([i, i + 1]);
    }
  }
  return { nodes, edges };
}

/* ── Single glowing sphere node ── */
function GraphNode({ node, hovered, onPointerOver, onPointerOut }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const baseColor = useMemo(() => new THREE.Color(node.color), [node.color]);
  const isHot = hovered;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = isHot ? 1.22 : 1.0 + Math.sin(t * 1.5 + node.id) * 0.04;
    meshRef.current.scale.setScalar(pulse);
    if (glowRef.current) {
      glowRef.current.material.opacity = isHot ? 0.55 : 0.15 + Math.sin(t * 1.2 + node.id) * 0.07;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.3}>
      <group position={node.position}>
        {/* Outer glow sphere */}
        <mesh ref={glowRef}>
          <sphereGeometry args={[node.radius * 2.4, 16, 16]} />
          <meshBasicMaterial color={node.color} transparent opacity={0.15} />
        </mesh>

        {/* Main sphere */}
        <mesh
          ref={meshRef}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        >
          <sphereGeometry args={[node.radius, 32, 32]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={baseColor}
            emissiveIntensity={isHot ? 1.2 : 0.4}
            roughness={0.2}
            metalness={0.3}
          />
        </mesh>
      </group>
    </Float>
  );
}

/* ── Edge line between two nodes ── */
function GraphEdge({ start, end, opacity = 0.18 }) {
  const ref = useRef();
  const points = useMemo(() => [start.position, end.position], [start, end]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return g;
  }, [points]);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      ref.current.material.opacity = opacity + Math.sin(t * 0.8) * 0.06;
    }
  });

  return (
    <line ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#A1A1AA" transparent opacity={opacity} linewidth={1} />
    </line>
  );
}

/* ── Ambient floating particles ── */
function Particles({ count = 60 }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 7;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return arr;
  }, [count]);

  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.025;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#A1A1AA" size={0.025} transparent opacity={0.45} sizeAttenuation />
    </points>
  );
}

/* ── The full scene ── */
function Scene({ graph }) {
  const { nodes, edges } = graph;
  const groupRef = useRef();
  const [hoveredId, setHoveredId] = React.useState(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.08;
      groupRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.04) * 0.1;
    }
  });

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-4, -4, -4]} intensity={0.5} color="#A1A1AA" />
      <pointLight position={[4, 4, 0]} intensity={0.4} color="#D4D4D8" />

      <Particles />

      <group ref={groupRef}>
        {/* Edges */}
        {edges.map(([aIdx, bIdx], i) => (
          <GraphEdge key={i} start={nodes[aIdx]} end={nodes[bIdx]} />
        ))}

        {/* Nodes */}
        {nodes.map((node) => (
          <GraphNode
            key={node.id}
            node={node}
            hovered={hoveredId === node.id}
            onPointerOver={() => setHoveredId(node.id)}
            onPointerOut={() => setHoveredId(null)}
          />
        ))}
      </group>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        maxPolarAngle={Math.PI * 0.75}
        minPolarAngle={Math.PI * 0.25}
        rotateSpeed={0.4}
      />
    </>
  );
}

/* ── Public export ── */
export default function KnowledgeGraph({ className = '' }) {
  const graph = useMemo(() => buildGraph(22), []);

  return (
    <div className={`kg-canvas-wrap ${className}`} style={{ width: '100%', height: '100%', cursor: 'grab' }}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Scene graph={graph} />
        </Suspense>
      </Canvas>
    </div>
  );
}
