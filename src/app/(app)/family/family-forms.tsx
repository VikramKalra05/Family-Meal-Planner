"use client";

import { useActionState } from "react";
import { sendMessageAction, type FamilyActionState } from "./actions";
import { WorkingBar } from "@/components/ai-working";

const input =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-sm transition focus:shadow-[3px_3px_0_#111] focus:outline-none";
const label = "mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500";
const primary =
  "rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]";

const init: FamilyActionState = { error: null, ok: null };

export function SendMessageForm({ members }: { members: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(sendMessageAction, init);

  return (
    <form
      key={state.ok ?? "new"}
      action={action}
      aria-busy={pending}
      className="space-y-2.5"
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="toMember">To</label>
          <select id="toMember" name="toMember" className={input} defaultValue="">
            <option value="">Whole family</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="kind">Type</label>
          <select id="kind" name="kind" className={input} defaultValue="suggestion">
            <option value="suggestion">💡 Meal suggestion</option>
            <option value="instruction">👨‍🍳 Kitchen instruction</option>
          </select>
        </div>
      </div>
      <div>
        <label className={label} htmlFor="title">Title</label>
        <input id="title" name="title" required className={input} placeholder="Try paneer bhurji tomorrow?" />
      </div>
      <div>
        <label className={label} htmlFor="body">Message</label>
        <textarea id="body" name="body" rows={2} required className={`${input} resize-none`} placeholder="Use the remaining paneer before Friday…" />
      </div>
      {state.error && <p className="text-xs font-bold text-red-600">{state.error}</p>}
      {state.ok && <p className="text-xs font-bold text-emerald-700">{state.ok}</p>}
      {pending && <WorkingBar label="Sending to the family board…" />}
      <button type="submit" disabled={pending} className={`${primary} w-full ${pending ? "nb-loading cursor-wait" : ""}`}>
        {pending ? "◌ Sending…" : "Send"}
      </button>
    </form>
  );
}
