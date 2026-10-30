import Link from "next/link";
import { FaceBox } from "@/components/board/FaceBox";
import { Pill, SampleStamp } from "@/components/ui/Pill";
import { aff, kindName } from "@/components/ui/format";
import type { PickRow } from "./plan-derive";
import { faceHref } from "@/lib/routes";

/** The selected pick: its face with the chosen line, the block's tags, and a link to the face sheet. */
export function SelectedFace({ row, planId }: { row: PickRow; planId: string }) {
  const { pick, face } = row;
  const line = pick.copy[pick.chosenCopy]?.text ?? null;
  return (
    <section data-testid="selected-face" data-face-id={pick.faceId} className="flex flex-col gap-2 rounded border border-rule bg-panel p-3">
      <div className="flex items-center justify-between gap-2 text-[0.88rem]">
        <span className="font-semibold">
          #{pick.rank} {face?.name ?? pick.faceId}
        </span>
        <span className="tnum">{aff(pick.affinity)}</span>
      </div>
      {face ? <FaceBox kind={face.kind} widthFt={face.widthFt} heightFt={face.heightFt} text={line} testId="selected-face-box" /> : null}
      {face ? (
        <p className="flex flex-wrap items-center gap-x-2 text-[0.72rem] text-muted">
          <span>{face.id}</span>
          <span>
            {kindName(face.kind).toLowerCase()} {face.heightFt}×{face.widthFt} ft
          </span>
          <span>{face.readSide}-hand read</span>
          {face.lit ? <span>lit</span> : null}
          {face.location === "sample" ? <SampleStamp>sample face</SampleStamp> : null}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[0.72rem] text-muted">over-indexes on</span>
        {pick.topTags.slice(0, 4).map((t) => (
          <Pill key={t}>{t}</Pill>
        ))}
      </div>
      <Link href={faceHref(planId, pick.faceId)} data-testid="selected-face-open" className="text-[0.85rem] text-info underline">
        Open the face sheet
      </Link>
    </section>
  );
}
