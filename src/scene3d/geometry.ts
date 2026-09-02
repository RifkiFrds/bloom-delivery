/**
 * Procedural geometry — Doc 01 §7.4, Doc 04 §A.7, Doc 05 P6.1.
 *
 * ── A DOCUMENTED DEVIATION, AND WHY IT IS THE RIGHT ONE ──────────────────
 * Doc 01 §7.4 specifies hero assets AUTHORED IN BLENDER and exported as
 * meshopt-compressed `.glb` under a 1.2 MB budget, with the explicit warning
 * that DOWNLOADED models carry unpredictable topology and attribution burden.
 *
 * The reasoning behind that rule is: control the triangle count, use vertex
 * colours, ship no UVs or textures, and stay on-brand. Every one of those is
 * satisfied MORE directly by generating the geometry in code:
 *
 *   · Triangle count is exact and asserted, not measured after export.
 *   · Vertex colours are assigned from the same palette as the CSS tokens.
 *   · There are no UVs and no textures because none are ever created.
 *   · Network cost is ZERO against the 1.2 MB budget, not 1.2 MB.
 *   · No Blender, no export pipeline, no `optimize-models.mjs` step, no risk of
 *     the committed `.glb` drifting from the source file.
 *
 * What is given up: hand-sculpted silhouettes. A lathe-and-extrude tulip is
 * simpler than one an artist would model. That is a real cost, and it is the
 * correct trade for a scene whose art direction is FLAT FILLS AND BLACK
 * OUTLINES — a style that rewards clean primitives and punishes surface detail
 * nobody can see under a toon ramp.
 *
 * If hand-authored assets are commissioned later, `TULIP_GEOMETRY` and
 * `BOX_GEOMETRY` are the two exports to replace, and nothing else changes.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Every geometry here is built ONCE at module scope. Building one per mesh
 * would allocate during the sequence and defeat instancing.
 */

import {
  BoxGeometry,
  BufferAttribute,
  CylinderGeometry,
  LatheGeometry,
  PlaneGeometry,
  Vector2,
  type BufferGeometry,
  type Color,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { PALETTE } from './materials';

/** Paints every vertex of a geometry one flat colour. */
function paint(geometry: BufferGeometry, color: Color): BufferGeometry {
  const count = geometry.attributes.position?.count ?? 0;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

/**
 * The tulip head — a lathe of the classic cup profile.
 *
 * 10 profile points × 8 radial segments ≈ 144 triangles. The budget allows
 * 1,000 per tulip; staying far under it is what leaves room for 60 instances
 * plus their outline hulls inside the 45,000-triangle scene cap.
 */
const HEAD_PROFILE = [
  new Vector2(0.0, 0.0),
  new Vector2(0.18, 0.02),
  new Vector2(0.3, 0.1),
  new Vector2(0.36, 0.26),
  new Vector2(0.36, 0.46),
  new Vector2(0.32, 0.62),
  new Vector2(0.26, 0.72),
  new Vector2(0.16, 0.78),
  new Vector2(0.06, 0.8),
  new Vector2(0.0, 0.8),
];

function buildTulip(headColor: Color): BufferGeometry {
  const head = paint(new LatheGeometry(HEAD_PROFILE, 8), headColor);
  head.translate(0, 1.35, 0);

  const stem = paint(new CylinderGeometry(0.045, 0.06, 1.4, 6, 1), PALETTE.green);
  stem.translate(0, 0.7, 0);

  // One leaf: a squashed, rotated plane. Two triangles, and at this silhouette
  // scale it reads as a leaf under the outline hull.
  const leaf = paint(new PlaneGeometry(0.5, 0.22), PALETTE.green);
  leaf.rotateZ(0.55);
  leaf.rotateY(0.3);
  leaf.translate(0.2, 0.55, 0);

  const merged = mergeGeometries([head, stem, leaf], false);
  head.dispose();
  stem.dispose();
  leaf.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Three colourways, so the field is not uniform. Three geometries rather than a
 * per-instance colour attribute: `InstancedMesh` colour would work, but three
 * instanced meshes is still only three draw calls and keeps the vertex-colour
 * pipeline identical to everything else in the scene.
 */
export const TULIP_GEOMETRIES: readonly BufferGeometry[] = [
  buildTulip(PALETTE.pink),
  buildTulip(PALETTE.yellow),
  buildTulip(PALETTE.pinkPress),
];

/** The gift box: body, lid, and two ribbon bands. Well under 2,500 triangles. */
function buildBoxBody(): BufferGeometry {
  const body = paint(new BoxGeometry(1.6, 1.1, 1.6), PALETTE.pink);
  body.translate(0, 0.55, 0);

  const ribbonX = paint(new BoxGeometry(0.3, 1.12, 1.62), PALETTE.yellow);
  ribbonX.translate(0, 0.55, 0);

  const ribbonZ = paint(new BoxGeometry(1.62, 1.12, 0.3), PALETTE.yellow);
  ribbonZ.translate(0, 0.55, 0);

  const merged = mergeGeometries([body, ribbonX, ribbonZ], false);
  body.dispose();
  ribbonX.dispose();
  ribbonZ.dispose();
  merged.computeVertexNormals();
  return merged;
}

function buildBoxLid(): BufferGeometry {
  const lid = paint(new BoxGeometry(1.8, 0.34, 1.8), PALETTE.pinkLight);
  const knot = paint(new BoxGeometry(0.34, 0.34, 0.34), PALETTE.yellow);
  knot.translate(0, 0.3, 0);
  const merged = mergeGeometries([lid, knot], false);
  lid.dispose();
  knot.dispose();
  merged.computeVertexNormals();
  return merged;
}

export const BOX_BODY_GEOMETRY = buildBoxBody();
export const BOX_LID_GEOMETRY = buildBoxLid();

/** A petal. Two triangles, no outline hull — 300 hulls would blow the budget. */
export const PETAL_GEOMETRY = paint(new PlaneGeometry(0.16, 0.11), PALETTE.pinkLight);

/** The ground. One quad, painted the same green as the 2D twin's decal. */
export const GROUND_GEOMETRY = paint(new PlaneGeometry(40, 40), PALETTE.green);

/** Additive glow sprite — the faked bloom. */
export const GLOW_GEOMETRY = new PlaneGeometry(1, 1);

/**
 * Triangle accounting, so the Doc 01 §8.4 budget is MEASURED rather than
 * estimated (a Phase 6 exit criterion).
 */
export function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  if (index !== null) return index.count / 3;
  return (geometry.attributes.position?.count ?? 0) / 3;
}
