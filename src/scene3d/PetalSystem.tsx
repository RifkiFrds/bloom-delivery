'use client';

/**
 * The petal system — Doc 04 §B.12, Doc 01 §8.4, Doc 05 P6.6.
 *
 * ONE `InstancedMesh`. A pool of 300, **pre-allocated at mount**. The pool size
 * never changes; the degradation ladder reduces the ACTIVE COUNT, which costs
 * nothing, rather than reallocating the buffer mid-sequence, which would stall.
 *
 * ── ZERO ALLOCATIONS AFTER MOUNT ─────────────────────────────────────────
 * Particle state lives in flat `Float32Array`s — one array per component, not
 * 300 objects. Every per-frame value goes through module-level scratch
 * singletons. Nothing inside `useFrame` constructs anything.
 *
 * This is the single component most likely to violate the allocation budget,
 * which is why it holds no objects at all.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Petals launch from the box in a 70° cone at the burst, then taper to a gentle
 * ambient drift. Under reduced motion: 60 petals, slow LINEAR fall, NO rotation.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';

import { PETAL_GEOMETRY } from './geometry';
import { createToonMaterial } from './materials';

const POOL_SIZE = 300;

const scratchMatrix = new Matrix4();
const scratchPosition = new Vector3();
const scratchScale = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchEuler = new Euler();

/** Flat arrays, one per component. Allocated once, at mount. */
interface PetalPool {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  readonly spin: Float32Array;
  readonly phase: Float32Array;
  readonly scale: Float32Array;
}

function createPool(): PetalPool {
  const pool: PetalPool = {
    x: new Float32Array(POOL_SIZE),
    y: new Float32Array(POOL_SIZE),
    z: new Float32Array(POOL_SIZE),
    vx: new Float32Array(POOL_SIZE),
    vy: new Float32Array(POOL_SIZE),
    vz: new Float32Array(POOL_SIZE),
    spin: new Float32Array(POOL_SIZE),
    phase: new Float32Array(POOL_SIZE),
    scale: new Float32Array(POOL_SIZE),
  };
  for (let i = 0; i < POOL_SIZE; i += 1) seed(pool, i, true);
  return pool;
}

/**
 * Seeds one petal. `burst` launches it from the box in a 70° cone; otherwise it
 * enters from above as ambient drift.
 *
 * Deterministic from the index — no `Math.random()`, so the sequence looks the
 * same on every device and a bug is reproducible.
 */
function seed(pool: PetalPool, i: number, burst: boolean): void {
  const angle = i * 2.399963;
  const spread = ((i * 53) % 100) / 100;

  if (burst) {
    const cone = (spread - 0.5) * 1.22; // 70° total
    pool.x[i] = Math.cos(angle) * 0.2;
    pool.y[i] = 1.1;
    pool.z[i] = Math.sin(angle) * 0.2;
    pool.vx[i] = Math.cos(angle) * (1.4 + spread * 1.6);
    pool.vy[i] = 2.6 + Math.cos(cone) * 1.4;
    pool.vz[i] = Math.sin(angle) * (1.4 + spread * 1.6);
  } else {
    pool.x[i] = (spread - 0.5) * 12;
    pool.y[i] = 6 + spread * 4;
    pool.z[i] = (((i * 29) % 100) / 100 - 0.5) * 6;
    pool.vx[i] = 0;
    pool.vy[i] = -0.5 - spread * 0.4;
    pool.vz[i] = 0;
  }

  pool.spin[i] = 0.6 + spread * 2.4;
  pool.phase[i] = angle;
  pool.scale[i] = 0.7 + spread * 0.7;
}

const GRAVITY = -2.4;
const DRAG = 0.985;

export interface PetalSystemProps {
  /** Active particles. The ladder lowers this; the POOL never shrinks. */
  readonly count: number;
  readonly motionSafe: boolean;
  /** True once the box has burst. Before that, nothing is drawn. */
  readonly bursting: boolean;
  /** Frozen ambient drift — the third rung of the degradation ladder. */
  readonly frozen: boolean;
}

export function PetalSystem({
  count,
  motionSafe,
  bursting,
  frozen,
}: PetalSystemProps): React.ReactElement {
  const meshRef = useRef<InstancedMesh>(null);
  const pool = useMemo(() => createPool(), []);
  const material = useMemo(() => createToonMaterial(), []);
  const started = useRef(false);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    if (!bursting || started.current) return;
    started.current = true;
    for (let i = 0; i < POOL_SIZE; i += 1) seed(pool, i, motionSafe);
  }, [bursting, motionSafe, pool]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (mesh === null || !bursting) return;

    // A tab returning from the background can deliver a multi-second delta,
    // which would teleport every petal off screen.
    const dt = Math.min(delta, 0.05);
    const active = Math.min(count, POOL_SIZE);

    for (let i = 0; i < active; i += 1) {
      if (!frozen) {
        if (motionSafe) {
          pool.vy[i] = (pool.vy[i] ?? 0) + GRAVITY * dt;
          pool.vx[i] = (pool.vx[i] ?? 0) * DRAG;
          pool.vz[i] = (pool.vz[i] ?? 0) * DRAG;
          pool.x[i] = (pool.x[i] ?? 0) + (pool.vx[i] ?? 0) * dt;
          pool.z[i] = (pool.z[i] ?? 0) + (pool.vz[i] ?? 0) * dt;
        }
        // Reduced motion keeps only the fall: linear, slow, no rotation.
        pool.y[i] = (pool.y[i] ?? 0) + (pool.vy[i] ?? 0) * dt;
        pool.phase[i] =
          (pool.phase[i] ?? 0) + (motionSafe ? (pool.spin[i] ?? 0) * dt : 0);

        if ((pool.y[i] ?? 0) < -3) seed(pool, i, false);
      }

      scratchPosition.set(pool.x[i] ?? 0, pool.y[i] ?? 0, pool.z[i] ?? 0);
      scratchEuler.set(
        motionSafe ? (pool.phase[i] ?? 0) * 0.6 : 0,
        motionSafe ? (pool.phase[i] ?? 0) : 0,
        motionSafe ? (pool.phase[i] ?? 0) * 0.4 : 0,
      );
      scratchQuaternion.setFromEuler(scratchEuler);
      const s = pool.scale[i] ?? 1;
      scratchScale.set(s, s, s);
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
      mesh.setMatrixAt(i, scratchMatrix);
    }

    // Park the inactive tail at zero scale rather than rebuilding the buffer.
    for (let i = active; i < POOL_SIZE; i += 1) {
      scratchScale.set(0, 0, 0);
      scratchPosition.set(0, -100, 0);
      scratchQuaternion.identity();
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
      mesh.setMatrixAt(i, scratchMatrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[PETAL_GEOMETRY, material, POOL_SIZE]}
      frustumCulled={false}
    />
  );
}

export const PETAL_POOL_SIZE = POOL_SIZE;
