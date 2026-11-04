import { BackLink } from "@/components/back-link";
import { requireFullProfile } from "@/lib/profile";
import { ReelFlow } from "./reel-flow";

export const instant = false;

export default async function FromReelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireFullProfile();
  const params = await searchParams;
  // PWA share target drops the shared reel here (url and/or text).
  const sharedUrl = typeof params.url === "string" ? params.url : "";
  const sharedText = typeof params.text === "string" ? params.text : "";
  const initialUrl = sharedUrl || sharedText;

  return (
    <div className="space-y-5 mx-auto max-w-2xl">
      <div>
        <BackLink href="/recipes" label="Recipes" />
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Add from a reel or video</h1>
        <p className="text-sm text-neutral-500">
          Paste a link — the AI drafts the recipe, you review and save it with computed nutrition.
        </p>
      </div>
      <ReelFlow initialUrl={initialUrl} />
    </div>
  );
}
