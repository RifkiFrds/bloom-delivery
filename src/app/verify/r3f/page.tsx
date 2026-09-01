/**
 * ⚠ DAY-0 TASK E2 VERIFICATION ARTIFACT — DELETE AT THE START OF PHASE 6.
 *
 * Doc 05 §3, task E2:
 *   "Verify R3F v9 + React 19 + Next 15 resolve together.
 *    DoD: a trivial <Canvas> with one mesh renders. Do this on day one — a
 *    version conflict here reshapes the whole 3D plan."
 *
 * This is NOT Phase 6 work. It is a dependency-resolution smoke test and
 * nothing else: one box, no materials from the design system, no scene
 * structure, no instancing, no outline pass. R3F 9.7.0 peer-pins
 * `react >=19 <19.3`, which is the specific ceiling this route proves.
 *
 * Removal trigger: the first commit of `src/scene3d/`.
 * Not reachable from any UI; dev-only via /verify/r3f.
 */

import R3FProbe from './R3FProbe';

export default function R3FVerificationPage(): React.ReactElement {
  if (process.env.NODE_ENV === 'production') {
    return <main className="p-8">Not available.</main>;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <p className="max-w-[420px] text-center text-[13px]">
        Day-0 task E2: React Three Fiber v9 rendering under React 19 / Next 15. Delete
        this route when <code>src/scene3d/</code> lands.
      </p>
      <div className="h-[320px] w-full max-w-[420px] rounded-[28px] border-3 border-ink shadow-[6px_6px_0_#111111]">
        <R3FProbe />
      </div>
    </main>
  );
}
