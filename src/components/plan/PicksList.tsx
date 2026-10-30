"use client";
import Link from "next/link";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { aff, kindName, usd } from "@/components/ui/format";
import type { PickRow } from "./plan-derive";
import { faceHref } from "@/lib/routes";

/** Ranked picks: rank, face id, street · neighbourhood, affinity, cost. */
export function PicksList({ rows, planId, selected, onSelect, droppedNote }: { rows: PickRow[]; planId: string; selected: string | null; onSelect: (id: string) => void; droppedNote?: string }) {
  return (
    <div className="flex flex-col">
      <h2 className="pb-1 text-base">The picks</h2>
      <ol data-testid="picks-list" className="flex flex-col border-t border-rule">
        {rows.map(({ pick, face }) => {
          const on = selected === pick.faceId;
          return (
            <li key={pick.faceId} id={`pick-${pick.faceId}`} data-testid={`pick-row-${pick.faceId}`} data-rank={pick.rank} className={`border-b border-rule-2 ${on ? "bg-picked-soft" : ""}`}>
              <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2 px-1 py-2">
                <span className="text-center font-bold tnum">{pick.rank}</span>
                <button type="button" data-testid={`pick-select-${pick.faceId}`} onClick={() => onSelect(pick.faceId)} aria-pressed={on} className="min-w-0 text-left">
                  <span className="block truncate text-[0.9rem] font-semibold">{face?.name ?? pick.faceId}</span>
                  <span className="block truncate text-[0.72rem] text-muted">
                    {pick.faceId} · {face?.neighbourhood ?? "unknown"} · {face ? kindName(face.kind).toLowerCase() : ""}
                    {pick.tasteShifted ? <span data-testid={`pick-taste-shifted-${pick.faceId}`} className="text-warn"> · taste shifted</span> : null}
                  </span>
                  <ScoreBar value={pick.affinity} tone={on ? "picked" : "heat"} className="mt-1 max-w-[200px]" label={`affinity ${aff(pick.affinity)}`} />
                </button>
                <span className="flex flex-col items-end text-[0.78rem] tnum">
                  <span data-testid={`pick-affinity-${pick.faceId}`}>{aff(pick.affinity)}</span>
                  <span data-testid={`pick-cost-${pick.faceId}`} className="text-muted">
                    {usd(pick.costUsd)}
                  </span>
                  <Link
                    href={faceHref(planId, pick.faceId)}
                    data-testid={`pick-open-${pick.faceId}`}
                    className="text-info underline"
                  >
                    open
                  </Link>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {droppedNote ? <p className="pt-1 text-[0.72rem] text-muted">{droppedNote}</p> : null}
    </div>
  );
}
