import Link from "next/link";
import type { Face } from "@/contract";
import { FaceBox } from "@/components/board/FaceBox";
import { Pill, SampleStamp } from "@/components/ui/Pill";
import { aff, kindName } from "@/components/ui/format";
import type { Block } from "./compare-derive";
import { faceHref } from "@/lib/routes";

export function BlockCard({ side, block, faces, planId, onPick }: { side: "a" | "b"; block: Block; faces: Face[]; planId: string; onPick: (id: string) => void }) {
  const { face, pick } = block;
  const line = pick ? (pick.copy[pick.chosenCopy]?.text ?? null) : null;
  return (
    <section data-testid={`compare-block-${side}`} data-face-id={face.id} className="flex min-w-0 flex-col gap-2 rounded border border-rule bg-panel p-3">
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Block {side.toUpperCase()}</span>
        <select data-testid={`compare-select-${side}`} value={face.id} onChange={(e) => onPick(e.target.value)} className="h-9 rounded border border-rule bg-panel px-2 text-[0.85rem]">
          {faces.map((f) => (
            <option key={f.id} value={f.id}>
              {f.neighbourhood} · {f.name} ({f.id})
            </option>
          ))}
        </select>
      </label>
      <FaceBox kind={face.kind} widthFt={face.widthFt} heightFt={face.heightFt} text={line} testId={`compare-face-${side}`} />
      <p className="flex flex-wrap items-center gap-2 text-[0.8rem] text-ink-2">
        {face.neighbourhood} · {kindName(face.kind).toLowerCase()}
        {face.location === "sample" ? <SampleStamp>sample face</SampleStamp> : null}
      </p>
      <p data-testid={`compare-affinity-${side}`} className="text-[0.88rem]">
        Affinity <strong className="tnum">{aff(block.affinity)}</strong>{" "}
        <span className="text-[0.75rem] text-muted">{block.source === "pick" ? `pick ${pick?.rank}` : "nearest heat cell · not picked"}</span>
      </p>
      <div data-testid={`compare-tags-${side}`} className="flex flex-wrap gap-1">
        {pick ? (
          pick.topTags.map((t) => <Pill key={t}>{t}</Pill>)
        ) : (
          <span className="text-[0.8rem] text-muted">Block tastes are only fetched for picked faces.</span>
        )}
      </div>
      {pick ? (
        <Link href={faceHref(planId, face.id)} data-testid={`compare-open-${side}`} className="text-[0.8rem] text-info underline">
          Open face sheet
        </Link>
      ) : null}
    </section>
  );
}
