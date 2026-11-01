import { BackLink } from "@/components/back-link";
import { ProfileForm } from "@/app/onboarding/profile-form";
import { requireFullProfile } from "@/lib/profile";

export const instant = false;

export default async function EditProfilePage() {
  const profile = await requireFullProfile();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <BackLink href="/settings" label="Settings" />
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Edit profile</h1>
        <p className="text-sm text-neutral-500">
          Saving recalculates your BMR, TDEE and macro targets with the same engine the planner uses.
        </p>
      </div>
      <div className="rounded-none bg-white p-6 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <ProfileForm
          successRedirect="/settings"
          initialProfile={{
            displayName: profile.display_name,
            sex: profile.sex ?? undefined,
            dateOfBirth: profile.date_of_birth,
            heightCm: profile.height_cm == null ? null : Number(profile.height_cm),
            weightKg: profile.weight_kg == null ? null : Number(profile.weight_kg),
            activityLevel: profile.activity_level,
            goal: profile.goal,
            dietType: profile.diet_type,
            allergies: profile.allergies,
            budgetDaily: profile.budget_daily == null ? null : Number(profile.budget_daily),
            targetWeightKg: profile.target_weight_kg == null ? null : Number(profile.target_weight_kg),
            weighInTime: profile.weigh_in_time,
          }}
        />
      </div>
    </div>
  );
}
