"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/props", label: "Players" },
  { href: "/props/browse", label: "Browse" },
  { href: "/props/summary", label: "Daily summary" },
];

export function PropsNav() {
  const path = usePathname();
  const active = (h: string) => (h === "/props" ? path === "/props" || /^\/props\/(nba|nfl)\//.test(path) : path.startsWith(h));
  return (
    <nav className="tabs" aria-label="Hit rates">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={active(t.href) ? "page" : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
