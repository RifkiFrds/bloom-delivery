/**
 * The Open Graph card — Doc 01 §9.3, Doc 05 Phase 9, PRD v2 §Security & Privacy.
 *
 * ── A TEASER ONLY. NEVER THE NAME, NEVER THE MESSAGE. ────────────────────
 * WhatsApp, Instagram and iMessage generate a preview card from these tags the
 * moment the link is pasted. If the card carried the recipient's name or any of
 * the letter, THE SURPRISE WOULD BE SPOILED IN THE CHAT THREAD BEFORE THE LINK
 * WAS EVER TAPPED — by the person sending it, to the person receiving it.
 *
 * So this image is generated from constants only. It cannot read `?to=`, it
 * cannot read the letter, and there is no code path here that could.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Generated at build time with `next/og` rather than shipped as a PNG: it needs
 * no binary asset in the repository, it uses the same palette tokens as the
 * app, and a colour change cannot leave a stale card behind.
 *
 * "Send the real production link to yourself in WhatsApp and look at the card"
 * is a Phase 9 checklist item, not an optional nicety (Doc 05 §12).
 */

import { ImageResponse } from 'next/og';

export const alt = 'A delivery is waiting';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Mirrored from `styles/tokens.css`. `next/og` cannot read CSS variables. */
const CREAM = '#FFF8E8';
const PINK = '#FF8FAB';
const YELLOW = '#FFE599';
const INK = '#111111';

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: CREAM,
        color: INK,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 200,
          height: 200,
          borderRadius: 40,
          border: `10px solid ${INK}`,
          backgroundColor: PINK,
          boxShadow: `18px 18px 0 ${INK}`,
          fontSize: 96,
        }}
      >
        🌷
      </div>

      <div
        style={{
          marginTop: 64,
          fontSize: 76,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        A delivery is waiting
      </div>

      <div
        style={{
          marginTop: 28,
          padding: '14px 32px',
          fontSize: 38,
          borderRadius: 24,
          border: `6px solid ${INK}`,
          backgroundColor: YELLOW,
          boxShadow: `10px 10px 0 ${INK}`,
        }}
      >
        But it only opens for two.
      </div>
    </div>,
    size,
  );
}
