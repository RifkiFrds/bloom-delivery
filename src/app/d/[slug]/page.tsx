/**
 * The experience route — PRD v2 §Security & Privacy, URL strategy.
 *
 * Deployed at an UNGUESSABLE PATH: `/d/7fq2m9x`. The root (`/`) returns a
 * neutral placeholder and must never reveal or link to this route. URL secrecy
 * is the actual access control; the letter's base64+XOR is only a spoiler guard
 * against casual View Source.
 *
 * Everything below `ExperienceLoader` is `ssr: false` because it depends on the
 * camera, the canvas and `window` (Doc 01 §5.2 rule B5).
 */

import { ExperienceLoader } from './ExperienceLoader';

/** The slug is decorative — it exists to make the URL unguessable. */
export default function DeliveryPage(): React.ReactElement {
  return <ExperienceLoader />;
}
