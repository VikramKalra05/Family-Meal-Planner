"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar — same width, big confident buttons */}
      <nav className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-2.5 md:border-r-2 md:border-neutral-900 md:bg-white md:p-4">
        <p className="mb-4 px-2 text-base font-extrabold uppercase leading-tight tracking-tight">
          Family Meal<br />Planner
        </p>
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 border-2 px-4 py-3 text-base font-bold transition-all ${
                active
                  ? "border-neutral-900 bg-yellow-300 text-neutral-900 shadow-[4px_4px_0_#111]"
                  : "border-transparent text-neutral-600 hover:border-neutral-900 hover:bg-white hover:text-neutral-900 hover:shadow-[2px_2px_0_#111]"
              }`}
            >
              <span className="text-xl leading-none" aria-hidden>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t-2 border-neutral-900 bg-white py-2 md:hidden">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-col items-center rounded-none px-1.5 py-1 text-[11px] font-bold ${
                active
                  ? "bg-yellow-300 text-neutral-900 shadow-[2px_2px_0_#111]"
                  : "text-neutral-500"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
