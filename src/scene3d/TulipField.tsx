'use client';

/**
 * The tulip field — Doc 04 §B.12, Doc 01 §8.4, Doc 05 P6.5.
 *
 * ≤ 60 instances across THREE `InstancedMesh`es (one per colourway), plus one
 * outline hull mesh each. Six draw calls for the entire field.
 *
 * ── ZERO ALLOCATIONS IN `useFrame` ───────────────────────────────────────
 * Every matrix, vector and quaternion used per frame is a MODULE-LEVEL
 * SINGLETON. A `new Vector3()` inside `useFrame` is 60 allocations per second
 * per instance, which on a mid-range Android is a garbage-collection pause
 * exactly during the payoff (Doc 01 §5.4).
 *
 * The instance transforms are computed ONCE at mount into a plain array and
 * only the growth scalar animates, so the per-frame work is a matrix compose
 * per instance and one buffer upload.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Growth is a radial wave from the box: stem `scaleY` 0 → 1 with a 45 ms
 * stagger by distance, heads unfurling 180 ms after their own stem.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';

import { TULIP_GEOMETRIES } from './geometry';
import { createToonMaterial, OUTLINE_SCALE, outlineMaterial } from './materials';

// ── Per-frame scratch. Module scope, never reallocated. ─────────────────────
const scratchMatrix = new Matrix4();
const scratchPosition = new Vector3();
const scratchScale = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchEuler = new Euler();

export interface TulipInstance {
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly rotation: number;
  /** Seconds after the wave starts at which this tulip begins growing. */
  readonly delay: number;
  readonly variant: number;
}

/** Deterministic layout — the same field every time, on every device. */
function buildLayout(count: number): readonly TulipInstance[] {
  const instances: TulipInstance[] = [];
  for (let i = 0; i < count; i += 1) {
    // A golden-angle spiral gives an even, non-gridded scatter with no RNG.
    const angle = i * 2.399963;
    const radius = 1.1 + Math.sqrt(i / count) * 5.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.55;
    instances.push({
      x,
      z,
      scale: 0.7 + ((i * 37) % 11) / 22,
      rotation: (i % 7) * 0.22,
      // 45 ms per unit of distance from the box — the radial wave.
      delay: (radius - 1.1) * 0.045 * 4,
      variant: i % TULIP_GEOMETRIES.length,
    });
  }
  return instances;
}

export interface TulipFieldProps {
  readonly count: number;
  readonly outlines: boolean;
  readonly motionSafe: boolean;
  /** Seconds since the bloom beat began. Driven by the parent's clock. */
  readonly elapsedRef: React.RefObject<number>;
}

export function TulipField({
  count,
  outlines,
  motionSafe,
  elapsedRef,
}: TulipFieldProps): React.ReactElement {
  const layout = useMemo(() => buildLayout(count), [count]);
  const material = useMemo(() => createToonMaterial(), []);

  const groups = useMemo(
    () =>
      TULIP_GEOMETRIES.map((_, variant) =>
        layout.filter((instance) => instance.variant === variant),
      ),
    [layout],
  );

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <group position={[0, 0, 0]}>
      {TULIP_GEOMETRIES.map((geometry, variant) => {
        const instances = groups[variant] ?? [];
        if (instances.length === 0) return null;
        return (
          <VariantGroup
            key={variant}
            geometry={geometry}
            instances={instances}
            material={material}
            outlines={outlines}
            motionSafe={motionSafe}
            elapsedRef={elapsedRef}
          />
        );
      })}
    </group>
  );
}

interface VariantGroupProps {
  readonly geometry: (typeof TULIP_GEOMETRIES)[number];
  readonly instances: readonly TulipInstance[];
  readonly material: ReturnType<typeof createToonMaterial>;
  readonly outlines: boolean;
  readonly motionSafe: boolean;
  readonly elapsedRef: React.RefObject<number>;
}

function VariantGroup({
  geometry,
  instances,
  material,
  outlines,
  motionSafe,
  elapsedRef,
}: VariantGroupProps): React.ReactElement {
  const fillRef = useRef<InstancedMesh>(null);
  const hullRef = useRef<InstancedMesh>(null);

  useFrame(() => {
    const fill = fillRef.current;
    if (fill === null) return;
    const elapsed = elapsedRef.current;

    for (let i = 0; i < instances.length; i += 1) {
      const instance = instances[i];
      if (instance === undefined) continue;

      // Reduced motion: staggered fade-in at 80 ms with NO overshoot, so the
      // growth is still legible but nothing springs (Doc 04 §C.5).
      const local = elapsed - (motionSafe ? instance.delay : i * 0.08);
      const growth = motionSafe
        ? springStep(local)
        : Math.min(1, Math.max(0, local / 0.4));

      scratchPosition.set(instance.x, 0, instance.z);
      scratchEuler.set(0, instance.rotation, 0);
      scratchQuaternion.setFromEuler(scratchEuler);
      scratchScale.set(instance.scale, instance.scale * growth, instance.scale);
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);

      fill.setMatrixAt(i, scratchMatrix);

      if (hullRef.current !== null) {
        scratchScale.multiplyScalar(OUTLINE_SCALE);
        scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
        hullRef.current.setMatrixAt(i, scratchMatrix);
      }
    }

    fill.instanceMatrix.needsUpdate = true;
    if (hullRef.current !== null) hullRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {outlines && (
        <instancedMesh
          ref={hullRef}
          args={[geometry, outlineMaterial, instances.length]}
          frustumCulled={false}
        />
      )}
      <instancedMesh
        ref={fillRef}
        args={[geometry, material, instances.length]}
        frustumCulled={false}
      />
    </>
  );
}

/**
 * A closed-form spring approximation.
 *
 * Analytic rather than integrated so it needs no per-instance velocity state,
 * which would be 60 more numbers to allocate and step every frame. Matches
 * `spring.pop`'s character: fast rise, one visible overshoot, quick settle.
 */
function springStep(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1.2) return 1;
  const decay = Math.exp(-7 * t);
  return 1 - decay * Math.cos(12 * t);
}
