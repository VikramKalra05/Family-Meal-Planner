import Link from "next/link";

/**
 * Back navigation as a proper brutalist button — small but solid.
 * Label should be the destination ("Recipes"); the chevron says "back".
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-none border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M12.79 5.23a.75.75 0 01-.02 1.06L8.06 11l4.71 4.71a.75.75 0 11-1.06 1.06l-5.25-5.25a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.08.02z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </Link>
  );
}
