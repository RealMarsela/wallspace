import type { z } from "zod";
import type { Store } from "../db/types";
import type { DurableNsLike, KvLike } from "../db/bindings";
import { DEFAULT_CAPS, QlooMeterCore, type MeterResult, type MeterStorage } from "./meter-core";
import type { ReplaySource } from "./replay";
import { requestKey } from "./request-key";
import { ErrorResp, QLOO_BASE, QlooError, type QlooKind, type QlooMode, type QlooParams } from "./types";

const CACHE_TTL_S = 60 * 60 * 24 * 30;
class MapStorage implements MeterStorage {
  private readonly data = new Map<string, unknown>();
  async get<T>(k: string) { return this.data.get(k) as T | undefined; }
  async put<T>(k: string, v: T) { this.data.set(k, JSON.parse(JSON.stringify(v))); }
}
// Dev and tests without the QLOO_METER Durable Object: the caps hold per process.
const processMeter = new QlooMeterCore(new MapStorage());
/** A fresh in-process meter (tests). */
export const newLocalMeter = () => new QlooMeterCore(new MapStorage());

export interface QlooDeps {
  mode: QlooMode;
  apiKey?: string;
  kv?: KvLike;
  meter?: DurableNsLike; // QLOO_METER
  localMeter?: QlooMeterCore; // used when no Durable Object is bound; defaults to one per process
  caps?: { total: number; day: number };
  store?: Store; // ledger rows go here
  replay?: ReplaySource;
  fetchImpl?: typeof fetch;
  now?: () => number;
  base?: string;
  context?: { planId?: string; runId?: string };
  /** Replay only: called for every request that had no exact recording (a default recording answered, or nothing did). Used by the recording scripts. */
  onMiss?: (m: { kind: QlooKind; endpoint: string; params: QlooParams }) => void;
}

/** How an answer was produced: shown on the audience card and in run steps. */
export interface QlooSource {
  mode: QlooMode;
  cached: boolean; // KV cache hit or a recording: no live call was made for this answer
  recorded: boolean; // came from replay
  exact: boolean; // replay: the recording for this very request; false means the default recording for its kind
  synthetic: boolean;
  key: string;
  ms: number;
}
export interface QlooResult<T> { data: T; source: QlooSource }

export class QlooClient {
  constructor(private readonly d: QlooDeps) {}

  get mode(): QlooMode { return this.d.mode; }

  private async ledger(row: { endpoint: string; key: string; cached: boolean; status: "ok" | "error" | "blocked"; ms: number; note?: string }) {
    if (!this.d.store) return;
    await this.d.store.appendLedger({
      id: `qloo-${(this.d.now ?? Date.now)().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date((this.d.now ?? Date.now)()).toISOString(), provider: "qloo", endpoint: row.endpoint, requestKey: row.key, cached: row.cached,
      mode: this.d.mode, status: row.status, ms: row.ms, costUsd: null, planId: this.d.context?.planId ?? null, runId: this.d.context?.runId ?? null, note: row.note ?? null,
    }).catch(() => undefined); // a ledger failure never fails a taste lookup
  }

  private async reserve(): Promise<MeterResult> {
    const caps = this.d.caps ?? DEFAULT_CAPS;
    if (!this.d.meter) return (this.d.localMeter ?? processMeter).reserve(1, caps);
    const stub = this.d.meter.get(this.d.meter.idFromName("qloo"));
    const res = await stub.fetch("https://qloo-meter/reserve", { method: "POST", body: JSON.stringify({ n: 1 }) });
    return (await res.json()) as MeterResult;
  }
  private async refund(): Promise<void> {
    if (!this.d.meter) { await (this.d.localMeter ?? processMeter).refund(1, this.d.caps ?? DEFAULT_CAPS); return; }
    await this.d.meter.get(this.d.meter.idFromName("qloo")).fetch("https://qloo-meter/refund", { method: "POST", body: JSON.stringify({ n: 1 }) }).catch(() => undefined);
  }

  async call<T>(kind: QlooKind, endpoint: string, params: QlooParams, schema: z.ZodType<T>): Promise<QlooResult<T>> {
    const now = this.d.now ?? Date.now;
    const t0 = now();
    const key = await requestKey(endpoint, params);
    const done = (data: T, s: Omit<QlooSource, "key" | "ms">): QlooResult<T> => ({ data, source: { ...s, key, ms: now() - t0 } });
    const parse = (raw: unknown): T => {
      const r = schema.safeParse(raw);
      if (!r.success) throw new QlooError(`Qloo ${endpoint} answered in an unexpected shape.`, "shape");
      return r.data;
    };

    if (this.d.mode === "replay") {
      const hit = await this.d.replay?.lookup(key, kind);
      if (!hit?.exact) this.d.onMiss?.({ kind, endpoint, params });
      if (!hit) {
        await this.ledger({ endpoint, key, cached: true, status: "error", ms: now() - t0, note: "no recording" });
        throw new QlooError(`No recorded Qloo answer for ${kind}.`, "no_recording");
      }
      const data = parse(hit.recording.response);
      await this.ledger({ endpoint, key, cached: true, status: "ok", ms: now() - t0, note: hit.exact ? "recording" : "default recording for kind" });
      return done(data, { mode: "replay", cached: true, recorded: true, exact: hit.exact, synthetic: hit.recording.synthetic === true });
    }

    if (!this.d.apiKey) throw new QlooError("Qloo is not configured.", "no_key");
    const cached = await this.d.kv?.get(key);
    if (cached) {
      const data = parse(JSON.parse(cached));
      await this.ledger({ endpoint, key, cached: true, status: "ok", ms: now() - t0, note: "kv cache" });
      return done(data, { mode: "live", cached: true, recorded: false, exact: true, synthetic: false });
    }
    const gate = await this.reserve();
    if (!gate.ok) {
      await this.ledger({ endpoint, key, cached: false, status: "blocked", ms: now() - t0, note: gate.reason });
      throw new QlooError("The Qloo call budget is used up.", "cap_reached", 429);
    }
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    let res: Response;
    try {
      res = await (this.d.fetchImpl ?? fetch)(`${this.d.base ?? QLOO_BASE}${endpoint}?${qs}`, { headers: { "X-Api-Key": this.d.apiKey, accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    } catch {
      await this.refund(); // the request never produced an answer
      await this.ledger({ endpoint, key, cached: false, status: "error", ms: now() - t0, note: "network" });
      throw new QlooError("Qloo could not be reached.", "network");
    }
    if (!res.ok) {
      // A 400 carries { errors: [ { message, path } ] } and still costs a monthly unit; 5xx and auth failures carry no usable body.
      const bad = res.status === 400 ? ErrorResp.safeParse(await res.json().catch(() => null)) : null;
      const detail = bad?.success ? bad.data.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join("; ").slice(0, 300) : null;
      await this.ledger({ endpoint, key, cached: false, status: "error", ms: now() - t0, note: `http ${res.status}${detail ? `: ${detail}` : ""}` });
      throw new QlooError(detail ? `Qloo rejected the request: ${detail}` : `Qloo answered ${res.status}.`, detail ? "bad_request" : "http", res.status);
    }
    const raw: unknown = await res.json().catch(() => null);
    const data = parse(raw);
    await this.d.kv?.put(key, JSON.stringify(raw), { expirationTtl: CACHE_TTL_S }).catch(() => undefined);
    await this.ledger({ endpoint, key, cached: false, status: "ok", ms: now() - t0 });
    return done(data, { mode: "live", cached: false, recorded: false, exact: true, synthetic: false });
  }
}
