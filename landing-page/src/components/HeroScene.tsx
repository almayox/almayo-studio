"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const range = Math.max(window.innerHeight * 0.85, 1);
      setProgress(Math.min(Math.max(scrolled / range, 0), 1));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return progress;
}

function useIsCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return compact;
}

function useRoundSprite() {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.85)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
}

function AmbientStars({ sprite }: { sprite: THREE.Texture }) {
  const ref = useRef<THREE.Points>(null);
  const count = 1600;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.01;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        map={sprite}
        color="#93c5fd"
        sizeAttenuation
        transparent
        opacity={0.75}
        alphaTest={0.01}
        depthWrite={false}
      />
    </points>
  );
}

function Sparkles({ sprite }: { sprite: THREE.Texture }) {
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const count = 200;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.45 + Math.sin(clock.elapsedTime * 2) * 0.28;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.07}
        map={sprite}
        color="#ffffff"
        sizeAttenuation
        transparent
        opacity={0.6}
        alphaTest={0.01}
        depthWrite={false}
      />
    </points>
  );
}

function RingBand({
  inner,
  outer,
  color,
  opacity,
  thetaStart,
  thetaLength,
  renderOrder,
}: {
  inner: number;
  outer: number;
  color: string;
  opacity: number;
  thetaStart: number;
  thetaLength: number;
  renderOrder: number;
}) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={renderOrder}>
      <ringGeometry args={[inner, outer, 120, 1, thetaStart, thetaLength]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

function SaturnPlanet({
  progress,
  compact,
}: {
  progress: number;
  compact: boolean;
}) {
  const scaleRef = useRef<THREE.Group>(null);
  const leanRef = useRef<THREE.Group>(null);
  const planetRef = useRef<THREE.Mesh>(null);
  const highlightSpinRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    if (planetRef.current) planetRef.current.rotation.y -= delta * 0.18;
    if (highlightSpinRef.current) highlightSpinRef.current.rotation.y += delta * 0.32;

    if (leanRef.current) {
      const t = clock.elapsedTime;
      leanRef.current.rotation.x = THREE.MathUtils.degToRad(-20 + Math.sin(t * 0.4) * 5);
      leanRef.current.rotation.y = THREE.MathUtils.degToRad(16 + Math.cos(t * 0.32) * 4);
      leanRef.current.rotation.z = THREE.MathUtils.degToRad(24 + Math.sin(t * 0.25) * 3);
    }

    if (scaleRef.current) {
      const targetScale = 1 + progress * 0.32;
      const current = scaleRef.current.scale.x;
      scaleRef.current.scale.setScalar(current + (targetScale - current) * 0.06);
    }
  });

  const position: [number, number, number] = compact
    ? [0.55, 0.55, 0]
    : [1.5, 0.1, 0];
  const baseScale = compact ? 0.58 : 0.88;

  const bands = [
    { inner: 1.42, outer: 1.64, color: "#d7e6ff", opacity: 0.52 },
    { inner: 1.72, outer: 2.0, color: "#9bbcff", opacity: 0.38 },
    { inner: 2.08, outer: 2.36, color: "#c7dcff", opacity: 0.26 },
  ] as const;

  return (
    <group position={position} scale={baseScale}>
      <group ref={scaleRef}>
        <group ref={leanRef}>
          {bands.map((band) => (
            <RingBand
              key={`back-${band.inner}`}
              {...band}
              thetaStart={Math.PI}
              thetaLength={Math.PI}
              renderOrder={0}
            />
          ))}

          <group ref={highlightSpinRef} renderOrder={0}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.55, 0.012, 8, 128]} />
              <meshBasicMaterial
                color="#e8f1ff"
                transparent
                opacity={0.45}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.9, 0.01, 8, 128]} />
              <meshBasicMaterial
                color="#9bbcff"
                transparent
                opacity={0.35}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
          </group>

          <mesh ref={planetRef} renderOrder={1}>
            <sphereGeometry args={[1.0, 28, 28]} />
            <meshBasicMaterial
              color="#93c5fd"
              wireframe
              transparent
              opacity={0.58}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>

          {bands.map((band) => (
            <RingBand
              key={`front-${band.inner}`}
              {...band}
              thetaStart={0}
              thetaLength={Math.PI}
              renderOrder={2}
            />
          ))}
        </group>
      </group>
    </group>
  );
}

function HeroField() {
  const sprite = useRoundSprite();
  const progress = useScrollProgress();
  const compact = useIsCompact();

  return (
    <>
      <AmbientStars sprite={sprite} />
      <Sparkles sprite={sprite} />
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 3]} intensity={1.1} color="#93c5fd" />
      <SaturnPlanet progress={progress} compact={compact} />
    </>
  );
}

export function HeroScene() {
  return (
    <div className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_88%,transparent_100%)]">
      <Canvas
        camera={{ position: [0, 0.1, 5.2], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
      >
        <Suspense fallback={null}>
          <HeroField />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function AmbientStarsScene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
      <Suspense fallback={null}>
        <AmbientFieldStandalone />
      </Suspense>
    </Canvas>
  );
}

function AmbientFieldStandalone() {
  const sprite = useRoundSprite();
  return (
    <>
      <AmbientStars sprite={sprite} />
      <Sparkles sprite={sprite} />
    </>
  );
}
