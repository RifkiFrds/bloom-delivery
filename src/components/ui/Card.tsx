'use client';

/**
 * The card system — Doc 04 §A.6.
 *
 * Five card roles, one component. Every one is a flat fill, a 3 px `#111111`
 * border and a zero-blur offset shadow: one blurred shadow anywhere breaks the
 * entire visual language, so the shadow is never passed in from a call site.
 */

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { resolveSpring } from '@/motion/tokens';

export type CardTone = 'surface' | 'coach' | 'modal' | 'letter' | 'soft';

export interface CardProps {
  readonly children: ReactNode;
  readonly tone?: CardTone;
  readonly className?: string;
  /** Entrance animation. Off for cards that swap content in place. */
  readonly animate?: boolean;
  readonly motionSafe?: boolean;
  readonly ariaLabelledBy?: string;
  readonly role?: 'group' | 'article' | 'status' | 'alert';
}

const TONE: Readonly<Record<CardTone, string>> = {
  surface: 'bg-white rounded-[28px] p-6 shadow-[6px_6px_0_#111111]',
  coach: 'bg-cream rounded-[28px] px-5 py-4 shadow-[4px_4px_0_#111111]',
  modal: 'bg-white rounded-[40px] p-8 shadow-[8px_8px_0_#111111]',
  letter: 'bg-white rounded-[28px] p-7 shadow-[8px_8px_0_#111111]',
  /** Soft failure. `--peach`, never red (Doc 04 §A.1). */
  soft: 'bg-peach rounded-[28px] p-6 shadow-[8px_8px_0_#111111]',
};

export function Card({
  children,
  tone = 'surface',
  className,
  animate = true,
  motionSafe = true,
  ariaLabelledBy,
  role,
}: CardProps): React.ReactElement {
  const classes = ['border-3 border-ink', TONE[tone], className ?? ''].join(' ');

  if (!animate) {
    return (
      <div className={classes} role={role} aria-labelledby={ariaLabelledBy}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={motionSafe ? { scale: 0.9, opacity: 0 } : { opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={resolveSpring('bouncy', motionSafe)}
      className={classes}
      role={role}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </motion.div>
  );
}
