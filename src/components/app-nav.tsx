"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Today", icon: "🏠" },
  { href: "/week", label: "Week", icon: "🗓️" },
  { href: "/recipes", label: "Recipes", icon: "🍲" },
  { href: "/pantry", label: "Pantry", icon: "🧺" },
  { href: "/shopping", label: "Shopping", icon: "🛒" },
  { href: "/progress", label: "Progress", icon: "⚖️" },
  { href: "/family", label: "Family", icon: "👨‍👩‍👧" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

// Mobile bottom bar shows at most 3 buttons: the two daily surfaces plus a
// "More" sheet — 8 tiny buttons were unusable on phones.
const MOBILE_PRIMARY = ["/", "/week"];
const mobileRest = links.filter((l) => !MOBILE_PRIMARY.includes(l.href));

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
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
  // Tie the sheet to the pathname it was opened on: navigating anywhere
  // closes it without an effect/setState cascade.
  const [moreOpenPath, setMoreOpenPath] = useState<string | null>(null);
  const moreOpen = moreOpenPath === pathname;

  return (
    <>
      {/* Desktop sidebar — same width, big confident buttons */}
      <nav
        aria-label="Main"
        className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-2.5 md:border-r-2 md:border-neutral-900 md:bg-white md:p-4"
      >
        <p className="mb-4 px-2 text-base font-extrabold uppercase leading-tight tracking-tight">
          Family Meal<br />Planner
        </p>
        {links.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 border-2 px-4 py-3 text-base font-bold transition-all ${
                active
                  ? "border-neutral-900 bg-yellow-300 text-neutral-900 shadow-[4px_4px_0_#111]"
                  : "border-transparent text-neutral-600 hover:border-neutral-900 hover:bg-white hover:text-neutral-900 hover:shadow-[2px_2px_0_#111]"
              }`}
            >
              <span className="text-xl leading-none" aria-hidden>{l.icon}</span>
              <span className="min-w-0 flex-1 truncate">{l.label}</span>
              <PendingDot />
            </Link>
          );
        })}
      </nav>

      {/* Mobile bottom bar: Today · Week · More */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t-2 border-neutral-900 bg-white py-2 md:hidden"
      >
        {links.filter((l) => MOBILE_PRIMARY.includes(l.href)).map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center rounded-none px-4 py-1 text-[11px] font-bold ${
                active
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
            moreOpen || mobileRest.some((l) => isActive(pathname, l.href))
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
          <div className="fixed inset-x-2 bottom-[70px] z-30 border-2 border-neutral-900 bg-white p-3 shadow-[6px_6px_0_#111] md:hidden">
            <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
              Go to
            </p>
            <div className="grid grid-cols-3 gap-2">
              {mobileRest.map((l) => {
                const active = isActive(pathname, l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMoreOpenPath(null)}
                    className={`flex flex-col items-center gap-1 border-2 px-2 py-3 text-[11px] font-bold transition-all ${
                      active
                        ? "border-neutral-900 bg-yellow-300 text-neutral-900 shadow-[2px_2px_0_#111]"
                        : "border-neutral-900 bg-white text-neutral-700 shadow-[2px_2px_0_#111] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-xl leading-none" aria-hidden>{l.icon}</span>
                      <PendingDot className="h-1.5 w-1.5" />
                    </span>
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
