"use client";

import { useEffect, useState } from "react";
import type { MeResponse } from "@/contract";
import { AUTH_EVENT, fetchMe } from "./auth-client";

export type MeState = { status: "loading" } | { status: "error" } | { status: "ready"; me: MeResponse };

/** The shared /api/me answer for a component: loads once per page (see fetchMe) and again after a sign-in, sign-out or setup change. */
export function useMe(): MeState & { reload: () => void } {
  const [state, setState] = useState<MeState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void fetchMe().then(
      (me) => live && setState({ status: "ready", me }),
      () => live && setState({ status: "error" }),
    );
    return () => {
      live = false;
    };
  }, [tick]);
  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    window.addEventListener(AUTH_EVENT, on);
    return () => window.removeEventListener(AUTH_EVENT, on);
  }, []);
  return { ...state, reload: () => setTick((n) => n + 1) };
}
