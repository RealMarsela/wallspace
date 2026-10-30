import type { Metadata } from "next";
import { Suspense } from "react";
import { AudienceCardView } from "@/components/owner/AudienceCardView";
import { PublicPage } from "@/components/site/PublicPage";
import { Skeleton } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Audience card",
  description: "Who lives around this face, by taste, and which brands to pitch it to.",
};

async function Card({ params }: { params: Promise<{ faceId: string }> }) {
  const { faceId } = await params;
  return <AudienceCardView faceId={decodeURIComponent(faceId)} />;
}

export default function AudienceCardPage({ params }: PageProps<"/faces/[faceId]">) {
  return (
    <PublicPage testId="audience-card-page">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Card params={params} />
      </Suspense>
    </PublicPage>
  );
}
