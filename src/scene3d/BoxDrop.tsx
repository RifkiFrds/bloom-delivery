'use client';

/**
 * The box — Doc 04 §B.12, Doc 05 P6.4.
 *
 * Falls ~1.4 s accelerating, rotating −12° → 0°. Lands with a SQUASH to
 * `(1.18, 0.78, 1.18)` over 90 ms, over-rebounds to `(0.94, 1.09, 0.94)`, then
 * settles. Volume is approximately preserved, which is what makes the impact
 * read as physical rather than as a scale keyframe (Doc 04 §C.4).
 *
 * ── SECONDARY MOTION IS REQUIRED ─────────────────────────────────────────
 * Nothing moves alone. When the box lands, the dust ring expands and fades and
 * the lid's settle trails the body's. An impact with no reaction around it
 * reads as a sprite changing position.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Under reduced motion the box FADES IN ALREADY LANDED: no drop, no impact
 * punch, no squash. The content — a gift box arriving — is preserved; only the
 * motion is removed.
 *
 * Animated entirely from the parent's elapsed ref, with no allocations.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';

import { BOX_BODY_GEOMETRY, BOX_LID_GEOMETRY } from './geometry';
import { createToonMaterial, OUTLINE_SCALE, outlineMaterial } from './materials';

/** Beat boundaries in seconds, from Doc 04 §B.12's table. */
const FALL_S = 1.4;
const SQUASH_S = 0.09;
const REBOUND_S = 0.18;
const SETTLE_S = 0.42;
const BEAT_S = 0.6;
const BURST_AT_S = FALL_S + SETTLE_S + BEAT_S;

export interface BoxDropProps {
  readonly motionSafe: boolean;
  readonly elapsedRef: React.RefObject<number>;
  readonly bursting: boolean;
}

export function BoxDrop({
  motionSafe,
  elapsedRef,
  bursting,
}: BoxDropProps): React.ReactElement {
  const bodyRef = useRef<Group>(null);
  const lidRef = useRef<Group>(null);
  const dustRef = useRef<Mesh>(null);
  const material = useMemo(() => createToonMaterial(), []);

  useFrame(() => {
    const elapsed = elapsedRef.current;
    const body = bodyRef.current;
    const lid = lidRef.current;
    if (body === null || lid === null) return;

    if (!motionSafe) {
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      body.scale.set(1, 1, 1);
      lid.position.set(0, bursting ? 3.2 : 1.24, 0);
      lid.rotation.set(0, 0, bursting ? -0.5 : 0);
      return;
    }

    // ── Fall: accelerating, from above the sky-hole. ────────────────────────
    if (elapsed < FALL_S) {
      const t = elapsed / FALL_S;
      body.position.y = 9 * (1 - t * t);
      body.rotation.z = -0.21 * (1 - t);
      body.scale.set(1, 1, 1);
    } else {
      body.position.y = 0;
      body.rotation.z = 0;
      applyImpact(body.scale, elapsed - FALL_S);
    }

    // ── Dust ring: expands and fades over 180 ms from the landing. ──────────
    const dust = dustRef.current;
    if (dust !== null) {
      const since = elapsed - FALL_S;
      const alive = since >= 0 && since < 0.18;
      const t = alive ? since / 0.18 : 1;
      const s = 1 + t * 3.2;
      dust.scale.set(s, s, s);
      dust.visible = alive;
    }

    // ── Lid: rides the body, then blows off at the burst. ───────────────────
    const sinceBurst = elapsed - BURST_AT_S;
    if (!bursting || sinceBurst < 0) {
      lid.position.set(0, body.position.y + 1.24, 0);
      lid.rotation.z = body.rotation.z;
    } else {
      lid.position.y = 1.24 + sinceBurst * 6 - 4.9 * sinceBurst * sinceBurst;
      lid.position.x = sinceBurst * 1.6;
      lid.rotation.z = -sinceBurst * 3.4;
    }
  });

  return (
    <group>
      <group ref={bodyRef}>
        <mesh
          geometry={BOX_BODY_GEOMETRY}
          material={outlineMaterial}
          scale={OUTLINE_SCALE}
        />
        <mesh geometry={BOX_BODY_GEOMETRY} material={material} />
      </group>

      <group ref={lidRef}>
        <mesh
          geometry={BOX_LID_GEOMETRY}
          material={outlineMaterial}
          scale={OUTLINE_SCALE}
        />
        <mesh geometry={BOX_LID_GEOMETRY} material={material} />
      </group>

      {/* The dust ring. A flat disc, no outline — it is an effect, not an object. */}
      <mesh
        ref={dustRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        visible={false}
      >
        <ringGeometry args={[0.7, 0.95, 20]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Squash → over-rebound → settle, written directly into the target vector so
 * the hot path allocates nothing.
 */
function applyImpact(
  scale: { set: (x: number, y: number, z: number) => void },
  t: number,
): void {
  if (t < SQUASH_S) {
    const k = t / SQUASH_S;
    scale.set(1 + 0.18 * k, 1 - 0.22 * k, 1 + 0.18 * k);
    return;
  }
  if (t < SQUASH_S + REBOUND_S) {
    const k = (t - SQUASH_S) / REBOUND_S;
    scale.set(1.18 - 0.24 * k, 0.78 + 0.31 * k, 1.18 - 0.24 * k);
    return;
  }
  if (t < SETTLE_S) {
    const k = (t - SQUASH_S - REBOUND_S) / (SETTLE_S - SQUASH_S - REBOUND_S);
    const damp = Math.exp(-6 * k) * Math.cos(11 * k);
    scale.set(1 - 0.06 * damp, 1 + 0.09 * damp, 1 - 0.06 * damp);
    return;
  }
  scale.set(1, 1, 1);
}

export { BURST_AT_S };
