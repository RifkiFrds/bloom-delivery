'use client';

/**
 * The button system — Doc 04 §A.5.
 *
 * ── THE TACTILE SIGNATURE ────────────────────────────────────────────────
 * On press the element translates +3px,+3px and swaps to `--shadow-press`. It
 * squashes into the page. This single interaction is the tactile signature of
 * the whole product, so it lives in one component and every button gets it.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Constraints encoded here rather than trusted to reviewers:
 *   · minimum 48 × 48 hit area (PRD v2 raises this above the usual 44)
 *   · `#111111` text on every variant — no white-on-pink, ever (Doc 04 §A.2)
 *   · zero-blur offset shadows only
 *   · hover under `@media (hover:hover)` only, via the `.interactive` class
 *   · the breathing idle loop on primary CTAs, disabled under reduced motion
 *
 * The press animation is a CSS `:active` transform, not a Framer Motion spring:
 * it must be instantaneous and it must work while the main thread is busy with
 * inference.
 */

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { audio } from '@/audio/manager';
import { duration, easing } from '@/motion/tokens';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'success'
  /** The escape hatch. A gift being handed over early — never a skip. */
  | 'gift';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Full-width within its container. Default for bottom-anchored CTAs. */
  readonly block?: boolean;
  /** 1.5 s idle breathing loop. Primary CTAs only; off under reduced motion. */
  readonly breathing?: boolean;
  readonly motionSafe?: boolean;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
  readonly ariaLabel?: string;
  readonly className?: string;
}

const VARIANT: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-pink border-3 border-ink shadow-[6px_6px_0_#111111]',
  secondary: 'bg-white border-3 border-ink shadow-[4px_4px_0_#111111]',
  tertiary: 'bg-transparent underline underline-offset-4',
  success: 'bg-green border-3 border-ink shadow-[4px_4px_0_#111111]',
  gift: 'bg-yellow border-3 border-ink shadow-[6px_6px_0_#111111]',
};

const SIZE: Readonly<Record<ButtonSize, string>> = {
  sm: 'min-h-[48px] px-5 text-[15px]',
  md: 'min-h-[56px] px-6 text-[17px]',
  lg: 'min-h-[64px] px-8 text-[17px]',
  xl: 'min-h-[72px] px-10 text-[19px]',
};

/** Tertiary has no shadow to swap, so it must not translate on press either. */
const PRESS =
  'active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_#111111]';

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  block = false,
  breathing = false,
  motionSafe = true,
  disabled = false,
  autoFocus = false,
  ariaLabel,
  className,
}: ButtonProps): React.ReactElement {
  const animate =
    breathing && motionSafe && !disabled ? { scale: [1, 1.03, 1] } : { scale: 1 };

  return (
    <motion.button
      type="button"
      onClick={() => {
        // Registered here rather than at each call site, so no button in the
        // application can be added without its press sound (Doc 04 §D.2).
        audio.play('pop');
        onClick();
      }}
      disabled={disabled}
      aria-disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      animate={animate}
      transition={
        breathing && motionSafe
          ? { duration: 1.5, repeat: Infinity, ease: easing.sine }
          : { duration: duration.fast }
      }
      className={[
        'interactive inline-flex items-center justify-center gap-2',
        'rounded-[20px] font-display text-ink',
        'transition-[transform,box-shadow] duration-[80ms]',
        variant === 'tertiary' ? '' : PRESS,
        VARIANT[variant],
        SIZE[size],
        block ? 'w-full' : '',
        disabled ? 'opacity-60 shadow-none' : '',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </motion.button>
  );
}
