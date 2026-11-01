import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireFullProfile } from "@/lib/profile";
import { SendMessageForm } from "./family-forms";
import { markMessageRead } from "./actions";

export const instant = false;

interface MemberRow {
  id: string;
  display_name: string;
  role: string;
  diet_type: string;
  targets_cache: { targets: { kcal: number } } | null;
}

interface MessageRow {
  id: string;
  from_member: string | null;
  to_member: string | null;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export default async function FamilyPage() {
  const profile = await requireFullProfile();
  const supabase = await createClient();

  const [membersRes, messagesRes, householdRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, role, diet_type, targets_cache").eq("household_id", profile.household_id!),
    supabase.from("messages").select("*").eq("household_id", profile.household_id!).order("created_at", { ascending: false }).limit(30),
    supabase.from("households").select("name, invite_code").eq("id", profile.household_id!).single(),
  ]);

  const members = (membersRes.data ?? []) as MemberRow[];
  const memberName = new Map(members.map((m) => [m.id, m.display_name]));
  const messages = (messagesRes.data ?? []) as MessageRow[];
  const household = householdRes.data;
  const canSeeKitchen = profile.role === "owner" || profile.role === "staff";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Family</h1>
        <p className="text-sm text-neutral-500">
          {household?.name ?? "Household"} · suggest meals, send kitchen instructions.
        </p>
      </div>

      {canSeeKitchen && (
        <Link
          href="/kitchen"
          className="block rounded-none border-2 border-neutral-900 bg-orange-200 p-4 text-center shadow-[4px_4px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#111]"
        >
          🍳 <span className="text-sm font-extrabold uppercase tracking-wide">Open Kitchen Mode</span>
          <span className="block text-xs text-neutral-600">Cooking plan with quantities — safe to hand to the cook.</span>
        </Link>
      )}

      <section className="rounded-none border-2 border-neutral-900 bg-white shadow-[4px_4px_0_#111]">
        <div className="border-b-2 border-neutral-900 bg-yellow-300 px-4 py-2 text-sm font-extrabold uppercase tracking-wide">
          Members · invite code <span className="font-mono">{household?.invite_code}</span>
        </div>
        <ul className="divide-y-2 divide-dashed divide-neutral-200">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-bold">
                  {m.display_name}
                  {m.id === profile.id && <span className="ml-1 text-[10px] font-normal text-neutral-400">(you)</span>}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                  {m.role === "owner" ? "Owner" : m.role === "staff" ? "Kitchen staff" : "Member"} ·{" "}
                  {m.diet_type === "non_veg" ? "Non-veg" : m.diet_type === "egg" ? "Eggetarian" : "Vegetarian"}
                </p>
              </div>
              {m.targets_cache && (
                <span className="border-2 border-neutral-900 bg-white px-2 py-0.5 text-xs font-extrabold shadow-[2px_2px_0_#111]">
                  {m.targets_cache.targets.kcal} kcal
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-neutral-500">Send a note</h2>
        <SendMessageForm members={members.filter((m) => m.id !== profile.id).map((m) => ({ id: m.id, name: m.display_name }))} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Family board</h2>
        {messages.length === 0 && (
          <p className="rounded-none border-2 border-dashed border-neutral-900 bg-white p-8 text-center text-sm text-neutral-400">
            No notes yet — suggestions and kitchen instructions show up here.
          </p>
        )}
        {messages.map((msg) => {
          const unread = msg.read_at == null && msg.to_member === profile.id;
          return (
            <div
              key={msg.id}
              className={`rounded-none border-2 border-neutral-900 p-4 shadow-[3px_3px_0_#111] ${
                msg.kind === "instruction" ? "bg-orange-200" : "bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-extrabold">
                  {msg.kind === "instruction" ? "👨‍🍳 " : "💡 "}
                  {msg.title}
                  {unread && <span className="ml-2 rounded-full border-2 border-neutral-900 bg-red-300 px-1.5 py-0.5 text-[9px] uppercase">new</span>}
                </p>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  {msg.from_member ? memberName.get(msg.from_member) ?? "Family" : "Family"}
                  {msg.to_member ? ` → ${memberName.get(msg.to_member) ?? "Member"}` : " → everyone"}
                  {" · "}
                  {new Date(msg.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
              <p className="mt-1 text-sm">{msg.body}</p>
              {unread && (
                <form action={markMessageRead} className="mt-2">
                  <input type="hidden" name="id" value={msg.id} />
                  <button className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
                    Mark read
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
