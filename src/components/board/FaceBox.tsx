import type { Face } from "@/contract";

const defaults: Record<Face["kind"], { w: number; h: number }> = {
  bulletin: { w: 48, h: 14 },
  digital_bulletin: { w: 48, h: 14 },
  poster: { w: 22.8, h: 10.5 },
  bus_shelter: { w: 4, h: 6 },
  kiosk: { w: 3, h: 6 },
};

/** Width:height of a face. Street furniture is always portrait whatever order the inventory lists its sides. */
export function faceRatio(kind: Face["kind"], widthFt?: number, heightFt?: number) {
  const d = defaults[kind];
  const w = widthFt && widthFt > 0 ? widthFt : d.w;
  const h = heightFt && heightFt > 0 ? heightFt : d.h;
  const portrait = kind === "bus_shelter" || kind === "kiosk";
  return portrait ? { w: Math.min(w, h), h: Math.max(w, h) } : { w: Math.max(w, h), h: Math.min(w, h) };
}

/** A face as a plain box at its true proportion with the copy text inside. Restyle freely. */
export function FaceBox({ kind, text, widthFt, heightFt, testId = "face-box", className = "" }: { kind: Face["kind"]; text: string | null; widthFt?: number; heightFt?: number; testId?: string; className?: string }) {
  const { w, h } = faceRatio(kind, widthFt, heightFt);
  const portrait = h > w;
  return (
    <div
      data-testid={testId}
      data-kind={kind}
      role="img"
      aria-label={text ? `Face reads: ${text}` : "No line written"}
      className={`flex items-center justify-center border border-ink bg-panel p-3 text-center font-bold ${portrait ? "max-w-[160px]" : "w-full"} ${className}`}
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      {text ?? <span className="font-normal text-muted">no line written</span>}
    </div>
  );
}
