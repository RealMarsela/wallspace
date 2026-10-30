"use client";

import Link from "next/link";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { kindName } from "@/components/ui/format";
import { useAsync } from "@/components/ui/useAsync";
import { api } from "@/lib/api-client";
import { isMock } from "@/components/site/request";
import { fetchCard } from "./owner-api";
import { SyntheticBadge } from "./OwnerInventory";
import { PitchSheet } from "./PitchSheet";

/** Audience card for one face: the face as a board, what its block loves, brands to pitch, sources, pitch sheet. */
export function AudienceCardView({ faceId }: { faceId: string }) {
  const res = useAsync(async () => {
    const [c, inv] = await Promise.all([fetchCard(faceId), api.faces()]);
    return { ...c, owner: inv.owners.find((o) => o.id === c.face.ownerId) ?? null };
  }, faceId);

  if (res.status === "loading") return <div data-testid="card-loading" className="space-y-3"><Skeleton className="h-8 w-72" /><Skeleton className="h-32" /><Skeleton className="h-48" /></div>;
  if (res.status === "error")
    return (
      <ErrorState
        title="Audience card did not load"
        message={res.error.message}
        action={<span className="flex gap-3"><button data-testid="card-retry" className="underline" onClick={res.retry}>Try again</button><Link className="underline" href="/app/owner">Back to inventory</Link></span>}
      />
    );

  const { card, face, owner, source } = res.data;
  const sample = isMock();
  return (
    <article data-testid="audience-card" data-face-id={face.id}>
      <p><Link data-testid="card-back" href="/app/owner" className="text-sm underline">← Inventory</Link></p>
      <h1 className="mt-2 text-4xl">{face.id} · {face.name}</h1>
      <p className="mt-1 text-ink-2">
        {face.neighbourhood} · {kindName(face.kind)} · {face.heightFt}×{face.widthFt} ft · {face.readSide}-hand read · facing {face.facing} · {face.lit ? "lit" : "unlit"}
        {owner ? ` · ${owner.name}` : ""}
      </p>
      <p className="mt-1 text-sm">
        <span data-testid="card-location-badge" className="mr-2 rounded border border-rule px-1.5 py-0.5 font-mono text-xs uppercase">{face.location === "sample" ? "sample face" : "OSM location"}</span>
        {source?.synthetic && <SyntheticBadge />}
        {sample && <span data-testid="card-sample-badge" className="rounded border border-rule px-1.5 py-0.5 font-mono text-xs uppercase">sample scores, not Qloo results</span>}
      </p>

      <div data-testid="card-board" className="mt-5 flex w-full max-w-xl items-center justify-center border-4 border-ink bg-board p-3 text-center text-board-ink" style={{ aspectRatio: `${face.widthFt} / ${face.heightFt}` }}>
        <span className="font-mono text-xs">{face.id} · {face.heightFt}×{face.widthFt} ft · your brand here</span>
      </div>

      {face.photoUrl && (
        <figure data-testid="card-photo" className="mt-5 max-w-xl">
          {/* Remote R2 photo through /api/faces/:id/photo; plain img keeps it free of next/image remote config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={face.photoUrl} alt={`Example street view for ${face.name}`} className="w-full rounded-[var(--radius)] border border-rule" loading="lazy" />
          {face.photoCredit && <figcaption data-testid="card-photo-credit" className="mt-1 text-xs text-muted">{face.photoCredit}</figcaption>}
        </figure>
      )}

      <section aria-labelledby="tags-h" className="mt-8">
        <h2 id="tags-h" className="text-2xl">Fans who live around this face love…</h2>
        {card.topTags.length === 0 ? (
          <p data-testid="card-tags-empty" className="mt-2 text-muted">Qloo returned no strong taste signal for this block.</p>
        ) : (
          <ol data-testid="card-tags" className="mt-3 divide-y divide-rule border-y border-rule">
            {card.topTags.map((t) => (
              <li key={t.name} data-testid="card-tag" className="flex justify-between gap-3 py-2">
                <span>{t.name}{t.lift ? <span data-testid="card-tag-lift" className="ml-2 font-mono text-xs text-muted">{t.lift}x vs Atlanta</span> : null}</span>
                <span data-testid="card-tag-score" className="font-mono">{t.score.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="brands-h" className="mt-8">
        <h2 id="brands-h" className="text-2xl">Brands whose fans over-index here: pitch them</h2>
        {card.brands.length === 0 ? (
          <p data-testid="card-brands-empty" className="mt-2 text-muted">No brands over-index here yet.</p>
        ) : (
          <ol data-testid="card-brands" className="mt-3 divide-y divide-rule border-y border-rule">
            {card.brands.map((b, i) => (
              <li key={b.qlooId} data-testid="card-brand" className="grid grid-cols-[1.5rem_1fr_auto] gap-3 py-2">
                <span className="font-mono text-muted">{i + 1}</span>
                <span>
                  {b.name}
                  <span className="block break-all font-mono text-xs text-muted">{b.qlooId}</span>
                </span>
                <span data-testid="card-brand-score" className="font-mono">{b.score.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p data-testid="card-sources" className="mt-4 font-mono text-xs text-muted">
        Sources: Qloo insights, urn:tag and urn:entity:brand with signal.location=POINT({face.lng.toFixed(4)} {face.lat.toFixed(4)}) ·
        {" "}<span data-testid="card-source-label">{source?.label ?? (sample ? "sample data" : "cached")}</span> · generated {new Date(card.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" })} MYT
      </p>

      <PitchSheet face={face} card={card} ownerName={owner?.name ?? "the media owner"} />
    </article>
  );
}
