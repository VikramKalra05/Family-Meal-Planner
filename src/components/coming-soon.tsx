export function ComingSoon({
  title,
  milestone,
  description,
}: {
  title: string;
  milestone: string;
  description: string;
}) {
  return (
    <div className="rounded-none bg-white p-8 text-center border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{description}</p>
      <span className="mt-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        Shipping in {milestone}
      </span>
    </div>
  );
}
