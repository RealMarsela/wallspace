import { runtimeEnv } from "@/server/db";
import { getFace } from "@/server/inventory";
import { QlooError, buildAudienceCard, qlooClientFor } from "@/server/qloo";

const fail = (error: string, status: number, code: string) => Response.json({ error, code }, { status });

// GET /api/owner/faces/:id/card -> { card, face, source }. Qloo tag + brand insights at the face's point (replay or live, cached).
// `source` is additive: { mode, recorded, exact, synthetic, label, sections }. synthetic=true means some section is an invented fixture; the label
// says which ("tags: Qloo recording, brands: synthetic sample") so real data is never labelled synthetic and synthetic data is never labelled real.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^ATL-\d{4}$/.test(id)) return fail("Invalid face id.", 400, "bad_request");
  const found = getFace(id);
  if (!found) return fail("Face not found.", 404, "not_found");
  try {
    const client = await qlooClientFor(runtimeEnv());
    const { card, source, sources } = await buildAudienceCard(client, found.face);
    const synthetic = source.some((s) => s.synthetic);
    const recorded = source.every((s) => s.recorded);
    const part = (s: { synthetic: boolean; recorded: boolean }) => (s.synthetic ? "synthetic sample" : s.recorded ? "Qloo recording" : "Qloo, live");
    const lift = sources.baseline ? ", ranked against the Atlanta list" : "";
    const label = !synthetic ? `${recorded ? "recorded Qloo answer" : "Qloo answer"}${lift}`
      : sources.tags.synthetic && sources.brands.synthetic ? "synthetic sample"
        : `tags: ${part(sources.tags)}${lift}; brands: ${part(sources.brands)}`;
    return Response.json({
      card, face: found.face,
      source: { mode: client.mode, recorded, exact: source.every((s) => s.exact), synthetic, label, sections: { tags: part(sources.tags), brands: part(sources.brands) } },
    }, synthetic ? { headers: { "x-wallspace-synthetic": "1" } } : undefined);
  } catch (e) {
    if (e instanceof QlooError) {
      if (e.code === "cap_reached") return fail("The Qloo call budget is used up; the recorded card is shown elsewhere.", 429, "qloo_cap");
      if (e.code === "no_recording") return fail("No recorded audience card for this face yet.", 503, "no_recording");
      if (e.code === "no_key") return fail("Qloo is not configured.", 503, "qloo_unavailable");
    }
    return fail("Qloo could not provide an audience card right now.", 502, "qloo_error");
  }
}
