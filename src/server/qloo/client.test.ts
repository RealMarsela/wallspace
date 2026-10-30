import { describe, expect, it, vi } from "vitest";
import { HeatCell } from "@/contract";
import { MemoryStore } from "../db";
import type { KvLike } from "../db/bindings";
import { QlooClient, newLocalMeter } from "./client";
import { brandsByPlace, entities, heatmap, tagsByPlace, search } from "./endpoints";
import { buildAudienceCard } from "./card";
import { decodeGeohash, encodeGeohash } from "./geohash";
import { normalizeRequest, requestKey } from "./request-key";
import { MemoryReplay } from "./replay";
import { syntheticRecordings, syntheticReplay } from "./synthetic";
import { QlooError } from "./types";

const kv = (): KvLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, get: async (k) => data.get(k) ?? null, put: async (k, v) => void data.set(k, v), delete: async (k) => void data.delete(k) };
};
const tagBody = { success: true, results: { tags: [{ tag_id: "urn:tag:x", name: "X", query: { affinity: 0.5 } }] } };
const okFetch = (body: unknown = tagBody) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const live = (over: Partial<ConstructorParameters<typeof QlooClient>[0]> = {}) => new QlooClient({ mode: "live", apiKey: "test-key", localMeter: newLocalMeter(), ...over });

describe("request keys", () => {
  it("ignore parameter order, blanks and undefined, and never include a key", async () => {
    const a = await requestKey("/v2/insights", { b: "2", a: "1", c: undefined, d: "" });
    expect(a).toBe(await requestKey("/v2/insights", { a: "1", b: "2" }));
    expect(a).not.toBe(await requestKey("/v2/insights", { a: "1", b: "3" }));
    expect(normalizeRequest("/x", { q: "  two   words " })).toBe("/x?q=two words");
  });
});

describe("geohash", () => {
  it("round-trips a point inside Atlanta to within a cell", () => {
    const h = encodeGeohash(33.7648, -84.3489, 6);
    expect(h).toHaveLength(6);
    const c = decodeGeohash(h);
    expect(Math.abs(c.lat - 33.7648)).toBeLessThan(0.004);
    expect(Math.abs(c.lng - -84.3489)).toBeLessThan(0.007);
  });
});

describe("replay mode", () => {
  it("answers from synthetic recordings, never calls fetch, and flags them", async () => {
    const f = okFetch();
    const store = new MemoryStore();
    const c = new QlooClient({ mode: "replay", replay: await syntheticReplay(), store, fetchImpl: f as never });
    const r = await tagsByPlace(c, 33.7648, -84.3489);
    expect(f).not.toHaveBeenCalled();
    expect(r.data.length).toBeGreaterThan(5);
    expect(r.source).toMatchObject({ mode: "replay", recorded: true, synthetic: true, exact: false });
    const ledger = await store.listLedger({ provider: "qloo" });
    expect(ledger[0]).toMatchObject({ mode: "replay", cached: true, status: "ok" });
  });
  it("prefers an exact recording over the default", async () => {
    const custom = { kind: "tags-by-place", endpoint: "/v2/insights", params: { "filter.type": "urn:tag", "signal.location": "POINT(-84.3 33.7)", take: 50 }, response: { results: { tags: [{ name: "Exact", query: { affinity: 1 } }] } } };
    const c = new QlooClient({ mode: "replay", replay: await MemoryReplay.from([custom, ...syntheticRecordings]) });
    expect((await tagsByPlace(c, 33.7, -84.3)).data[0].name).toBe("Exact");
    expect((await tagsByPlace(c, 33.7, -84.3)).source.exact).toBe(true);
  });
  it("fails clearly with no recording", async () => {
    const c = new QlooClient({ mode: "replay", replay: await MemoryReplay.from([]) });
    await expect(search(c, "x")).rejects.toMatchObject({ code: "no_recording" });
  });
  it("rejects a recording in an unexpected shape", async () => {
    const bad = { kind: "tags-by-place", endpoint: "/v2/insights", params: {}, response: { nope: 1 }, default: true };
    const c = new QlooClient({ mode: "replay", replay: await MemoryReplay.from([bad]) });
    await expect(tagsByPlace(c, 1, 1)).rejects.toMatchObject({ code: "shape" });
  });
});

