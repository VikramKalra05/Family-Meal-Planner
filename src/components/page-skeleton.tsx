/**
 * Neobrutalist loading skeletons. One component, a few shapes — route-level
 * `loading.tsx` files use these so a slow server render always has visible,
 * layout-stable feedback instead of a blank screen.
 */

type SkeletonVariant =
  | "default"
  | "week"
  | "cards"
  | "detail"
  | "list"
  | "settings"
  | "chart"
  | "kitchen";

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`border-2 border-neutral-900/25 bg-neutral-200 nb-loading ${className}`}
    />
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111] ${className}`}
    >
      {children}
    </div>
  );
}

function Heading({ width = "w-52" }: { width?: string }) {
  return (
    <div className="space-y-2">
      <Block className={`h-7 ${width}`} />
      <Block className="h-4 w-80 max-w-full" />
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i}>
          <Block className="h-4 w-24" />
          <Block className="mt-3 h-8 w-32" />
          <Block className="mt-4 h-3 w-full" />
          <Block className="mt-2 h-3 w-2/3" />
        </Card>
      ))}
    </div>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="p-0">
      <div className="border-b-2 border-neutral-900 bg-yellow-300 px-4 py-3">
        <Block className="h-4 w-40" />
      </div>
      <div className="divide-y-2 divide-dashed divide-neutral-200">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="flex-1 space-y-2">
              <Block className="h-4 w-1/3" />
              <Block className="h-3 w-1/5" />
            </div>
            <Block className="h-8 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function WeekSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-[120px_repeat(7,minmax(90px,1fr))] border-b-2 border-neutral-900 bg-yellow-300">
        <div className="border-r-2 border-neutral-900 p-3">
          <Block className="h-4 w-14" />
        </div>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="border-r-2 border-neutral-900 p-3 last:border-r-0">
            <Block className="mx-auto h-4 w-16" />
          </div>
        ))}
      </div>
      {Array.from({ length: 4 }, (_, row) => (
        <div
          key={row}
          className="grid grid-cols-[120px_repeat(7,minmax(90px,1fr))] border-b-2 border-dashed border-neutral-200 last:border-b-0"
        >
          <div className="border-r-2 border-neutral-900 bg-neutral-50 p-3">
            <Block className="h-3 w-16" />
          </div>
          {Array.from({ length: 7 }, (_, col) => (
            <div key={col} className="border-r-2 border-dashed border-neutral-200 p-3 last:border-r-0">
              <Block className="h-3 w-20" />
              <Block className="mt-2 h-3 w-12" />
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Block className="h-4 w-24" />
      <Heading width="w-64" />
      <div className="flex gap-2">
        <Block className="h-8 w-20 rounded-full" />
        <Block className="h-8 w-24 rounded-full" />
      </div>
      <Block className="h-56 w-full" />
      <div className="grid grid-cols-2 gap-3 border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111] md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i}>
            <Block className="h-3 w-14" />
            <Block className="mt-2 h-5 w-16" />
          </div>
        ))}
      </div>
      <Card>
        <Block className="h-4 w-40" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} className="h-3 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i}>
            <Block className="h-4 w-24" />
            <Block className="mt-3 h-6 w-36" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }, (_, j) => (
                <Block key={j} className="h-3 w-full" />
              ))}
            </div>
          </Card>
        ))}
      </div>
      <ListSkeleton rows={3} />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <Block className="h-3 w-16" />
            <Block className="mt-3 h-8 w-24" />
            <Block className="mt-3 h-2 w-full" />
          </Card>
        ))}
      </div>
      <Card>
        <Block className="h-4 w-40" />
        <Block className="mt-4 h-48 w-full" />
      </Card>
    </div>
  );
}

function KitchenSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="p-0">
          <div className="border-b-2 border-neutral-900 bg-orange-200 px-4 py-3">
            <Block className="h-4 w-28" />
          </div>
          <div className="space-y-3 p-4">
            <Block className="h-3 w-16" />
            <Block className="h-5 w-3/4" />
            {Array.from({ length: 4 }, (_, j) => (
              <Block key={j} className="h-3 w-full" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function PageSkeleton({
  variant = "default",
  label = "Loading…",
}: {
  variant?: SkeletonVariant;
  label?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="mx-auto w-full max-w-6xl space-y-5"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-3 w-3 border-2 border-neutral-900 bg-emerald-400 nb-blink" />
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          {label}
        </span>
        <span className="h-2 flex-1 border-2 border-neutral-900 bg-white nb-loading" aria-hidden />
      </div>

      {variant === "week" && (
        <>
          <Heading />
          <WeekSkeleton />
        </>
      )}
      {variant === "cards" && (
        <>
          <Heading />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="border-2 border-neutral-900 bg-white shadow-[4px_4px_0_#111]">
                <Block className="aspect-[5/4] w-full" />
                <div className="space-y-2 p-3">
                  <Block className="h-4 w-3/4" />
                  <Block className="h-3 w-1/2" />
                  <Block className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {variant === "detail" && <DetailSkeleton />}
      {variant === "list" && (
        <>
          <Heading />
          <ListSkeleton />
        </>
      )}
      {variant === "settings" && (
        <>
          <Heading />
          <SettingsSkeleton />
        </>
      )}
      {variant === "chart" && (
        <>
          <Heading />
          <ChartSkeleton />
        </>
      )}
      {variant === "kitchen" && (
        <>
          <Heading />
          <KitchenSkeleton />
        </>
      )}
      {variant === "default" && (
        <>
          <Heading />
          <CardsSkeleton />
        </>
      )}
    </div>
  );
}
