import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { TopBar } from "./TopBar";

/** The product frame: skip link, top bar, main column, footer. Used by /app (behind the guard) and by the public /sample. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-heat focus:px-3 focus:py-2 focus:text-[#1a1205]">
        Skip to content
      </a>
      <TopBar />
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
