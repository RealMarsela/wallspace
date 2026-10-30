import { Suspense } from "react";
import { CompareFromQuery } from "@/components/compare/CompareFromQuery";

export const metadata = { title: "Compare blocks" };

export default function ComparePage() {
  return (
    <Suspense fallback={<div data-testid="compare-loading" className="p-6">Loading…</div>}>
      <CompareFromQuery />
    </Suspense>
  );
}
