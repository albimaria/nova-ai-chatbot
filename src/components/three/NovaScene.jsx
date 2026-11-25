import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Float,
  Lightformer,
  MeshDistortMaterial,
  Sparkles,
} from "@react-three/drei";
import * as THREE from "three";

const PALETTES = {
  dark: {
    orb: "#7b61ff",
    emissive: "#2b1a7a",
    lights: ["#8b5cf6", "#22d3ee", "#f472b6"],
    shapes: ["#8b5cf6", "#22d3ee", "#f472b6", "#6366f1", "#2dd4bf"],
    sparkles: "#c4b5fd",
    ambient: 0.35,
  },
  light: {
    orb: "#8f7bff",
    emissive: "#d9d0ff",
    lights: ["#a78bfa", "#67e8f9", "#f9a8d4"],
    shapes: ["#a78bfa", "#67e8f9", "#f9a8d4", "#818cf8", "#5eead4"],
    sparkles: "#7c3aed",
    ambient: 0.9,
  },
};

const GEOMETRIES = ["torus", "icosahedron", "octahedron", "capsule", "torusKnot", "dodecahedron"];

const damp = THREE.MathUtils.damp;

function Geometry({ kind }) {
  switch (kind) {
    case "torus":
      return <torusGeometry args={[0.32, 0.12, 24, 64]} />;
    case "icosahedron":
      return <icosahedronGeometry args={[0.34, 0]} />;
    case "octahedron":
      return <octahedronGeometry args={[0.32, 0]} />;
    case "capsule":
      return <capsuleGeometry args={[0.14, 0.36, 8, 24]} />;
    case "torusKnot":
      return <torusKnotGeometry args={[0.22, 0.07, 96, 16]} />;
    default:
      return <dodecahedronGeometry args={[0.3, 0]} />;
  }
}

