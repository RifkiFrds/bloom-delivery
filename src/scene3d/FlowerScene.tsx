'use client';

/**
 * The 3D stage — Doc 01 §5.4, §5.5, Doc 04 §B.12, Doc 05 Phase 6.
 *
 * ── THE BUDGETS THIS SCENE IS BUILT AGAINST ──────────────────────────────
 *   ≤ 45,000 triangles including outline hulls   ≤ 40 draw calls
 *   ≤ 60 tulips in instanced meshes              ≤ 300 petals, one pool
 *   0 shadow maps  ·  0 post-processing passes   ·  ≤ 2 lights
 *   0 allocations inside `useFrame`
 *
 * Every one of those is a construction decision, not a thing to check later:
 * there is no shadow map because nothing casts one, no post pass because the
 * bloom is an additive sprite plus a CSS gradient, and no allocation because
 * every scratch object is a module-level singleton.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── `frameloop="demand"` FROM RESTING ────────────────────────────────────
 * The idle state is INDEFINITE. A phone left on the resting screen must not get
 * warm, so once the sequence settles the loop stops entirely and only
 * invalidates on interaction. Under 5% GPU is a hard budget, not a target.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A lost WebGL context is restored ONCE; on a second failure the machine cuts
 * to Lite and continues from the current beat. The letter is never lost.
 */

import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';

import { bus } from '@/events/bus';
import { record } from '@/lib/diagnostics';
import type { LiteBeat } from '@/lite/LiteStage';
import { BoxDrop, BURST_AT_S } from './BoxDrop';
import { Degrader, QUALITY, type QualityRung } from './Degrader';
import { GROUND_GEOMETRY } from './geometry';
import { createToonMaterial, PALETTE } from './materials';
import { PetalSystem } from './PetalSystem';
import { TulipField } from './TulipField';

export interface FlowerSceneProps {
  readonly beat: LiteBeat;
  readonly motionSafe: boolean;
  readonly dim: number;
}

export function FlowerScene({
  beat,
  motionSafe,
  dim,
}: FlowerSceneProps): React.ReactElement {
  const [rung, setRung] = useState<QualityRung>(0);
  const quality = QUALITY[rung];
  const restored = useRef(false);

  const onRung = useCallback((next: QualityRung) => {
    setRung(next);
  }, []);

  const onContextLost = useCallback((event: Event) => {
    event.preventDefault();
    if (restored.current) {
      record('webgl: context lost twice — cutting to Lite');
      bus.emit({ type: 'CONTEXT_LOST', restored: false });
      return;
    }
    restored.current = true;
    record('webgl: context lost — attempting one restore');
    bus.emit({ type: 'CONTEXT_LOST', restored: true });
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Canvas
        // `alpha: true` lets the cream page background show through, so the 3D
        // stage and the 2D chrome share one ground colour.
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        dpr={quality.dpr}
        flat
        camera={{ fov: 45, position: [0, 2.6, 8.4], near: 0.1, far: 60 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', onContextLost);
        }}
      >
        <SceneContents
          beat={beat}
          motionSafe={motionSafe}
          quality={quality}
          onRung={onRung}
        />
      </Canvas>

      {/* Faked bloom, half two: a CSS radial gradient. NEVER a post pass. */}
      {beat === 'bloom' && (
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background:
              'radial-gradient(circle at 50% 62%, var(--color-yellow) 0%, transparent 55%)',
            opacity: 0.26,
          }}
        />
      )}

      {dim > 0 && <div className="absolute inset-0 bg-ink" style={{ opacity: dim }} />}
    </div>
  );
}

interface SceneContentsProps {
  readonly beat: LiteBeat;
  readonly motionSafe: boolean;
  readonly quality: (typeof QUALITY)[QualityRung];
  readonly onRung: (rung: QualityRung) => void;
}

function SceneContents({
  beat,
  motionSafe,
  quality,
  onRung,
}: SceneContentsProps): React.ReactElement {
  // The sequence clock. A ref rather than state: it advances every frame, and
  // no component inside the Canvas may subscribe to a per-frame value
  // (Doc 01 §5.5).
  const elapsedRef = useRef(0);
  const material = useRef(createToonMaterial());

  useEffect(() => {
    const start = performance.now();
    let handle = 0;
    const tick = (): void => {
      handle = requestAnimationFrame(tick);
      elapsedRef.current = (performance.now() - start) / 1000;
    };
    handle = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, []);

  const bursting = beat === 'bloom';

  return (
    <>
      {/* Exactly two lights. No shadow maps, no environment map. */}
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} />

      <Degrader onRung={onRung} />

      {/* The ground. */}
      <mesh
        geometry={GROUND_GEOMETRY}
        material={material.current}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
      />

      {/* The sky-hole the box falls through. */}
      <mesh position={[0, 7.4, -2]}>
        <circleGeometry args={[2.6, 24]} />
        <meshBasicMaterial color={PALETTE.ink} />
      </mesh>

      <BoxDrop motionSafe={motionSafe} elapsedRef={elapsedRef} bursting={bursting} />

      <TulipField
        count={bursting ? quality.tulips : 0}
        outlines={quality.outlines}
        motionSafe={motionSafe}
        elapsedRef={elapsedRef}
      />

      <PetalSystem
        count={quality.petals}
        motionSafe={motionSafe}
        bursting={bursting}
        frozen={quality.frozen}
      />
    </>
  );
}

export { BURST_AT_S };
