/**
 * Ambient brightness — Doc 03 §9.
 *
 * Every 500 ms, draw the video into a 32×32 offscreen canvas and compute mean
 * Rec. 709 luma:
 *
 *     Y = 0.2126 R + 0.7152 G + 0.0722 B          (0..255)
 *     TOO_DARK when Y < 45 for 2 consecutive samples
 *
 * 1,024 pixels is ~1 KB of getImageData — negligible, and the GPU performs the
 * box filter for free during drawImage.
 *
 * This is the cheapest high-value diagnostic in the project. An evening room is
 * the single most common real-world failure, and without this check it presents
 * as "the heart doesn't work" — unexplainable and unfixable from the user's
 * side. With it, it becomes a one-line instruction actionable in two seconds.
 */

import { LUMA } from './config';

export class LumaSampler {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private lastSampleAt = 0;
  private consecutiveDark = 0;
  private meanY = 255;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = LUMA.canvasSize;
    this.canvas.height = LUMA.canvasSize;
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /** Call every tick; the sampler throttles itself to 2 Hz internally. */
  update(video: HTMLVideoElement, nowMs: number): void {
    if (this.context === null) return;
    if (nowMs - this.lastSampleAt < LUMA.sampleIntervalMs) return;
    if (video.videoWidth === 0) return;

    this.lastSampleAt = nowMs;
    const size = LUMA.canvasSize;
    this.context.drawImage(video, 0, 0, size, size);

    let data: Uint8ClampedArray;
    try {
      data = this.context.getImageData(0, 0, size, size).data;
    } catch {
      return; // tainted canvas — cannot happen with a same-origin stream
    }

    let total = 0;
    const pixels = size * size;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      total += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    this.meanY = total / pixels;
    this.consecutiveDark =
      this.meanY < LUMA.tooDarkBelow ? this.consecutiveDark + 1 : 0;
  }

  get value(): number {
    return this.meanY;
  }

  get tooDark(): boolean {
    return this.consecutiveDark >= LUMA.consecutiveSamples;
  }
}
