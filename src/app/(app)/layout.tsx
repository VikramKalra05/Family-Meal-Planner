import { Suspense } from "react";
import { getProfile } from "@/lib/profile";
import { AppNav } from "@/components/app-nav";
import { SubmitButton } from "@/components/submit-button";
import { signOut } from "@/app/auth/actions";

/**
 * The shell renders immediately: nav, header frame and sign-out are static.
 * The profile-dependent header text streams in behind Suspense, so a slow
 * Supabase auth/profile read never blocks a page navigation. Each page still
 * enforces `requireFullProfile()`.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <AppNav />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-16 md:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-neutral-900 bg-white px-4 py-3 md:px-8">
          <div className="min-w-0 flex-1">
            <Suspense fallback={<ProfileHeadingSkeleton />}>
              <ProfileHeading />
            </Suspense>
          </div>
          <form action={signOut}>
            <SubmitButton
              pendingText="Signing out…"
              className="rounded-none border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium hover:bg-amber-50 disabled:opacity-60"
            >
              Sign out
            </SubmitButton>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

async function ProfileHeading() {
  const profile = await getProfile();
  if (!profile) return <ProfileHeadingSkeleton />;

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{profile.display_name}</p>
      <p className="text-xs text-neutral-500">
        {profile.role === "owner"
          ? "Household owner"
          : profile.role === "staff"
            ? "Kitchen staff"
            : "Family member"}
      </p>
    </div>
  );
}

function ProfileHeadingSkeleton() {
  return (
    <div className="min-w-0" aria-hidden>
      <div className="h-4 w-28 border border-neutral-300 bg-neutral-100 nb-loading" />
      <div className="mt-1 h-3 w-20 border border-neutral-300 bg-neutral-100 nb-loading" />
    </div>
  );
}
