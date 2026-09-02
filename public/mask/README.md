# Mask artwork — drop-in slot

Empty by design. The tracking overlay draws an **original procedural mask**
(`src/components/tracking/mask.ts`) unless artwork is found here, and a missing
file is a content gap, not an error — nothing is logged and nothing breaks.

## To use your own artwork

Drop two files:

```
public/mask/red.png     → the screen-left person
public/mask/white.png   → the screen-right person
```

They are picked up automatically. No code change.

## The contract they must meet

The overlay places artwork by the **eye line**, not by the bounding box, so it
tracks a tilted head correctly. That only works if the files are authored to
these proportions:

| Property             | Value                    |
| -------------------- | ------------------------ |
| Canvas               | **square**               |
| Face                 | centred horizontally     |
| Eye line             | at **42%** of the height |
| Interocular distance | **26%** of the width     |
| Eyes and background  | **transparent**          |

Getting the interocular distance wrong scales the whole mask; getting the eye
line wrong slides it up or down the face. Both are visible immediately.

## What the artwork must not be

An existing character's mask. The reference images that prompted this slot were
the Marvel Spider-Man design — the radial web and the swept teardrop eye are
what make that design recognisable, and they are protected.

Original work only, or something licensed for this use. If you commission it,
the brief that matches the rest of the product is:

> Cute kawaii × neo-brutalism. Flat fills, one uniform black outline, zero
> gradients. Comic-hero energy from the SILHOUETTE and the eye shape, not from
> resembling any particular hero. Palette from `src/styles/tokens.css` — pink
> `#FF8FAB` and white `#FFFFFF`, ink `#111111`.
