"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AudienceCard } from "@/contract";
import { PlanMap } from "@/components/map/PlanMap";
import { ErrorState, EmptyState, Skeleton } from "@/components/ui/States";
import { kindName } from "@/components/ui/format";
import { useAsync } from "@/components/ui/useAsync";
import { api } from "@/lib/api-client";
import { fetchCard, type CardSource } from "./owner-api";

type Headline = { status: "loading" } | { status: "ready"; card: AudienceCard; source?: CardSource } | { status: "error"; message: string };

/** Media-owner inventory: pick an owner, see its faces on the map and in a list, each with its audience headline. */
export function OwnerInventory() {
  const router = useRouter();
  const inv = useAsync(() => api.faces(), "faces");
  const [ownerId, setOwnerId] = useState<string>("");
  const [heads, setHeads] = useState<Record<string, Headline>>({});

  const owners = inv.data?.owners ?? [];
  const current = ownerId || owners[0]?.id || "";
  const faces = useMemo(() => (inv.data?.faces ?? []).filter((f) => f.ownerId === current), [inv.data, current]);
  const noPicks = useMemo(() => [], []);
  const noHeat = useMemo(() => [], []);

  // Audience headlines for this owner's faces, four requests at a time (the API caches every Qloo response).
  useEffect(() => {
    let live = true;
    const queue = faces.filter((f) => !heads[f.id] || heads[f.id].status === "error").map((f) => f.id);
    if (queue.length === 0) return;
    setHeads((h) => ({ ...h, ...Object.fromEntries(queue.map((id) => [id, { status: "loading" } as Headline])) }));
    const worker = async () => {
      for (let id = queue.shift(); id && live; id = queue.shift()) {
        const faceId = id;
        try {
          const { card, source } = await fetchCard(faceId);
          if (live) setHeads((h) => ({ ...h, [faceId]: { status: "ready", card, source } }));
        } catch (e) {
          if (live) setHeads((h) => ({ ...h, [faceId]: { status: "error", message: e instanceof Error ? e.message : "Could not load." } }));
        }
      }
    };
    void Promise.all([worker(), worker(), worker(), worker()]);
    return () => {
      live = false;
    };
    // Re-run only when the owner's face list changes; `heads` is read for what is already loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faces]);

  if (inv.status === "loading") return <div data-testid="owner-loading" className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-72" /></div>;
  if (inv.status === "error")
    return <ErrorState title="Inventory did not load" message={inv.error.message} action={<button data-testid="owner-retry" className="underline" onClick={inv.retry}>Try again</button>} />;

  const owner = owners.find((o) => o.id === current);
  return (
    <div data-testid="owner-inventory">
      <label className="block text-sm font-semibold" htmlFor="owner-filter">Media owner</label>
      <select
        id="owner-filter"
        data-testid="owner-filter"
        className="mt-1 w-full max-w-sm rounded-[var(--radius)] border border-rule bg-panel px-3 py-2"
        value={current}
        onChange={(e) => setOwnerId(e.target.value)}
      >
        {owners.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <p data-testid="owner-summary" className="mt-2 text-sm text-muted">
        {faces.length} faces{owner?.sample ? " · sample owner" : ""}. Click a face on the map or in the list for its audience card.
      </p>

      <div className="relative mt-4 h-[320px] overflow-hidden rounded-[var(--radius)] border border-rule sm:h-[420px]" data-testid="owner-map">
        <PlanMap heat={noHeat} faces={faces} picks={noPicks} legend={false} onSelectFace={(id) => router.push(`/faces/${encodeURIComponent(id)}`)} />
      </div>

      {faces.length === 0 ? (
        <div className="mt-6"><EmptyState title="No faces for this owner" message="This owner has no faces in the Atlanta inventory yet." /></div>
      ) : (
        <ul data-testid="owner-face-list" className="mt-6 divide-y divide-rule border-y border-rule">
          {faces.map((f) => (
            <li key={f.id} data-testid="owner-face-row" data-face-id={f.id} className="py-3">
              <Link data-testid="owner-face-link" href={`/faces/${encodeURIComponent(f.id)}`} className="font-semibold underline">
                {f.id} · {f.name}
              </Link>
              <p className="text-sm text-muted">
                {f.neighbourhood} · {kindName(f.kind)} · {f.lit ? "lit" : "unlit"} · {f.location === "sample" ? "sample face" : "OSM location"}
              </p>
              <HeadlineText h={heads[f.id]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HeadlineText({ h }: { h?: Headline }) {
  if (!h || h.status === "loading") return <p data-testid="owner-face-headline" data-state="loading" className="text-sm text-muted">Loading audience…</p>;
  if (h.status === "error") return <p data-testid="owner-face-headline" data-state="error" className="text-sm text-guard">Audience unavailable: {h.message}</p>;
  const tags = h.card.topTags.slice(0, 3).map((t) => t.name).join(", ");
  const brand = h.card.brands[0];
  return (
    <p data-testid="owner-face-headline" data-state="ready" className="text-sm">
      {h.source?.synthetic && <SyntheticBadge />}
      Fans here love {tags || "no strong taste signal yet"}.{brand ? ` Pitch first: ${brand.name}.` : ""}
    </p>
  );
}

export function SyntheticBadge() {
  return (
    <span data-testid="card-synthetic" className="mr-2 inline-block rounded border border-warn px-1.5 py-0.5 font-mono text-xs uppercase text-warn">
      synthetic sample
    </span>
  );
}
