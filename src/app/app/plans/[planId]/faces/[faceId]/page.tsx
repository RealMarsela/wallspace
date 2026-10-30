import { Suspense } from "react";
import { FaceSheet } from "@/components/face/FaceSheet";

export default function FacePage({ params }: PageProps<"/app/plans/[planId]/faces/[faceId]">) {
  return (
    <Suspense fallback={<div data-testid="face-loading" className="p-6">Loading face…</div>}>
      {params.then(({ planId, faceId }) => (
        <FaceSheet planId={decodeURIComponent(planId)} faceId={decodeURIComponent(faceId)} />
      ))}
    </Suspense>
  );
}
