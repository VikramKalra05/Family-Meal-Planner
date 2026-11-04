export default function OnboardingLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50 p-6" aria-busy="true">
      <div className="w-full max-w-md space-y-6 border-2 border-neutral-900 bg-white p-8 shadow-[4px_4px_0_#111]">
        <div className="space-y-2">
          <div className="h-3 w-20 border border-neutral-300 bg-neutral-100 nb-loading" aria-hidden />
          <div className="h-6 w-3/4 border border-neutral-300 bg-neutral-100 nb-loading" aria-hidden />
          <div className="h-3 w-full border border-neutral-300 bg-neutral-100 nb-loading" aria-hidden />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 border border-neutral-300 bg-neutral-100 nb-loading" aria-hidden />
              <div className="h-10 w-full border-2 border-neutral-900/25 bg-neutral-200 nb-loading" aria-hidden />
            </div>
          ))}
        </div>
        <div className="h-11 w-full border-2 border-neutral-900 bg-emerald-300 nb-loading" aria-hidden />
        <p className="text-center text-[10px] font-extrabold uppercase tracking-widest text-neutral-500" role="status">
          Setting up your profile…
        </p>
      </div>
    </main>
  );
}
