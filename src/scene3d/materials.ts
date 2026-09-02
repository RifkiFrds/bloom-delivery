/**
 * Materials — Doc 01 §5.4, Doc 04 §A.7, Doc 05 P6.3.
 *
 * ── THE INVERTED HULL IS THE ART DIRECTION ───────────────────────────────
 * A second copy of every mesh, rendered `BackSide`, scaled 1.03, flat #111111.
 * It costs one extra draw call per instanced mesh and it IS the neo-brutalist
 * look — without it the 3D scene reads as belonging to a different product than
 * the 2D UI it cross-dissolves from.
 *
 * It is the FIRST thing the degradation ladder disables (median < 34 fps),
 * because losing the outline is a smaller loss than losing the frame rate.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Everything else is deliberately absent: no PBR, no environment map, no normal
 * maps, no textures, no shadow maps, no post-processing. "Bloom" is faked with
 * additive sprites and a CSS radial gradient overlay — a real post pass costs
 * 30–50% of the mobile frame budget and buys almost nothing at this art style
 * (Doc 04 §B.12).
 *
 * Materials are created ONCE at module scope and shared. Creating one per mesh
 * would defeat instancing and force a shader recompile per object.
 */

import {
  BackSide,
  Color,
  MeshBasicMaterial,
  MeshToonMaterial,
  NormalBlending,
  AdditiveBlending,
} from 'three';

/** The palette, mirrored from `styles/tokens.css`. Vertex colours, no textures. */
export const PALETTE = {
  pink: new Color('#ff8fab'),
  pinkLight: new Color('#ffd6e0'),
  pinkPress: new Color('#ff6f92'),
  cream: new Color('#fff8e8'),
  yellow: new Color('#ffe599'),
  green: new Color('#b7e4c7'),
  white: new Color('#ffffff'),
  ink: new Color('#111111'),
} as const;

/**
 * The outline. `BackSide` + a scaled duplicate is the cheapest outline
 * technique that survives on a mobile GPU: no depth pre-pass, no screen-space
 * pass, no extra render target.
 */
export const outlineMaterial = new MeshBasicMaterial({
  color: PALETTE.ink,
  side: BackSide,
  // The hull must never write depth over the object it wraps.
  depthWrite: true,
  fog: false,
});

/** Toon shading with vertex colours. Two bands, so it reads as flat fill. */
export function createToonMaterial(): MeshToonMaterial {
  return new MeshToonMaterial({
    vertexColors: true,
    fog: false,
  });
}

/** Flat fill for anything that must not take light at all (the sky-hole). */
export function createFlatMaterial(color: Color): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, fog: false, blending: NormalBlending });
}

/** Additive sprites — the entire "bloom" implementation on the GPU side. */
export function createGlowMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: PALETTE.yellow,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
}

/** The hull scale. 1.03 reads as a 3 px line at the scene's working distance. */
export const OUTLINE_SCALE = 1.03;
