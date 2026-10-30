// Writes fixtures/qloo-synthetic/*.json: SYNTHETIC Qloo-shaped responses with invented values, for tests and replay dev.
// They are not Qloo data. Run: npx tsx scripts/qloo-make-synthetic.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { neighbourhoodAt } from "../src/data/neighbourhoods";
import { encodeGeohash } from "../src/server/qloo/geohash";

const out = new URL("../fixtures/qloo-synthetic/", import.meta.url);
mkdirSync(out, { recursive: true });
const save = (kind: string, endpoint: string, params: Record<string, string | number | boolean>, response: unknown, pretty = true) =>
  writeFileSync(new URL(`${kind}.json`, out), `${JSON.stringify({ kind, endpoint, params, response, synthetic: true, default: true }, null, pretty ? 1 : undefined)}\n`);

// Heatmap: a 2D grid of cells about 830 m apart in both latitude and longitude over the City of Atlanta (cell centres inside the city
// layer), smooth invented blobs on Little Five Points, East Atlanta Village, Old Fourth Ward, West End and Reynoldstown, low elsewhere.
// Each cell carries the geohash-7 of its centre, like Qloo's 6-7 character heatmap cells. Values are invented.
const LAT_STEP = 0.0075;
const LNG_STEP = 0.009;
const peaks: [number, number, number, number][] = [
  [33.7648, -84.3489, 1.0, 0.013], // Little Five Points
  [33.7397, -84.3443, 0.85, 0.012], // East Atlanta Village
  [33.7720, -84.3640, 0.8, 0.013], // Old Fourth Ward
  [33.7365, -84.4130, 0.7, 0.014], // West End
  [33.7490, -84.3470, 0.8, 0.011], // Reynoldstown
  [33.8400, -84.3790, 0.3, 0.016], // Buckhead
];
const raw: { lat: number; lng: number; a: number }[] = [];
for (let lat = 33.6500 + LAT_STEP / 2; lat < 33.8900; lat += LAT_STEP) {
  for (let lng = -84.5500 + LNG_STEP / 2; lng < -84.2900; lng += LNG_STEP) {
    if (!neighbourhoodAt(lat, lng)) continue; // inside the City of Atlanta only
    const blobs = peaks.reduce((sum, [pl, pg, w, sd]) => sum + w * Math.exp(-(((lat - pl) ** 2 + (lng - pg) ** 2) / (2 * sd * sd))), 0);
    const ripple = 0.03 * (Math.sin(lat * 900) + Math.cos(lng * 700)); // small smooth variation so the floor is not flat
    raw.push({ lat, lng, a: Math.max(0.02, 0.07 + blobs + ripple) });
  }
}
const maxA = Math.max(...raw.map((c) => c.a));
const cells = raw.map((c) => ({ ...c, a: Math.min(1, c.a / maxA) }));
const sorted = [...cells].map((c) => c.a).sort((x, y) => x - y);
const rank = (a: number) => sorted.findIndex((v) => v >= a) / Math.max(1, sorted.length - 1);
save("heatmap", "/v2/insights", { "filter.type": "urn:heatmap", "filter.location": "POLYGON((-84.55 33.65,-84.29 33.65,-84.29 33.89,-84.55 33.89,-84.55 33.65))", "signal.interests.tags": "urn:tag:genre:media:comedy" }, {
  success: true,
  results: { heatmap: cells.map((c) => ({ location: { latitude: +c.lat.toFixed(6), longitude: +c.lng.toFixed(6), geohash: encodeGeohash(c.lat, c.lng, 7) }, query: { affinity: +c.a.toFixed(4), affinity_rank: +rank(c.a).toFixed(4), popularity: +(0.25 + 0.6 * c.a).toFixed(4) } })) },
}, false);
const tagRows: [string, string, number][] = [
  ["synthetic:live_comedy", "Live Comedy", 0.92], ["synthetic:record_stores", "Independent Record Stores", 0.88], ["synthetic:vintage_clothing", "Vintage Clothing", 0.84],
  ["synthetic:dive_bars", "Dive Bars", 0.8], ["synthetic:street_art", "Street Art", 0.71], ["synthetic:craft_beer", "Craft Beer", 0.66],
  ["synthetic:vegan_food", "Vegan Food", 0.61], ["synthetic:tattoo", "Tattoo Studios", 0.55], ["synthetic:small_venues", "Small Music Venues", 0.52],
];
save("tags-by-place", "/v2/insights", { "filter.type": "urn:tag", "signal.location": "POINT(-84.3489 33.7648)" }, {
  success: true, results: { tags: tagRows.map(([id, name, a]) => ({ tag_id: `urn:tag:${id}`, name, types: ["urn:entity:place"], subtype: "urn:tag:genre:place", query: { affinity: a } })) },
});
const brandRows: [string, number, number][] = [["Peachtree Pour House (synthetic)", 0.9, 0.5], ["Orbit Records (synthetic)", 0.86, 0.3], ["Second Spin Vintage (synthetic)", 0.8, 0.35], ["Foxglove Brewing (synthetic)", 0.74, 0.55], ["Greenroom Tacos (synthetic)", 0.67, 0.6], ["Ink & Ember (synthetic)", 0.6, 0.25]];
save("brands-by-place", "/v2/insights", { "filter.type": "urn:entity:brand", "signal.location": "POINT(-84.3489 33.7648)" }, {
  success: true, results: { entities: brandRows.map(([name, a, p], i) => ({ entity_id: `SYNTH-BRAND-${String(i + 1).padStart(4, "0")}`, name, types: ["urn:entity:brand"], query: { affinity: a, popularity: p } })) },
});
save("search", "/search", { query: "stand-up comedy" }, { results: [{ entity_id: "SYNTH-ENT-0001", name: "Stand-Up Comedy Specials (synthetic)", types: ["urn:entity:tv_show"], popularity: 0.8 }, { entity_id: "SYNTH-ENT-0002", name: "Late-Night Comedy Club (synthetic)", types: ["urn:entity:place"], popularity: 0.5 }] });
save("entities", "/entities", { entity_ids: "SYNTH-ENT-0001" }, { results: [{ entity_id: "SYNTH-ENT-0001", name: "Stand-Up Comedy Specials (synthetic)", types: ["urn:entity:tv_show"], popularity: 0.8 }] });
save("audiences", "/v2/audiences", { "filter.parents.types": "urn:audience:leisure" }, { success: true, results: { audiences: [{ entity_id: "urn:audience:leisure:synthetic_nightlife", name: "Nightlife Regulars (synthetic)", types: ["urn:audience:leisure"] }, { entity_id: "urn:audience:leisure:synthetic_live_events", name: "Live Event Goers (synthetic)", types: ["urn:audience:leisure"] }] } });
save("tags", "/v2/tags", { "filter.query": "comedy" }, { success: true, results: { tags: [{ id: "urn:tag:genre:media:comedy", name: "Comedy", type: "urn:tag:genre:media", popularity: 0.99 }] } });
save("demographics", "/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": "SYNTH-ENT-0001" }, { success: true, results: { demographics: [{ entity_id: "SYNTH-ENT-0001", query: { age: { "25_to_29": 0.31, "30_to_34": 0.22, "55_to_64": -0.4 }, gender: { female: -0.02, male: 0.03 } } }] } });
save("explain", "/v2/insights", { "filter.type": "urn:entity:brand", "feature.explainability": true }, { success: true, results: { entities: [{ entity_id: "SYNTH-BRAND-0001", name: "Peachtree Pour House (synthetic)", subtype: "urn:entity:brand", query: { affinity: 0.9, explainability: { "signal.interests.entities": [{ entity_id: "SYNTH-ENT-0001", score: 1 }] } } }] } });
