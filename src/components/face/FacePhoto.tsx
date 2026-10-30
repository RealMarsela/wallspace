import type { Face } from "@/contract";

/** Site photo with its credit directly under it. Renders nothing when the face has no photo. */
export function FacePhoto({ face }: { face: Face }) {
  if (!face.photoUrl) return null;
  return (
    <figure className="m-0 flex max-w-md flex-col gap-1">
      {/* Plain <img>: photos come from our own API route and Commons, sizes vary. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-testid="face-photo" src={face.photoUrl} alt={`Street view near ${face.name}`} loading="lazy" className="w-full rounded border border-rule" />
      {face.photoCredit ? (
        <figcaption data-testid="face-photo-credit" className="break-words text-[0.72rem] text-muted">
          {face.photoCredit}
        </figcaption>
      ) : null}
    </figure>
  );
}
