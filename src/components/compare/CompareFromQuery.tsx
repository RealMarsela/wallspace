"use client";
import { useSearchParams } from "next/navigation";
import { CompareView } from "./CompareView";

export function CompareFromQuery() {
  const plan = useSearchParams().get("plan") ?? undefined;
  return <CompareView planId={plan} />;
}
