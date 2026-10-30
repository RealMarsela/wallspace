import type { Face, HeatCell, Pick } from "@/contract";
import type { PlanData } from "@/lib/api-client";

export interface Block {
  face: Face;
  pick: Pick | null;
  affinity: number;
  /** "pick" = the plan's scored affinity; "heat" = nearest audience heat cell (face not picked). */
  source: "pick" | "heat";
}

function nearestHeat(heat: HeatCell[], lat: number, lng: number): number {
  let best = 0;
  let bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const c of heat) {
    const d = (c.lat - lat) ** 2 + ((c.lng - lng) * k) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c.affinity;
    }
  }
  return best;
}

export function blockFor(data: PlanData, faceId: string): Block | null {
  const face = data.faces.find((f) => f.id === faceId);
  if (!face) return null;
  const pick = data.plan.picks.find((p) => p.faceId === faceId) ?? null;
  if (pick) return { face, pick, affinity: pick.affinity, source: "pick" };
  return { face, pick: null, affinity: nearestHeat(data.plan.heat, face.lat, face.lng), source: "heat" };
}

/** Defaults: a strong pick against the coldest face in the inventory. */
export function defaultPair(data: PlanData): [string, string] | null {
  const picks = [...data.plan.picks].sort((a, b) => a.rank - b.rank);
  if (picks.length === 0 || data.faces.length < 2) return null;
  const a = (picks[2] ?? picks[0]).faceId;
  let cold = data.faces[0].id;
  let coldAff = Infinity;
  for (const f of data.faces) {
    if (f.id === a) continue;
    const b = blockFor(data, f.id);
    if (b && b.affinity < coldAff) {
      coldAff = b.affinity;
      cold = f.id;
    }
  }
  return [a, cold];
}
