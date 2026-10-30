import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, NavLinksStatic } from "./NavLinks";

/** Product top bar. Exported for UI-B pages (/owner, /limits) to reuse. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-panel">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-4">
        <Link href="/app" data-testid="nav-home" className="font-bold">
          Wallspace
        </Link>
        <nav aria-label="Product" className="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto">
          <Suspense fallback={<NavLinksStatic />}>
            <NavLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
