"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav";

const cls = "flex h-full shrink-0 items-center border-b-2 px-2.5 text-[0.85rem]";

export function NavLinks() {
  const path = usePathname() ?? "";
  return (
    <>
      {navItems.map((n) => {
        const active = n.match(path);
        return (
          <Link
            key={n.href}
            href={n.href}
            data-testid={`nav-${n.id}`}
            aria-current={active ? "page" : undefined}
            className={`${cls} ${active ? "border-ink font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}

export function NavLinksStatic() {
  return (
    <>
      {navItems.map((n) => (
        <Link key={n.href} href={n.href} data-testid={`nav-${n.id}`} className={`${cls} border-transparent text-ink-2`}>
          {n.label}
        </Link>
      ))}
    </>
  );
}
