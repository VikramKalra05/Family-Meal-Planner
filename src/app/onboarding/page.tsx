import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { signOut } from "@/app/auth/actions";
import { ProfileForm } from "./profile-form";
import { HouseholdForms } from "./household-form";

export const instant = false;

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (profile?.household_id) redirect("/");
  const step = !profile ? "profile" : "household";

  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50 p-6">
      <div className="w-full max-w-md space-y-6 rounded-none bg-white p-8 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
            Step {step === "profile" ? "1 of 2" : "2 of 2"}
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            {step === "profile" ? "Set up your profile" : "Set up your household"}
          </h1>
          <p className="text-sm text-neutral-500">
            {step === "profile"
              ? "We use this to calculate your personal calorie and macro targets."
              : "Meals, pantry and shopping lists are shared per household."}
          </p>
        </div>

        {step === "profile" ? <ProfileForm /> : <HouseholdForms />}

        <form action={signOut} className="text-center">
          <button type="submit" className="text-xs text-neutral-400 hover:text-neutral-600">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
