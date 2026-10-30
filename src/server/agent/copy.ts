import { z } from "zod";
import type { Brief, CopyLine, Face, RunStep } from "@/contract";
import { guardText } from "../guard";
import { policy } from "../guard/policy";
import { chatJson, type TokenFactory } from "../models";

// Lightning writes three lines per face. Static rules come first so the prefix caches across faces; per-face data comes last.
const RULES = `You write outdoor advertising lines for a billboard read from a moving car.
Hard rules: at most 7 words per line (count them; 4 to 6 words is ideal, e.g. "West End knows the punchline." is 5, "Little Five laughs louder. Nov 21." is 6); plain words, no hashtags, no emoji; each line sounds local to the block (use its tastes or its name, never a stereotype);
describe taste, never people by race, religion, sexuality, gender identity, disability, health, age, nationality or immigration status; no health claims; no financial claims.
Policy: ${policy.policyText}
Reply as JSON {"lines":[{"text":string,"rationale":string}]} with exactly three lines of different angles. rationale is one short sentence naming the tag or fact the line leans on.`;

export const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

const Lines = z.object({
  lines: z.array(z.object({ text: z.string().min(1).max(80).refine((t) => wordCount(t) <= 7, "more than 7 words"), rationale: z.string().max(200) })).length(3),
});

export interface CopyInput {
  brief: Pick<Brief, "brandName" | "brandVoice" | "audienceText" | "loves" | "flightStart" | "flightWeeks">;
  face: Pick<Face, "id" | "name" | "neighbourhood" | "kind">;
  topTags: string[];
  events: { title: string; date: string }[];
  redraftNote?: string; // set when Ultra flagged this face
  avoid?: string[]; // lines already used on nearby faces
}

export interface CopyResult {
  lines: CopyLine[];
  steps: RunStep[];
}

function truncate7(t: string): string {
  const w = t.trim().split(/\s+/);
  return w.length <= 7 ? t.trim() : `${w.slice(0, 7).join(" ").replace(/[,;:]+$/, "")}.`;
}

export async function writeCopy(tf: TokenFactory, i: CopyInput): Promise<CopyResult> {
  const facts = [
    `Brand: ${i.brief.brandName}. Voice: ${i.brief.brandVoice ?? "warm, dry, a little cheeky"}. Audience loves: ${i.brief.loves.join("; ")}.`,
    `Flight: ${i.brief.flightStart}, ${i.brief.flightWeeks} weeks.`,
    `Face ${i.face.id}: ${i.face.kind} at ${i.face.name}, ${i.face.neighbourhood}.`,
    `This block over-indexes on: ${i.topTags.join(", ") || "no tag evidence"}.`,
    i.events.length ? `During the flight nearby: ${i.events.map((e) => `${e.title} (${e.date})`).join("; ")}.` : "No dated event nearby.",
    i.avoid?.length ? `Do not reuse or echo these lines used on nearby faces: ${i.avoid.join(" | ")}.` : "",
    i.redraftNote ? `Redraft: a reviewer flagged the last lines: ${i.redraftNote}` : "",
  ].filter(Boolean).join("\n");

  let value: z.infer<typeof Lines>["lines"];
  let steps: RunStep[];
  try {
    const r = await chatJson(tf, {
      role: "lightning", reasoning: "off", temperature: 0.8, maxTokens: 400,
      meta: { title: `${i.redraftNote ? "redraft" : "write"} 3 lines for ${i.face.id}`, tool: "copy", summary: `${i.face.neighbourhood}` },
      messages: [{ role: "system", content: RULES }, { role: "user", content: facts }],
    }, Lines);
    value = r.value.lines;
    steps = r.steps;
  } catch (e) {
    const failed = (e as { steps?: RunStep[] }).steps ?? [];
    // Last resort: ask for loose text and trim to 7 words in code; the step says so.
    const loose = await chatJson(tf, {
      role: "lightning", reasoning: "off", temperature: 0.8, maxTokens: 400,
      meta: { title: `write 3 lines for ${i.face.id} (loose)`, tool: "copy", summary: "validated output failed twice; lines trimmed to 7 words in code" },
      messages: [{ role: "system", content: RULES }, { role: "user", content: facts }],
    }, z.object({ lines: z.array(z.object({ text: z.string(), rationale: z.string().default("") })).min(1).max(5) }));
    value = loose.value.lines.slice(0, 3).map((l) => ({ ...l, text: truncate7(l.text) }));
    steps = [...failed, ...loose.steps];
  }

  const lines: CopyLine[] = [];
  for (const l of value) {
    const g = await guardText(l.text, { kind: "copy" });
    lines.push({ text: l.text.trim(), rationale: l.rationale, guard: g.verdict, nemo: null });
  }
  return { lines, steps };
}
