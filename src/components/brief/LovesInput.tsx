"use client";
import { useState } from "react";

/** "Fans of…" chips: type a taste and press Enter (or comma) to add it. */
export function LovesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().replace(/,$/, "");
    if (t && !value.includes(t) && value.length < 8) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="loves-input" className="text-[0.85rem] font-semibold">
        Fans of…
      </label>
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-rule bg-panel p-1.5" data-testid="loves-chips">
        {value.map((l) => (
          <span key={l} data-testid={`love-chip-${l}`} className="inline-flex items-center gap-1 rounded bg-heat-soft px-2 py-0.5 text-[0.82rem] text-heat-ink">
            {l}
            <button type="button" data-testid={`love-remove-${l}`} aria-label={`Remove ${l}`} onClick={() => onChange(value.filter((x) => x !== l))} className="px-0.5">
              ×
            </button>
          </span>
        ))}
        <input
          id="loves-input"
          data-testid="loves-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={value.length ? "add another" : "e.g. stand-up comedy specials"}
          className="min-w-[160px] flex-1 bg-transparent px-1 py-0.5 text-[0.9rem] outline-none"
        />
      </div>
      <span className="text-[0.75rem] text-muted">Artists, shows, genres, places. Up to 8. Tastes only, never who people are.</span>
    </div>
  );
}
