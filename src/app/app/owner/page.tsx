import type { Metadata } from "next";
import { OwnerInventory } from "@/components/owner/OwnerInventory";

export const metadata: Metadata = {
  title: "Media owners",
  description: "Media-owner mode: who lives around each face, and which brands to pitch it to.",
};

export default function OwnerPage() {
  return (
    <div data-testid="owner-page" className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-4xl">Media-owner mode</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Your inventory, turned around: for each face, what the people who live around it love, and the brands whose fans
        over-index there. Aggregate taste by place from Qloo; no device tracking, never identity.
      </p>
      <div className="mt-6">
        <OwnerInventory />
      </div>
    </div>
  );
}