/** The Nova orb. Moves and changes size per screen, and ripples harder while Nova is thinking. */
function Orb({ mode, busy, offsetPx, palette }) {
  const group = useRef();
  const material = useRef();
  const { viewport, size } = useThree();

  useFrame((state, delta) => {
    if (!group.current || !material.current) return;

    const pxToWorld = viewport.width / size.width;
    const wide = size.width > 900;
    let target;

    if (mode === "auth") {
      target = wide
        ? { x: -viewport.width * 0.21, y: viewport.height * 0.15, z: 0, s: 0.95, o: 1 }
        : { x: 0, y: viewport.height * 0.3, z: -1, s: 0.6, o: 1 };
    } else if (mode === "welcome") {
      target = { x: offsetPx * pxToWorld, y: viewport.height * 0.2, z: 0, s: wide ? 0.62 : 0.5, o: 1 };
    } else {
      // Chat: park the orb in the bottom-right corner, away from the text, and dim it.
      target = {
        x: viewport.width / 2 - (wide ? 0.25 : 0.1),
        y: -viewport.height / 2 + (wide ? 0.6 : 1.3),
        z: -1,
        s: wide ? 0.7 : 0.45,
        o: busy ? 0.9 : 0.4,
      };
    }

    const g = group.current;
    g.position.x = damp(g.position.x, target.x, 3, delta);
    g.position.y = damp(g.position.y, target.y, 3, delta);
    g.position.z = damp(g.position.z, target.z, 3, delta);
    const s = damp(g.scale.x, target.s * (busy ? 1.06 : 1), 3, delta);
    g.scale.setScalar(s);

    g.rotation.y += delta * (busy ? 0.6 : 0.15);
    g.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;

    material.current.opacity = damp(material.current.opacity, target.o, 3, delta);
    material.current.distort = damp(material.current.distort, busy ? 0.5 : 0.32, 4, delta);
    material.current.emissiveIntensity = damp(
      material.current.emissiveIntensity,
      busy ? 0.9 : 0.35,
      4,
      delta
    );
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <MeshDistortMaterial
          ref={material}
          color={palette.orb}
          emissive={palette.emissive}
          emissiveIntensity={0.35}
          roughness={0.08}
          metalness={0.25}
          clearcoat={1}
          clearcoatRoughness={0.1}
          iridescence={1}
          iridescenceIOR={1.4}
          transparent
          distort={0.32}
          speed={busy ? 3.5 : 1.4}
        />
      </mesh>
    </group>
  );
}

function FloatingShapes({ palette, count }) {
  const { size, camera } = useThree();
  const aspect = size.width / size.height;

  const shapes = useMemo(() => {
    const random = mulberry32(7);
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Portrait phones have no empty side margins: tuck shapes half off-screen and shrink them.
    const narrow = aspect < 0.9;

    return Array.from({ length: count }, (_, index) => {
      const z = -3 - random() * 3;
      const halfHeight = (camera.position.z - z) * tanHalfFov;
      const halfWidth = halfHeight * aspect;

      return {
      kind: GEOMETRIES[index % GEOMETRIES.length],
      color: palette.shapes[index % palette.shapes.length],
      // Keep shapes in the outer edges of the screen so they never sit behind the text column.
      position: [
        (index % 2 ? 1 : -1) * halfWidth * (narrow ? 1.02 + random() * 0.1 : 0.84 + random() * 0.14),
        (random() - 0.5) * halfHeight * 1.8,
        z,
      ],
      rotation: [random() * Math.PI, random() * Math.PI, 0],
      scale: (0.55 + random() * 0.7) * (narrow ? 0.6 : 1),
      speed: 0.8 + random() * 1.4,
      };
    });
  }, [palette, count, aspect, camera]);

  return shapes.map((shape, index) => (
    <Float
      key={index}
      speed={shape.speed}
      rotationIntensity={1.2}
      floatIntensity={1.4}
      floatingRange={[-0.25, 0.25]}
    >
      <mesh position={shape.position} rotation={shape.rotation} scale={shape.scale}>
        <Geometry kind={shape.kind} />
        <meshPhysicalMaterial
          color={shape.color}
          roughness={0.18}
          metalness={0.55}
          clearcoat={1}
          clearcoatRoughness={0.15}
          transparent
          opacity={0.85}
        />
      </mesh>
    </Float>
  ));
}

/** Gentle parallax: the whole scene leans toward the pointer. */
function Parallax({ children, enabled }) {
  const group = useRef();

  useFrame((state, delta) => {
    if (!group.current) return;
    const x = enabled ? state.pointer.x : 0;
    const y = enabled ? state.pointer.y : 0;
    group.current.rotation.y = damp(group.current.rotation.y, x * 0.12, 2.5, delta);
    group.current.rotation.x = damp(group.current.rotation.x, -y * 0.08, 2.5, delta);
  });

  return <group ref={group}>{children}</group>;
}

// Small deterministic random generator so the layout is stable between renders.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function NovaScene({ mode = "chat", busy = false, theme = "dark", motion = true, offsetPx = 0 }) {
  const palette = PALETTES[theme] || PALETTES.dark;
  const small = typeof window !== "undefined" && window.innerWidth < 700;

  return (
    <div className="scene" aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          // On devices without a GPU, refuse slow software rendering; the CSS backdrop stays.
          failIfMajorPerformanceCaveat: true,
        }}
        frameloop={motion ? "always" : "demand"}
        eventSource={document.getElementById("root")}
        eventPrefix="client"
      >
        <ambientLight intensity={palette.ambient} />
        <directionalLight position={[4, 6, 5]} intensity={1.4} />
        <pointLight position={[-5, -2, 2]} intensity={30} color={palette.lights[1]} />
        <pointLight position={[5, 3, -2]} intensity={30} color={palette.lights[2]} />

        <Environment key={theme} resolution={256} frames={1}>
          <Lightformer form="rect" intensity={4} color={palette.lights[0]} position={[0, 5, -4]} scale={[8, 2, 1]} rotation-x={Math.PI / 2} />
          <Lightformer intensity={3} color={palette.lights[1]} position={[-6, 0, 2]} scale={[2, 8, 1]} rotation-y={Math.PI / 2} />
          <Lightformer intensity={3} color={palette.lights[2]} position={[6, 0, 2]} scale={[2, 8, 1]} rotation-y={-Math.PI / 2} />
        </Environment>

        <Parallax enabled={motion}>
          <Orb mode={mode} busy={busy} offsetPx={offsetPx} palette={palette} />
          <FloatingShapes palette={palette} count={small ? 6 : 11} />
          <Sparkles
            count={small ? 40 : 90}
            scale={[14, 9, 8]}
            size={2.2}
            speed={motion ? 0.35 : 0}
            opacity={0.7}
            color={palette.sparkles}
          />
        </Parallax>
      </Canvas>
    </div>
  );
}
