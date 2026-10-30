import type { Face, Pick, Run } from "@/contract";
import type { PlanData } from "@/lib/api-client";
import type { Role } from "@/components/ui/models";

export interface PickRow {
  pick: Pick;
  face: Face | undefined;
}

export function pickRows({ plan, faces }: PlanData): PickRow[] {
  const byId = new Map(faces.map((f) => [f.id, f]));
  return [...plan.picks].sort((a, b) => a.rank - b.rank).map((pick) => ({ pick, face: byId.get(pick.faceId) }));
}

export interface RoleUse {
  role: Role;
  model: string | null;
  steps: number;
  ms: number;
  costUsd: number;
  titles: string[];
}

/** Which model did what: steps grouped by role, in the order each role first acted. */
export function roleUsage(run: Run): RoleUse[] {
  const out = new Map<Role, RoleUse>();
  for (const s of run.steps) {
    const u = out.get(s.role) ?? { role: s.role, model: s.model, steps: 0, ms: 0, costUsd: 0, titles: [] };
    u.steps += 1;
    u.ms += s.ms;
    u.costUsd += s.costUsd ?? 0;
    if (u.titles.length < 3 && !u.titles.includes(s.title)) u.titles.push(s.title);
    out.set(s.role, u);
  }
  return [...out.values()];
}

export function toolCalls(run: Run) {
  return run.steps.filter((s) => s.status !== "skipped").length;
}

export function kindMix(rows: PickRow[]): string {
  const n = (k: Face["kind"][]) => rows.filter((r) => r.face && k.includes(r.face.kind)).length;
  const parts = [
    [n(["bulletin"]), "bulletin"],
    [n(["digital_bulletin"]), "digital"],
    [n(["poster"]), "poster"],
    [n(["bus_shelter"]), "shelter"],
    [n(["kiosk"]), "kiosk"],
  ] as const;
  return parts
    .filter(([c]) => c > 0)
    .map(([c, l]) => `${c} ${l}${c > 1 ? "s" : ""}`)
    .join(", ");
}

/** Brand name without the "(sample brand)" suffix; the stamp says it instead. */
export const brandTitle = (name: string) => name.replace(/\s*\(sample brand\)\s*$/i, "");
