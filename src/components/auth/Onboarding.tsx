"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BriefsResponse, type Brief, type MeResponse, type WorkspaceRole } from "@/contract";
import { fetchMe, notifyAuthChanged, sendJson } from "@/lib/auth-client";

const field = "block w-full rounded border border-rule bg-panel px-3 py-2";
const primary = "rounded border border-rule bg-ink px-4 py-2 text-ground disabled:opacity-50";
const secondary = "rounded border border-rule bg-panel px-4 py-2";

/** Plain four-step onboarding: workspace, tools (skippable), first brief or faces, done. Designed later. */
export function Onboarding() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("buyer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [briefs, setBriefs] = useState<Brief[]>([]);

  const refresh = useCallback(async () => {
    setMe(await fetchMe(true));
    notifyAuthChanged();
  }, []);
  useEffect(() => {
    void fetchMe().then(setMe, () => setError("Could not load your account."));
  }, []);

  const step = me?.onboarding.step;
  useEffect(() => {
    if (step !== "first" && step !== "done") return;
    void fetch("/api/briefs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { briefs: [] }))
      .then((j) => setBriefs(BriefsResponse.parse(j).briefs), () => undefined);
  }, [step, me?.onboarding.briefCount]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const createWorkspace = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "");
    void run(() => sendJson("POST", "/api/workspaces", { name, role }));
  };
  const advance = (step: "first" | "done", skipped: boolean) => void run(() => sendJson("PATCH", "/api/onboarding", { step, skipped }));

  if (!me) return <main className="mx-auto max-w-xl px-4 py-10" data-testid="onboarding-loading">Loading...</main>;
  if (!me.user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10" data-testid="onboarding-signed-out">
        <p>Sign in to set up your workspace.</p>
        <Link data-testid="onboarding-sign-in" href="/signin?next=/app/onboarding" className="underline">Sign in</Link>
      </main>
    );
  }
  const { briefCount } = me.onboarding;
  const buyer = me.workspace?.role !== "media-owner";

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-10">
      <h1 className="text-xl font-bold">Set up your workspace</h1>
      <p data-testid="onboarding-step" data-step={step}>Step: {step}</p>

      {step === "workspace" ? (
        <form onSubmit={createWorkspace} className="space-y-3" data-testid="onboarding-workspace-form">
          <label className="block">
            Workspace name
            <input data-testid="onboarding-workspace-name" name="name" required minLength={2} maxLength={80} placeholder="Porchlight Comedy Tour" className={field} />
          </label>
          <fieldset className="space-y-1">
            <legend>I am a</legend>
            <label className="block"><input type="radio" name="role" data-testid="onboarding-role-buyer" checked={role === "buyer"} onChange={() => setRole("buyer")} /> brand, agency or touring act buying space</label>
            <label className="block"><input type="radio" name="role" data-testid="onboarding-role-media-owner" checked={role === "media-owner"} onChange={() => setRole("media-owner")} /> media owner with faces to sell</label>
          </fieldset>
          <p className="text-ink-2">City: Atlanta</p>
          <button type="submit" data-testid="onboarding-create-workspace" disabled={busy} className={primary}>Create workspace</button>
        </form>
      ) : null}

      {step === "tools" ? (
        <section className="space-y-3" data-testid="onboarding-tools">
          <p>Connect the tools you already use (mail, Slack, CRM, sheets, calendar). Optional; you can do it later.</p>
          <Link data-testid="onboarding-connections-link" href="/app/connections" className="underline">Open connections</Link>
          <div className="flex gap-2">
            <button type="button" data-testid="onboarding-tools-continue" disabled={busy} onClick={() => advance("first", false)} className={primary}>Continue</button>
            <button type="button" data-testid="onboarding-tools-skip" disabled={busy} onClick={() => advance("first", true)} className={secondary}>Skip for now</button>
          </div>
        </section>
      ) : null}

      {step === "first" ? (
        <section className="space-y-3" data-testid="onboarding-first">
          {buyer ? (
            <>
              <p>Write your first brief: who the audience is, what they love, the budget and the flight dates.</p>
              <Link data-testid="onboarding-brief-link" href="/app/new" className="underline">Create a brief</Link>
              <p data-testid="onboarding-brief-count">Briefs so far: {briefCount}</p>
              <ul data-testid="onboarding-brief-list">
                {briefs.map((b) => (
                  <li key={b.id} data-testid="onboarding-brief-item">{b.brandName}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>See the faces on offer and the audience around each one.</p>
              <Link data-testid="onboarding-faces-link" href="/app/owner" className="underline">View faces</Link>
            </>
          )}
          <div className="flex gap-2">
            <button type="button" data-testid="onboarding-finish" disabled={busy || (buyer && briefCount === 0)} onClick={() => advance("done", false)} className={primary}>Finish</button>
            {buyer ? <button type="button" data-testid="onboarding-skip-first" disabled={busy} onClick={() => advance("done", true)} className={secondary}>Skip this step</button> : null}
          </div>
        </section>
      ) : null}

      {step === "done" ? (
        <section className="space-y-3" data-testid="onboarding-done">
          <p>You are set up. Wallspace is free to use.</p>
          <Link data-testid="onboarding-done-link" href={buyer ? "/app" : "/app/owner"} className="underline">Go to the product</Link>
        </section>
      ) : null}

      {error ? <p role="alert" data-testid="onboarding-error" className="text-guard">{error}</p> : null}
    </main>
  );
}
