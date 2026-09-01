/**
 * The root path — deliberately neutral.
 *
 * PRD v2 §Security & Privacy: "The root path returns a neutral 404 or
 * placeholder — it must not reveal or link to the experience."
 *
 * No link to /d/*. No mention of the project. Nothing to crawl.
 */

export default function RootPlaceholder(): React.ReactElement {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <p className="font-display text-xl">🌷</p>
    </main>
  );
}
