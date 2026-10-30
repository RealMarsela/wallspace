import Link from "next/link";

/** Honest footer: what is sample, where the map comes from, and what Wallspace never does. */
export function Footer() {
  const a = "underline hover:text-ink";
  return (
    <footer data-testid="footer" className="border-t border-rule text-[0.78rem] text-muted">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4 py-3 sm:flex-row sm:flex-wrap sm:justify-between">
        <p>
          <strong className="text-ink-2">Aggregate taste by place, no device tracking.</strong> Brand, faces, rates and scores marked
          &ldquo;sample&rdquo; are invented for the demo.
        </p>
        <p className="flex flex-wrap gap-x-3">
          <span>
            Map data ©{" "}
            <a className={a} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap contributors
            </a>{" "}
            (ODbL) · tiles{" "}
            <a className={a} href="https://openfreemap.org" target="_blank" rel="noreferrer">
              OpenFreeMap
            </a>
          </span>
          <Link className={a} href="/limits" data-testid="footer-limits">Limits</Link>
          <Link className={a} href="/privacy" data-testid="footer-privacy">Privacy</Link>
          <Link className={a} href="/terms" data-testid="footer-terms">Terms</Link>
        </p>
      </div>
    </footer>
  );
}
