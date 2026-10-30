"use client";
import Link from "next/link";
import { FaceBox } from "@/components/board/FaceBox";
import { Button } from "@/components/ui/Button";
import { SampleStamp } from "@/components/ui/Pill";
import { ErrorState } from "@/components/ui/States";
import { aff, kindName, usd } from "@/components/ui/format";
import { useAsync } from "@/components/ui/useAsync";
import { api } from "@/lib/api-client";
import { CopyVariants } from "./CopyVariants";
import { EvidenceList } from "./EvidenceList";
import { FaceFacts } from "./FaceFacts";
import { FacePhoto } from "./FacePhoto";
import { planHref } from "@/lib/routes";

/** One face of a plan: the board with its chosen line, the three variants, the evidence and the checks. */
export function FaceSheet({ planId, faceId }: { planId: string; faceId: string }) {
  const state = useAsync(() => api.plan(planId), planId);
  const back = planHref(planId);
  if (state.status === "loading") return <div data-testid="face-loading" className="skeleton m-4 h-96" />;
  if (state.status === "error")
    return (
      <div className="p-6" data-testid="face-error">
        <ErrorState title="Face not loaded" message={state.error.message} action={<Button data-testid="face-retry" onClick={state.retry}>Try again</Button>} />
      </div>
    );
  const { plan, faces } = state.data;
  const face = faces.find((f) => f.id === faceId);
  const pick = plan.picks.find((p) => p.faceId === faceId);
  if (!face) return <div className="p-6" data-testid="face-missing"><ErrorState title="No such face" message={`Face ${faceId} is not in this plan's inventory.`} /></div>;
  const line = pick ? (pick.copy[pick.chosenCopy]?.text ?? null) : null;

  return (
    <div data-testid="face-sheet" data-face-id={face.id} className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4">
      <Link href={back} data-testid="face-back" className="text-[0.85rem] text-info underline">
        ← Back to the plan
      </Link>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{pick ? `Pick ${pick.rank} of ${plan.picks.length}` : "Not picked"}</span>
          {face.location === "sample" ? <SampleStamp>sample face</SampleStamp> : null}
        </div>
        <h1 className="text-2xl">{face.name}</h1>
        <p data-testid="face-meta" className="text-[0.82rem] text-ink-2">
          {face.id} · {face.neighbourhood} · {kindName(face.kind)} {face.heightFt}×{face.widthFt} ft · {face.readSide}-hand read · facing {face.facing}
          {face.lit ? " · lit" : ""} · {usd(face.rateMonthUsd)}/month <SampleStamp>sample rate</SampleStamp>
        </p>
      </header>
      <FaceBox kind={face.kind} widthFt={face.widthFt} heightFt={face.heightFt} text={line} testId="face-sheet-box" />
      {pick ? (
        <>
          <p data-testid="face-affinity" className="text-[0.88rem]">
            Audience affinity here <strong className="tnum">{aff(pick.affinity)}</strong> · score <span className="tnum">{pick.score > 1 ? pick.score.toFixed(1) : aff(pick.score)}</span> · cost for the flight <span className="tnum">{usd(pick.costUsd)}</span>
          </p>
          <FaceFacts face={face} pick={pick} plan={plan} />
          <CopyVariants pick={pick} />
          <EvidenceList evidence={pick.evidence} runId={plan.runId} />
        </>
      ) : (
        <p data-testid="face-not-picked" className="text-ink-2">
          This face was scored but not picked for this plan, so no lines were written for it.
        </p>
      )}
      {!pick ? <FacePhoto face={face} /> : null}
    </div>
  );
}
