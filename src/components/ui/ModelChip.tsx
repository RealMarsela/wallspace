import { roles, type Role } from "./models";

/** Chip naming the model behind a step. Hover or focus shows what the model is and what it does here. */
export function ModelChip({ role, model, tip = true }: { role: Role; model?: string | null; size?: "sm" | "md"; tip?: boolean }) {
  const r = roles[role];
  const chip = (
    <span data-testid={`model-chip-${role}`} data-model={model ?? ""} className="inline-flex items-center gap-1 whitespace-nowrap rounded-xs border border-line bg-surface px-1.5 py-px font-mono text-[0.68rem] text-ink-2">
      <i aria-hidden className="inline-block size-2 shrink-0 rounded-sm" style={{ background: r.swatch }} />
      {r.label}
    </span>
  );
  if (!tip) return chip;
  return (
    <span className="group/tip relative inline-flex">
      <span tabIndex={0} className="inline-flex rounded">
        {chip}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-[calc(100%+4px)] z-50 w-[min(280px,80vw)] rounded-md border border-line bg-surface p-2.5 text-left text-[0.8rem] leading-snug text-ink shadow-[var(--shadow)] group-hover/tip:visible group-focus-within/tip:visible"
      >
        <span className="block font-semibold">{r.name}</span>
        <span className="block text-[0.7rem] text-muted">{r.maker}</span>
        <span className="mt-1 block text-ink-2">{r.does}</span>
        {model ? <span className="mt-1 block break-all font-mono text-[0.68rem] text-muted">{model}</span> : null}
      </span>
    </span>
  );
}
