import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { getUser, requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { EditProviderForm } from "./edit-provider-form";

export const instant = false;

export default async function EditProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireFullProfile();
  const user = await getUser();
  if (!user) notFound();

  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("ai_providers")
    .select("id, label, base_url, model, is_default")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!provider) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <BackLink href="/settings" label="Settings" />
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Edit AI provider</h1>
        <p className="text-sm text-neutral-500">
          Change the label, endpoint or model — leave the key blank to keep the stored one.
        </p>
      </div>

      <div className="rounded-none border-2 border-neutral-900 bg-white p-6 shadow-[4px_4px_0_#111]">
        <EditProviderForm provider={provider} />
      </div>

      <p className="text-[11px] text-neutral-400">
        Usage from this provider appears on{" "}
        <Link href="/settings/usage" className="font-medium text-emerald-700 hover:underline">
          the AI usage page
        </Link>
        . Editing the model starts new calls at the new price; old usage rows keep their historical cost.
      </p>
    </div>
  );
}
