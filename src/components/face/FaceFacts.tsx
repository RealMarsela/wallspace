import type { Face, Pick, Plan } from "@/contract";
import { Pill } from "@/components/ui/Pill";
import { dayMonth } from "@/components/ui/format";
import { FacePhoto } from "./FacePhoto";

const reviewTone = { ok: "picked", flagged: "guard", redrafted: "warn" } as const;

/** Block taste, site-photo read, events in the flight, Ultra review, taste-shift and NeMo status. */
export function FaceFacts({ face, pick, plan }: { face: Face; pick: Pick; plan: Plan }) {
  const nemoChecked = pick.copy.filter((c) => c.nemo).length;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[0.88rem] sm:grid-cols-[180px_1fr]">
      <dt className="text-muted">This block over-indexes on</dt>
      <dd data-testid="face-top-tags" className="flex flex-wrap gap-1">
        {pick.topTags.map((t) => (
          <Pill key={t}>{t}</Pill>
        ))}
      </dd>

      <dt className="text-muted">Site photo read</dt>
      <dd className="flex flex-col gap-2">
        <FacePhoto face={face} />
        <span data-testid="face-photo-read" data-sightline={pick.photoRead?.sightline ?? "none"}>
        {pick.photoRead ? (
          <>
            {pick.photoRead.sightline} sightline, {pick.photoRead.clutter} clutter, face fills {Math.round(pick.photoRead.faceShareOfFrame * 100)}% of frame.{" "}
            <span className="text-ink-2">{pick.photoRead.note}</span>
          </>
        ) : (
          <span className="text-muted">{face.photoUrl ? "No photo read recorded for this face." : "No site photo for this face."}</span>
        )}
        </span>
      </dd>

      <dt className="text-muted">During the flight</dt>
      <dd data-testid="face-events">
        {pick.events.length === 0 ? (
          <span className="text-muted">No events found near this face.</span>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {pick.events.map((e, i) => (
              <li key={i} data-testid={`face-event-${i}`}>
                {dayMonth(e.date)} · {/^https?:\/\//.test(e.url) ? <a href={e.url} target="_blank" rel="noreferrer" className="text-info underline">{e.title}</a> : e.title}
                {e.distanceM !== null ? <span className="text-muted"> · {e.distanceM} m away</span> : null}
              </li>
            ))}
          </ul>
        )}
      </dd>

      <dt className="text-muted">Ultra review</dt>
      <dd data-testid="face-review" data-status={pick.review.status} className="flex flex-wrap items-center gap-2">
        <Pill tone={reviewTone[pick.review.status]}>{pick.review.status}</Pill>
        {pick.review.note ? <span className="text-ink-2">{pick.review.note}</span> : null}
      </dd>

      <dt className="text-muted">Nightly re-scan</dt>
      <dd data-testid="face-taste-shifted" data-shifted={pick.tasteShifted}>
        {pick.tasteShifted ? (
          <Pill tone="warn">taste shifted since the plan was made</Pill>
        ) : (
          <span className="text-ink-2">No change{plan.lastRescanAt ? ` at the last re-scan (${dayMonth(plan.lastRescanAt)})` : ""}.</span>
        )}
      </dd>

      <dt className="text-muted">NeMo Guardrails</dt>
      <dd data-testid="face-nemo-status" data-checked={nemoChecked} data-plan-status={plan.status}>
        {nemoChecked > 0
          ? `${nemoChecked} of ${pick.copy.length} lines checked${plan.nemoJobId ? ` by job ${plan.nemoJobId}` : ""}.`
          : plan.status === "awaiting-nemo"
            ? "Queued: lines are checked when the NeMo job next runs."
            : "Not checked yet. Lines are queued for NeMo when the plan is signed off."}
      </dd>
    </dl>
  );
}
