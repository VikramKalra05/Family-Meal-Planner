import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import { sendToMemberSubs, vapidConfigured } from "@/lib/push-send";

/** Lets the member verify their device actually receives pushes. */
export async function POST() {
  if (!vapidConfigured()) {
    return NextResponse.json(
      { error: "Push is not configured on this server (missing VAPID keys)." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!checkRate(`push-test:${user.id}`, 3, 5 * 60_000)) {
    return NextResponse.json({ error: rateLimited(3, 5 * 60_000) }, { status: 429 });
  }

  try {
    const result = await sendToMemberSubs(supabase, user.id, {
      title: "Test push 🔔",
      body: "Background reminders are working. You can close the app now.",
      url: "/",
      tag: "push-test",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
