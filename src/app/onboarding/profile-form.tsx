"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile, type ActionState } from "./actions";

const initial: ActionState = { error: null };

const input =
  "w-full rounded-none border-2 border-neutral-900 px-3 py-2 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none";
const label = "block text-xs font-medium text-neutral-600 mb-1";

export interface ProfileFormInitial {
  displayName?: string;
  sex?: "male" | "female";
  dateOfBirth?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: string | null;
  goal?: string | null;
  dietType?: string | null;
  allergies?: string[];
  budgetDaily?: number | null;
  targetWeightKg?: number | null;
  weighInTime?: string | null;
}

export function ProfileForm({
  initialProfile,
  successRedirect,
}: {
  /** Prefill for editing an existing profile. */
  initialProfile?: ProfileFormInitial;
  /** Navigate here after a clean save (settings edit flow). */
  successRedirect?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveProfile, initial);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && !pending && !state.error && successRedirect) {
      router.push(successRedirect);
    }
  }, [submitted, pending, state.error, successRedirect, router]);

  const v = initialProfile;

  return (
    <form
      action={(fd) => {
        setSubmitted(true);
        action(fd);
      }}
      className="space-y-4"
    >
      <div>
        <label className={label} htmlFor="displayName">Your name</label>
        <input id="displayName" name="displayName" required defaultValue={v?.displayName} className={input} placeholder="e.g. Priya" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="sex">Sex</label>
          <select id="sex" name="sex" required className={input} defaultValue={v?.sex ?? "female"} key={`sex-${v?.sex}`}>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="dateOfBirth">Date of birth</label>
          <input id="dateOfBirth" name="dateOfBirth" type="date" required defaultValue={v?.dateOfBirth ?? ""} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="heightCm">Height (cm)</label>
          <input id="heightCm" name="heightCm" type="number" step="0.1" min="100" max="230" required defaultValue={v?.heightCm ?? ""} className={input} placeholder="165" />
        </div>
        <div>
          <label className={label} htmlFor="weightKg">Weight (kg)</label>
          <input id="weightKg" name="weightKg" type="number" step="0.1" min="30" max="250" required defaultValue={v?.weightKg ?? ""} className={input} placeholder="62" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="activityLevel">Activity level</label>
          <select id="activityLevel" name="activityLevel" required className={input} defaultValue={v?.activityLevel ?? "light"} key={`act-${v?.activityLevel}`}>
            <option value="sedentary">Sedentary (desk job)</option>
            <option value="light">Lightly active</option>
            <option value="moderate">Moderately active</option>
            <option value="active">Active</option>
            <option value="very_active">Very active</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="goal">Goal</label>
          <select id="goal" name="goal" required className={input} defaultValue={v?.goal ?? "maintenance"} key={`goal-${v?.goal}`}>
            <option value="weight_loss">Weight loss</option>
            <option value="maintenance">Maintain</option>
            <option value="muscle_gain">Muscle gain</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="dietType">Diet type</label>
          <select id="dietType" name="dietType" required className={input} defaultValue={v?.dietType ?? "veg"} key={`diet-${v?.dietType}`}>
            <option value="veg">Vegetarian</option>
            <option value="egg">Eggetarian</option>
            <option value="non_veg">Non-vegetarian</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="budgetDaily">Daily food budget (₹, optional)</label>
          <input id="budgetDaily" name="budgetDaily" type="number" min="0" defaultValue={v?.budgetDaily ?? ""} className={input} placeholder="300" />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="allergiesRaw">Allergies (comma separated)</label>
        <input id="allergiesRaw" name="allergiesRaw" defaultValue={v?.allergies?.join(", ")} className={input} placeholder="peanuts, dairy" />
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-none border-2 border-neutral-900 bg-emerald-200 p-3">
        <div>
          <label className={label} htmlFor="targetWeightKg">Target weight (kg)</label>
          <input id="targetWeightKg" name="targetWeightKg" type="number" step="0.1" min="25" max="250" defaultValue={v?.targetWeightKg ?? ""} className={input} placeholder="e.g. 75" />
        </div>
        <div>
          <label className={label} htmlFor="weighInTime">Daily weigh-in reminder</label>
          <input id="weighInTime" name="weighInTime" type="time" defaultValue={v?.weighInTime ?? "07:30"} className={input} />
        </div>
        <p className="col-span-2 text-[10px] text-neutral-500">
          Weigh in daily at this time — the tracker follows your progress and your targets follow your body.
        </p>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {submitted && !pending && !state.error && !successRedirect && (
        <p className="text-sm text-emerald-700">Profile saved — targets recalculated.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-50"
      >
        {pending ? "Saving…" : successRedirect ? "Save changes" : "Continue"}
      </button>
    </form>
  );
}
