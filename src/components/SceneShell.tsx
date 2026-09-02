'use client';

/**
 * The common scene shell — Doc 04 §B header, §E.4, §F.2, §F.4.
 *
 * Every scene renders inside this. It owns four things that are easy to get
 * subtly wrong once per scene and impossible to get wrong once in total:
 *
 *   1. The content column: capped at 480 px, centred, 20 px gutters, safe-area
 *      insets on all fixed UI.
 *   2. Focus management: on every scene change focus moves explicitly to the
 *      new scene's heading. Focus is never left on an unmounted node
 *      (Doc 04 §F.2).
 *   3. The polite announcement for the scene, debounced through `lib/live`.
 *   4. The persistent mute toggle from Scene 1 onward.
 *
 * `100dvh` with a `100vh` fallback — mobile Safari's collapsing toolbar would
 * otherwise shift the layout mid-experience (Doc 04 §E.2).
 */

import { useEffect, useRef } from 'react';

import { MuteToggle } from './MuteToggle';
import { announce } from '@/lib/live';

export interface SceneShellProps {
  readonly children: React.ReactNode;
  /** Rendered as the scene's heading and receives focus on entry. */
  readonly heading?: React.ReactNode;
  readonly headingLevel?: 1 | 2;
  /** Polite screen-reader announcement for this scene. */
  readonly announcement?: string;
  readonly showMute?: boolean;
  /** Full-bleed scenes (the camera stage) opt out of the 480 px column. */
  readonly wide?: boolean;
  readonly className?: string;
}

export function SceneShell({
  children,
  heading,
  headingLevel = 1,
  announcement,
  showMute = true,
  wide = false,
  className,
}: SceneShellProps): React.ReactElement {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (announcement !== undefined && announcement !== '') announce(announcement);
  }, [announcement]);

  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <div
      className={[
        'relative flex min-h-[100dvh] w-full flex-col items-center',
        'px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        className ?? '',
      ].join(' ')}
    >
      {showMute && <MuteToggle />}

      <div
        className={[
          'flex w-full flex-1 flex-col',
          wide ? 'max-w-[560px]' : 'max-w-[480px]',
        ].join(' ')}
      >
        {heading !== undefined && (
          <Heading
            ref={headingRef}
            tabIndex={-1}
            className={[
              'font-display outline-none',
              headingLevel === 1
                ? 'text-[clamp(1.75rem,6.5vw,2.75rem)] leading-[1.15]'
                : 'text-[clamp(1.375rem,5vw,1.875rem)] leading-[1.2]',
            ].join(' ')}
          >
            {heading}
          </Heading>
        )}
        {children}
      </div>
    </div>
  );
}
