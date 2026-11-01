"use client";

import { useActionState } from "react";
import { createHousehold, joinHousehold, type ActionState } from "./actions";

const initial: ActionState = { error: null };

const input =
  "w-full rounded-none border-2 border-neutral-900 px-3 py-2 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none";
const primary =
  "w-full rounded-none bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-50";

export function HouseholdForms() {
  const [createState, createAction, creating] = useActionState(createHousehold, initial);
  const [joinState, joinAction, joining] = useActionState(joinHousehold, initial);

  return (
    <div className="space-y-8">
      <form action={createAction} className="space-y-3">
        <h2 className="font-medium">Create a new household</h2>
        <input name="name" required placeholder="e.g. Sharma Family" className={input} />
        {createState.error && <p className="text-sm text-red-600">{createState.error}</p>}
        <button type="submit" disabled={creating} className={primary}>
          {creating ? "Creating…" : "Create household"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" /> or join an existing one{" "}
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <form action={joinAction} className="space-y-3">
        <h2 className="font-medium">Join with an invite code</h2>
        <input
          name="code"
          required
          minLength={6}
          maxLength={12}
          placeholder="8-character code"
          className={`${input} uppercase tracking-widest`}
        />
        {joinState.error && <p className="text-sm text-red-600">{joinState.error}</p>}
        <button type="submit" disabled={joining} className={primary}>
          {joining ? "Joining…" : "Join household"}
        </button>
      </form>
    </div>
  );
}
