export interface NavItem {
  id: string;
  href: string;
  label: string;
  match: (path: string) => boolean;
}

// Product nav. Owner, Connections and Limits are built by the UI-B lane; this bar only links them.
export const navItems: NavItem[] = [
  { id: "plan", href: "/app", label: "Plan", match: (p) => p === "/app" || p.startsWith("/app/plans") || p.startsWith("/app/runs") },
  { id: "new", href: "/app/new", label: "New brief", match: (p) => p.startsWith("/app/new") },
  { id: "compare", href: "/app/compare", label: "Compare", match: (p) => p.startsWith("/app/compare") },
  { id: "owner", href: "/app/owner", label: "Owner", match: (p) => p.startsWith("/app/owner") },
  { id: "connections", href: "/app/connections", label: "Connections", match: (p) => p.startsWith("/app/connections") },
  { id: "limits", href: "/limits", label: "Limits", match: (p) => p.startsWith("/limits") },
];
