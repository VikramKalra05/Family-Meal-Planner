"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavLink {
  href: string;
  label: string;
  icon: string;
}

const NAV_GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: "Nutrition",
    links: [
      { href: "/", label: "Today", icon: "🏠" },
      { href: "/week", label: "Week", icon: "🗓️" },
      { href: "/recipes", label: "Recipes", icon: "🍲" },
      { href: "/pantry", label: "Pantry", icon: "🧺" },
      { href: "/shopping", label: "Shopping", icon: "🛒" },
      { href: "/progress", label: "Weight", icon: "⚖️" },
    ],
  },
  {
    label: "Training",
    links: [
      { href: "/gym", label: "Gym", icon: "🏋️" },
      { href: "/gym/plan", label: "Program", icon: "📋" },
      { href: "/gym/exercises", label: "Exercises", icon: "📚" },
      { href: "/gym/progress", label: "Strength", icon: "📈" },
    ],
  },
  {
    label: "Household",
    links: [
      { href: "/family", label: "Family", icon: "👨‍👩‍👧" },
      { href: "/settings", label: "Settings", icon: "⚙️" },
    ],
  },
];

const links = NAV_GROUPS.flatMap((g) => g.links);

// Mobile bottom bar shows the two daily surfaces plus a "More" sheet.
const MOBILE_PRIMARY = ["/", "/gym"];

function matches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The most specific matching link wins. Without this, `/gym` would light up
 * alongside `/gym/progress` on every nested gym page.
 */
function activeHref(pathname: string): string | null {
  return (
    links
      .filter((l) => matches(pathname, l.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
  );
}

/**
 * Fixed-size pending dot rendered inside a <Link>. `useLinkStatus` flips to
 * pending while the destination server-render is in flight — the skeleton in
 * `loading.tsx` shows the page shape, this confirms *which* tab was clicked.
 */
function PendingDot({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 border border-neutral-900 bg-emerald-400 transition-opacity duration-150 ${
        pending ? "nb-blink opacity-100" : "opacity-0"
      } ${className}`}
    />
  );
}

export function AppNav() {
  const pathname = usePathname();
  const active = activeHref(pathname);
  // Tie the sheet to the pathname it was opened on: navigating anywhere
  // closes it without an effect/setState cascade.
  const [moreOpenPath, setMoreOpenPath] = useState<string | null>(null);
  const moreOpen = moreOpenPath === pathname;

  return (
    <>
      {/* Desktop sidebar — grouped so 12 destinations stay scannable */}
      <nav
        aria-label="Main"
        className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:overflow-y-auto md:border-r-2 md:border-neutral-900 md:bg-white md:p-3"
      >
        <p className="mb-2 px-2 text-base font-extrabold uppercase leading-tight tracking-tight">
          Family Meal<br />Planner
        </p>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-2 pb-1 pt-2 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.links.map((l) => {
                const isActive = active === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 border-2 px-3 py-2 text-sm font-bold transition-all ${
                      isActive
                        ? "border-neutral-900 bg-yellow-300 text-neutral-900 shadow-[3px_3px_0_#111]"
                        : "border-transparent text-neutral-600 hover:border-neutral-900 hover:bg-white hover:text-neutral-900 hover:shadow-[2px_2px_0_#111]"
                    }`}
                  >
                    <span className="text-lg leading-none" aria-hidden>{l.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <PendingDot />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Mobile bottom bar: Today · Gym · More */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t-2 border-neutral-900 bg-white py-2 md:hidden"
      >
        {links.filter((l) => MOBILE_PRIMARY.includes(l.href)).map((l) => {
          const isActive = active === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center rounded-none px-4 py-1 text-[11px] font-bold ${
                isActive
                  ? "bg-yellow-300 text-neutral-900 shadow-[2px_2px_0_#111]"
                  : "text-neutral-500"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>{l.icon}</span>
              <span className="flex items-center gap-1.5">
                {l.label}
                <PendingDot className="h-1.5 w-1.5" />
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpenPath(moreOpen ? null : pathname)}
          aria-expanded={moreOpen}
          className={`flex flex-col items-center rounded-none px-4 py-1 text-[11px] font-bold ${
            moreOpen || (active != null && !MOBILE_PRIMARY.includes(active))
              ? "bg-yellow-300 text-neutral-900 shadow-[2px_2px_0_#111]"
              : "text-neutral-500"
          }`}
        >
          <span className="text-lg leading-none" aria-hidden>⋯</span>
          More
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpenPath(null)}
            className="fixed inset-0 z-20 bg-neutral-900/20 md:hidden"
          />
          <div className="fixed inset-x-2 bottom-[70px] z-30 max-h-[70vh] overflow-y-auto border-2 border-neutral-900 bg-white p-3 shadow-[6px_6px_0_#111] md:hidden">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="mb-1 px-1 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {group.links.map((l) => {
                    const isActive = active === l.href;
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setMoreOpenPath(null)}
                        className={`flex flex-col items-center gap-1 border-2 px-2 py-2 text-[10px] font-bold transition-all ${
                          isActive
                            ? "border-neutral-900 bg-yellow-300 text-neutral-900 shadow-[2px_2px_0_#111]"
                            : "border-neutral-900 bg-white text-neutral-700 shadow-[2px_2px_0_#111] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-lg leading-none" aria-hidden>{l.icon}</span>
                          <PendingDot className="h-1.5 w-1.5" />
                        </span>
                        {l.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
