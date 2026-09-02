/**
 * G3 — mirrored finger hearts. Two hands, each independently satisfying G2,
 * with the wrists far enough apart. Accepted from mercy level ≥ 1.
 * Doc 03 §6.4.
 *
 * The wrist-separation requirement is what distinguishes two people each
 * making a finger heart from one person holding both hands together.
 * Emotionally this is the "one each" version of G2, and it is free to
 * implement once G2 exists.
 */

import { G3 as T } from '../config';
import { evaluateG2 } from './g2';
import { dist } from './metrics';
import { L, type Condition, type Hand, type VariantResult } from '../types';

export interface G3Input {
  readonly handA: Hand;
  readonly handB: Hand;
  readonly mercyMultiplier: number;
  readonly active: boolean;
}

export function evaluateG3(input: G3Input): VariantResult {
  const { handA, handB, mercyMultiplier, active } = input;

  const a = evaluateG2({ hand: handA, mercyMultiplier, active });
  const b = evaluateG2({ hand: handB, mercyMultiplier, active });

  const a0 = handA[L.WRIST];
  const b0 = handB[L.WRIST];
  const separation = a0 !== undefined && b0 !== undefined ? dist(a0, b0) : 0;

  const conditions: readonly Condition[] = [
    {
      id: 'A',
      label: 'hand A is a finger heart',
      pass: a.pass,
      value: null,
      threshold: null,
      comparison: 'bool',
    },
    {
      id: 'B',
      label: 'hand B is a finger heart',
      pass: b.pass,
      value: null,
      threshold: null,
      comparison: 'bool',
    },
    {
      id: 'SEP',
      label: 'wrist separation',
      pass: separation >= T.minWristSeparation,
      value: separation,
      threshold: T.minWristSeparation,
      comparison: '>=',
    },
  ];

  const pass = conditions.every((condition) => condition.pass);
  const failedAt = conditions.find((condition) => !condition.pass)?.id ?? null;

  return { variant: 'G3', pass, conditions, failedAt };
}
