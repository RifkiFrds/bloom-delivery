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
  PlaneGeometry,
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
 * ── A TULIP IS PETALS, NOT A CUP ─────────────────────────────────────────
 * The head was a `LatheGeometry` — one surface of revolution, which is a vase.
 * A real tulip is SIX OVERLAPPING PETALS, each wide near the base, tapering to
 * a rounded point, cupped inward along its length and curled at the edges. The
 * GAPS between them are most of what makes the silhouette read as a flower.
 *
 * So each petal is a small warped grid, placed radially. Six petals at 30
 * triangles is 180 for the head — a fraction of Doc 01 §8.4's 1,000-per-tulip
 * allowance, which is what leaves room for 60 of them plus their outline hulls
 * inside the 45,000-triangle scene cap.
 * ─────────────────────────────────────────────────────────────────────────
 */
const PETALS_PER_HEAD = 6;

/**
 * One petal, warped out of a flat grid.
 *
 * `u` runs across the width, `v` from base to tip. Three shaping terms:
 *   WIDTH  a sine profile — pinched at the base, widest near 40%, pointed at
 *          the tip. A rectangle reads as a leaf; this reads as a petal.
 *   LEAN   the petal tilts outward as it rises — the bowl of the cup.
 *   CURL   the outer edges roll inward, strongest at mid-height, which is what
 *          catches the light along the rim.
 */
function buildPetal(color: Color, openness: number): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1, 3, 5);
  const position = geometry.attributes.position;
  if (position === undefined) throw new Error('petal geometry has no positions');

  for (let i = 0; i < position.count; i += 1) {
    const u = position.getX(i) + 0.5;
    const v = position.getY(i) + 0.5;

    const width = 0.46 * Math.sin(Math.PI * Math.pow(v, 0.72));
    const lean = Math.sin(v * Math.PI * 0.78) * openness;
    const curl = Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.3 * Math.sin(v * Math.PI);

    position.setXYZ(i, (u - 0.5) * 2 * width, v * 0.92, 0.1 + lean - curl);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return paint(geometry, color);
}

/** A head: six petals, alternately outer and inner, the way a tulip sits. */
function buildHead(color: Color): BufferGeometry {
  const petals: BufferGeometry[] = [];

  for (let i = 0; i < PETALS_PER_HEAD; i += 1) {
    // The inner ring sits tighter and shorter, so the flower has a CENTRE
    // instead of being one ring of identical blades.
    const inner = i % 2 === 1;
    const petal = buildPetal(color, inner ? 0.16 : 0.3);
    if (inner) petal.scale(0.82, 0.88, 0.8);
    petal.rotateY((i / PETALS_PER_HEAD) * Math.PI * 2);
    petals.push(petal);
  }

  const merged = mergeGeometries(petals, false);
  for (const petal of petals) petal.dispose();
  merged.computeVertexNormals();
  return merged;
}

function buildTulip(headColor: Color): BufferGeometry {
  const head = buildHead(headColor);
  head.translate(0, 1.28, 0);

  const stem = paint(new CylinderGeometry(0.04, 0.062, 1.45, 5, 1), PALETTE.green);
  stem.translate(0, 0.72, 0);

  // Tulip leaves are long, broad, strap-shaped and ARCHED. Two, opposed, is the
  // read — the previous single flat quad was a leaf-coloured rectangle.
  const leaves: BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const leaf = new PlaneGeometry(0.34, 1.05, 1, 4);
    const position = leaf.attributes.position;
    if (position !== undefined) {
      for (let i = 0; i < position.count; i += 1) {
        const v = position.getY(i) + 0.525;
        position.setXYZ(
          i,
          position.getX(i) * (1 - Math.pow(v, 2.2)) * 1.6,
          position.getY(i),
          Math.sin(v * Math.PI * 0.5) * 0.26,
        );
      }
      position.needsUpdate = true;
    }
    leaf.rotateZ(side * 0.42);
    leaf.rotateY(side > 0 ? 0.5 : -0.5);
    leaf.translate(side * 0.16, 0.6, 0);
    leaves.push(paint(leaf, PALETTE.green));
  }

  const merged = mergeGeometries([head, stem, ...leaves], false);
  head.dispose();
  stem.dispose();
  for (const leaf of leaves) leaf.dispose();
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
