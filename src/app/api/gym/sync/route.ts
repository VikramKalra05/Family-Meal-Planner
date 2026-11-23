import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRate } from "@/lib/rate-limit";

/**
 * Batch endpoint for the offline queue. The client writes to IndexedDB first
 * and flushes here when it can. Every mutation is idempotent by client-
 * generated UUID, so a retry after a dropped response is safe.
 *
 * Deliberately not a server action: service-worker background sync cannot
 * call React server actions, and a plain POST is easier to reason about.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const plateSchema = z.object({
  label: z.string().min(1).max(20),
  qty: z.number().int().min(1).max(20),
});

const setPayload = z.object({
  session_id: z.string().uuid(),
  exercise_key: z.string().min(1).max(120),
  set_index: z.number().int().min(-50).max(50),
  weight_kg: z.number().min(0).max(1000),
  display_weight: z.number().min(0).max(2200).nullable().optional(),
  display_unit: z.enum(["kg", "lb"]).default("kg"),
  plates: z.array(plateSchema).max(20).nullable().optional(),
  stack_position: z.number().int().min(0).max(100).nullable().optional(),
  reps: z.number().int().min(0).max(100),
  rpe: z.number().min(1).max(10).nullable().optional(),
  is_warmup: z.boolean().default(false),
  is_pr: z.boolean().default(false),
  notes: z.string().max(300).nullable().optional(),
  client_updated_at: z.string().max(40).optional(),
});

const sessionPayload = z.object({
  program_day_id: z.string().uuid().nullable().optional(),
  session_date: isoDate,
  status: z.enum(["in_progress", "completed", "skipped"]).default("in_progress"),
  notes: z.string().max(1000).nullable().optional(),
  ended_at: z.string().max(40).nullable().optional(),
  client_updated_at: z.string().max(40).optional(),
});

const mutation = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("set_upsert"), id: z.string().uuid(), data: setPayload }),
  z.object({
    kind: z.literal("set_delete"),
    id: z.string().uuid(),
    data: z.object({ client_updated_at: z.string().max(40).optional() }).optional(),
  }),
  z.object({ kind: z.literal("session_upsert"), id: z.string().uuid(), data: sessionPayload }),
  z.object({
    kind: z.literal("session_complete"),
    id: z.string().uuid(),
    data: z.object({ ended_at: z.string().max(40).optional() }),
  }),
]);

const bodySchema = z.object({
  mutations: z.array(mutation).min(1).max(200),
});

interface Result {
  id: string;
  ok: boolean;
  error?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const userId = user.id;

  if (!checkRate(`gym-sync:${userId}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many sync requests" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid batch" }, { status: 400 });
  }

  const ownedSessions = new Map<string, boolean>();
  async function ownsSession(sessionId: string): Promise<boolean> {
    const cached = ownedSessions.get(sessionId);
    if (cached != null) return cached;
    const { data } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("member_id", userId)
      .maybeSingle();
    const owns = Boolean(data);
    ownedSessions.set(sessionId, owns);
    return owns;
  }

  const ownedProgramDays = new Map<string, boolean>();
  async function ownsProgramDay(dayId: string): Promise<boolean> {
    const cached = ownedProgramDays.get(dayId);
    if (cached != null) return cached;
    const { data } = await supabase
      .from("program_days")
      .select("id, programs!inner(member_id)")
      .eq("id", dayId)
      .eq("programs.member_id", userId)
      .maybeSingle();
    const owns = Boolean(data);
    ownedProgramDays.set(dayId, owns);
    return owns;
  }

  function isStale(existing: string | null | undefined, incoming: string | undefined): boolean {
    if (!existing || !incoming) return false;
    const existingTs = Date.parse(existing);
    const incomingTs = Date.parse(incoming);
    return Number.isFinite(existingTs) && Number.isFinite(incomingTs) && existingTs > incomingTs;
  }

  const results: Result[] = [];

  for (const m of parsed.data.mutations) {
    try {
      if (m.kind === "set_upsert") {
        if (!(await ownsSession(m.data.session_id))) {
          results.push({ id: m.id, ok: false, error: "Unknown session" });
          continue;
        }
        // Last-write-wins with timestamps: a stale queued set must not
        // overwrite a newer edit or resurrect a newer delete.
        const { data: existing } = await supabase
          .from("set_logs")
          .select("client_updated_at")
          .eq("id", m.id)
          .eq("member_id", userId)
          .maybeSingle();
        if (existing && isStale(existing.client_updated_at, m.data.client_updated_at)) {
          results.push({ id: m.id, ok: true });
          continue;
        }
        const { error } = await supabase.from("set_logs").upsert(
          {
            id: m.id,
            session_id: m.data.session_id,
            member_id: userId,
            exercise_key: m.data.exercise_key,
            set_index: m.data.set_index,
            weight_kg: m.data.weight_kg,
            display_weight: m.data.display_weight ?? m.data.weight_kg,
            display_unit: m.data.display_unit,
            plates: m.data.plates ?? null,
            stack_position: m.data.stack_position ?? null,
            reps: m.data.reps,
            rpe: m.data.rpe ?? null,
            is_warmup: m.data.is_warmup,
            is_pr: m.data.is_pr,
            notes: m.data.notes ?? null,
            client_updated_at: m.data.client_updated_at ?? new Date().toISOString(),
            deleted_at: null,
          },
          { onConflict: "id" },
        );
        results.push(error ? { id: m.id, ok: false, error: error.message } : { id: m.id, ok: true });
      } else if (m.kind === "set_delete") {
        const { data: existing } = await supabase
          .from("set_logs")
          .select("client_updated_at")
          .eq("id", m.id)
          .eq("member_id", userId)
          .maybeSingle();
        if (existing && isStale(existing.client_updated_at, m.data?.client_updated_at)) {
          results.push({ id: m.id, ok: true });
          continue;
        }
        const { error } = await supabase
          .from("set_logs")
          .update({
            deleted_at: new Date().toISOString(),
            client_updated_at: m.data?.client_updated_at ?? new Date().toISOString(),
          })
          .eq("id", m.id)
          .eq("member_id", userId);
        results.push(error ? { id: m.id, ok: false, error: error.message } : { id: m.id, ok: true });
      } else if (m.kind === "session_upsert") {
        if (m.data.program_day_id && !(await ownsProgramDay(m.data.program_day_id))) {
          results.push({ id: m.id, ok: false, error: "Unknown program day" });
          continue;
        }
        const { data: existing } = await supabase
          .from("workout_sessions")
          .select("client_updated_at")
          .eq("id", m.id)
          .eq("member_id", userId)
          .maybeSingle();
        if (existing && isStale(existing.client_updated_at, m.data.client_updated_at)) {
          results.push({ id: m.id, ok: true });
          continue;
        }
        // One live session per member/day, even from an offline queue.
        const { data: sameDay } = await supabase
          .from("workout_sessions")
          .select("id")
          .eq("member_id", userId)
          .eq("session_date", m.data.session_date)
          .neq("id", m.id)
          .neq("status", "skipped")
          .maybeSingle();
        if (sameDay) {
          results.push({ id: m.id, ok: false, error: "Another session already exists for that day" });
          continue;
        }
        const { error } = await supabase.from("workout_sessions").upsert(
          {
            id: m.id,
            member_id: userId,
            program_day_id: m.data.program_day_id ?? null,
            session_date: m.data.session_date,
            status: m.data.status,
            notes: m.data.notes ?? null,
            ended_at: m.data.ended_at ?? null,
            client_updated_at: m.data.client_updated_at ?? new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        results.push(error ? { id: m.id, ok: false, error: error.message } : { id: m.id, ok: true });
      } else {
        const { error } = await supabase
          .from("workout_sessions")
          .update({
            status: "completed",
            ended_at: m.data.ended_at ?? new Date().toISOString(),
            client_updated_at: new Date().toISOString(),
          })
          .eq("id", m.id)
          .eq("member_id", userId);
        results.push(error ? { id: m.id, ok: false, error: error.message } : { id: m.id, ok: true });
      }
    } catch (err) {
      results.push({ id: m.id, ok: false, error: err instanceof Error ? err.message : "Sync failed" });
    }
  }

  return NextResponse.json({ results, server_time: new Date().toISOString() });
}
