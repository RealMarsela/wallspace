import { Suspense } from "react";
import { FaceSheet } from "@/components/face/FaceSheet";
import { SAMPLE_PLAN_ID } from "@/lib/routes";

export default function SampleFacePage({ params }: PageProps<"/sample/faces/[faceId]">) {
  return (
    <Suspense fallback={<div data-testid="face-loading" className="p-6">Loading face…</div>}>
      {params.then(({ faceId }) => (
        <FaceSheet planId={SAMPLE_PLAN_ID} faceId={decodeURIComponent(faceId)} />
      ))}
    </Suspense>
  );
}
