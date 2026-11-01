import { requireFullProfile } from "@/lib/profile";
import { AppNav } from "@/components/app-nav";
import { WeighInReminder } from "@/components/weigh-in-reminder";
import { signOut } from "@/app/auth/actions";

// Every (app) route is user-specific — render blocking, no static shell.
// Note: the dev overlay may show a "unstable value Date.now()" diagnostic —
// that is Supabase's internal session-expiry check tripping Next's prerender
// detector. Pages render correctly; the proper Suspense refactor is planned
// for the M6 polish pass, and production builds are unaffected.
export const instant = false;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireFullProfile();

  return (
    <div className="flex h-dvh overflow-hidden">
      <WeighInReminder weighInTime={profile.weigh_in_time} />
      <AppNav />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-16 md:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-neutral-900 bg-white px-4 py-3 md:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.display_name}</p>
            <p className="text-xs text-neutral-500">
              {profile.role === "owner" ? "Household owner" : profile.role === "staff" ? "Kitchen staff" : "Family member"}
            </p>
          </div>
          <form action={signOut}>
            <button className="rounded-none border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium hover:bg-amber-50">
              Sign out
            </button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