describe("live mode", () => {
  it("sends X-Api-Key to the hackathon base, caches by request key, and ledgers cached and live calls", async () => {
    const f = okFetch();
    const cache = kv();
    const store = new MemoryStore();
    const c = live({ kv: cache, store, fetchImpl: f as never });
    await tagsByPlace(c, 33.7648, -84.3489);
    await tagsByPlace(c, 33.7648, -84.3489);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url.startsWith("https://hackathon.api.qloo.com/v2/insights?")).toBe(true);
    expect(decodeURIComponent(url)).toContain("signal.location=POINT(-84.3489+33.7648)"); // lng first, space form-encoded
    expect(init.headers["X-Api-Key"]).toBe("test-key");
    expect([...cache.data.keys()][0]).toMatch(/^qloo:v1:[0-9a-f]{32}$/);
    expect(JSON.stringify([...cache.data.values()])).not.toContain("test-key");
    const rows = await store.listLedger({ provider: "qloo" });
    expect(rows.map((r) => r.cached).sort()).toEqual([false, true]);
    expect(JSON.stringify(rows)).not.toContain("test-key");
  });
  it("refuses past the hard cap before any fetch and ledgers the block", async () => {
    const f = okFetch();
    const store = new MemoryStore();
    const c = live({ fetchImpl: f as never, store, caps: { total: 2, day: 2 } });
    await tagsByPlace(c, 1, 1);
    await tagsByPlace(c, 2, 2);
    await expect(tagsByPlace(c, 3, 3)).rejects.toMatchObject({ code: "cap_reached" });
    expect(f).toHaveBeenCalledTimes(2);
    expect((await store.listLedger()).some((r) => r.status === "blocked")).toBe(true);
  });
  it("does not count a call that never reached Qloo, and surfaces HTTP errors without caching them", async () => {
    const down = vi.fn(async () => { throw new TypeError("offline"); });
    const c = live({ fetchImpl: down as never, caps: { total: 1, day: 1 } });
    await expect(tagsByPlace(c, 5, 5)).rejects.toMatchObject({ code: "network" });
    await expect(tagsByPlace(c, 5, 5)).rejects.toMatchObject({ code: "network" }); // refunded, so still under the cap
    const cache = kv();
    const bad = vi.fn(async () => new Response("no", { status: 403 }));
    const c2 = live({ fetchImpl: bad as never, kv: cache });
    await expect(tagsByPlace(c2, 6, 6)).rejects.toMatchObject({ code: "http", status: 403 });
    expect(cache.data.size).toBe(0);
  });
  it("needs a key", async () => {
    const c = new QlooClient({ mode: "live" });
    await expect(search(c, "x")).rejects.toBeInstanceOf(QlooError);
  });
});

describe("endpoints over the synthetic set", () => {
  it("heatmap returns contract HeatCells in 0..1", async () => {
    const c = new QlooClient({ mode: "replay", replay: await syntheticReplay() });
    const { data } = await heatmap(c, { tagIds: ["urn:tag:genre:media:comedy"] });
    expect(data.length).toBeGreaterThan(50);
    for (const cell of data) { expect(HeatCell.safeParse(cell).success).toBe(true); }
    const best = data.reduce((a, b) => (b.affinity > a.affinity ? b : a));
    expect(best.lat).toBeGreaterThan(33.75);
    expect(best.lat).toBeLessThan(33.78);
  });
  it("brands and entities normalise ids and names", async () => {
    const c = new QlooClient({ mode: "replay", replay: await syntheticReplay() });
    expect((await brandsByPlace(c, 33.76, -84.35)).data[0]).toMatchObject({ id: expect.stringContaining("SYNTH"), name: expect.stringContaining("synthetic") });
    expect((await entities(c, ["SYNTH-ENT-0001"])).data[0].id).toBe("SYNTH-ENT-0001");
  });
  it("builds an audience card ranked by score, labelled synthetic through source", async () => {
    const c = new QlooClient({ mode: "replay", replay: await syntheticReplay() });
    const { card, source } = await buildAudienceCard(c, { id: "ATL-0101", lat: 33.7648, lng: -84.3489 }, new Date("2026-10-30T08:00:00Z"));
    expect(card.faceId).toBe("ATL-0101");
    expect(card.topTags[0].score).toBeGreaterThanOrEqual(card.topTags[1].score);
    expect(card.brands.length).toBeGreaterThan(2);
    expect(source.every((s) => s.synthetic)).toBe(true);
  });
});
