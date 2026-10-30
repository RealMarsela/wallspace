export function MapLegend() {
  return (
    <div data-testid="map-legend" className="pointer-events-none absolute bottom-2 left-2 z-10 flex flex-wrap items-center gap-3 rounded bg-panel/90 px-2 py-1 text-[0.7rem] text-ink-2">
      <span className="flex items-center gap-1">
        audience affinity
        <i aria-hidden className="block h-2 w-12" style={{ background: "linear-gradient(90deg, var(--h1), var(--h2), var(--h3), var(--h4))" }} />
      </span>
      <span className="flex items-center gap-1">
        <i aria-hidden className="block size-3 rounded-full bg-picked" /> picked
      </span>
      <span className="flex items-center gap-1">
        <i aria-hidden className="block size-1.5 rounded-full bg-ink" /> other faces
      </span>
    </div>
  );
}
