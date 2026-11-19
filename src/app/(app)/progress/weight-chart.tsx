"use client";

import { useMemo, useRef, useState } from "react";
import {
  WEIGHT_RANGES,
  filterWeightRange,
  movingAverage,
  niceTicks,
  weightStats,
  type WeightPoint,
  type WeightRange,
} from "@/lib/weight";

const W = 720;
const H = 280;
const PAD = { l: 44, r: 16, t: 18, b: 32 };

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(
    new Date(iso),
  );

const fullLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

/**
 * Interactive weight chart: date-proportional x-axis, hover/touch tooltip,
 * a 7-day average line, and a data-first y-domain so the target can't flatten
 * the real trend (it becomes an edge annotation instead).
 */
export function WeightChart({
  points,
  targetKg,
  today,
}: {
  points: WeightPoint[];
  targetKg: number | null;
  today: string;
}) {
  const [range, setRange] = useState<WeightRange>("30d");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const visible = useMemo(() => filterWeightRange(points, range, today), [points, range, today]);
  const avg = useMemo(() => movingAverage(visible, 7), [visible]);
  const stats = useMemo(() => weightStats(visible), [visible]);

  const geom = useMemo(() => {
    if (visible.length < 2) return null;
    const values = visible.map((p) => p.kg);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const padding = Math.max(0.35, (dataMax - dataMin) * 0.18);
    const min = dataMin - padding;
    const max = dataMax + padding;
    const span = Math.max(0.5, max - min);

    const t0 = Date.parse(visible[0].date);
    const t1 = Date.parse(visible[visible.length - 1].date);
    const tSpan = Math.max(86400000, t1 - t0);

    const xs = visible.map((p) => PAD.l + ((Date.parse(p.date) - t0) / tSpan) * (W - PAD.l - PAD.r));
    const ys = visible.map((p) => PAD.t + (1 - (p.kg - min) / span) * (H - PAD.t - PAD.b));
    const avgYs = avg.map((p) => PAD.t + (1 - (p.kg - min) / span) * (H - PAD.t - PAD.b));
    const yTicks = niceTicks(min, max, 5);

    const tickCount = Math.min(4, visible.length);
    const tickIdx = [
      ...new Set(
        Array.from({ length: tickCount }, (_, i) =>
          Math.round((i / Math.max(1, tickCount - 1)) * (visible.length - 1)),
        ),
      ),
    ];

    return { min, max, span, xs, ys, avgYs, yTicks, tickIdx };
  }, [visible, avg]);

  function onPointer(e: React.PointerEvent<SVGSVGElement>) {
    if (!geom) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < geom.xs.length; i += 1) {
      const dist = Math.abs(geom.xs[i] - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setHover(best);
  }

  const hovered = hover != null && hover < visible.length ? visible[hover] : null;
  const hoveredPrev = hover != null && hover > 0 ? visible[hover - 1] : null;

  return (
    <div>
      {/* Range switch + legend */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex border-2 border-neutral-900 bg-white shadow-[2px_2px_0_#111]">
          {WEIGHT_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRange(r.key);
                setHover(null);
              }}
              aria-pressed={range === r.key}
              className={`px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide transition-colors ${
                range === r.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-amber-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-5 bg-emerald-600" /> weight
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-sky-600" /> 7-day avg
          </span>
          {targetKg != null && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-amber-500" /> target
            </span>
          )}
        </div>
      </div>

      {points.length === 0 ? (
        <p className="rounded-none border-2 border-dashed border-neutral-900 px-4 py-10 text-center text-sm text-neutral-400">
          Log your first weigh-in to start the chart.
        </p>
      ) : !geom ? (
        <div className="rounded-none border-2 border-dashed border-neutral-900 px-4 py-10 text-center">
          <p className="text-sm text-neutral-400">
            Not enough logs in the last {range === "all" ? "period" : range.replace("d", " days")}.
          </p>
          {range !== "all" && (
            <button
              type="button"
              onClick={() => setRange("all")}
              className="mt-2 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 underline"
            >
              Show all {points.length} logs
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full touch-pan-y select-none"
              role="img"
              aria-label="Weight trend"
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id="wg-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal grid + y labels */}
              {geom.yTicks.map((tick) => {
                const y = PAD.t + (1 - (tick - geom.min) / geom.span) * (H - PAD.t - PAD.b);
                return (
                  <g key={tick}>
                    <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#e5e5e5" strokeWidth="1" />
                    <text x={PAD.l - 8} y={y + 3} textAnchor="end" className="fill-neutral-400 text-[10px] font-bold">
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Target inside the domain → dashed line; outside → edge note */}
              {targetKg != null &&
                (targetKg >= geom.min && targetKg <= geom.max ? (
                  <>
                    <line
                      x1={PAD.l}
                      x2={W - PAD.r}
                      y1={PAD.t + (1 - (targetKg - geom.min) / geom.span) * (H - PAD.t - PAD.b)}
                      y2={PAD.t + (1 - (targetKg - geom.min) / geom.span) * (H - PAD.t - PAD.b)}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="6 5"
                    />
                    <text
                      x={W - PAD.r}
                      y={PAD.t + (1 - (targetKg - geom.min) / geom.span) * (H - PAD.t - PAD.b) - 5}
                      textAnchor="end"
                      className="fill-amber-600 text-[10px] font-bold"
                    >
                      target {targetKg} kg
                    </text>
                  </>
                ) : (
                  <text
                    x={W - PAD.r}
                    y={targetKg < geom.min ? H - PAD.b - 5 : PAD.t + 10}
                    textAnchor="end"
                    className="fill-amber-600 text-[10px] font-bold"
                  >
                    {targetKg < geom.min ? "↓" : "↑"} target {targetKg} kg
                  </text>
                ))}

              {/* Area + raw line */}
              <polygon
                points={`${PAD.l},${H - PAD.b} ${geom.xs.map((x, i) => `${x},${geom.ys[i]}`).join(" ")} ${geom.xs[geom.xs.length - 1]},${H - PAD.b}`}
                fill="url(#wg-fill)"
              />
              <polyline
                points={geom.xs.map((x, i) => `${x},${geom.ys[i]}`).join(" ")}
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* 7-day average */}
              <polyline
                points={geom.xs.map((x, i) => `${x},${geom.avgYs[i]}`).join(" ")}
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                strokeLinejoin="round"
              />

              {/* Hover crosshair */}
              {hover != null && geom && (
                <line
                  x1={geom.xs[hover]}
                  x2={geom.xs[hover]}
                  y1={PAD.t}
                  y2={H - PAD.b}
                  stroke="#171717"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}

              {/* Points (focusable for keyboard use) */}
              {visible.map((p, i) => (
                <circle
                  key={p.date}
                  cx={geom.xs[i]}
                  cy={geom.ys[i]}
                  r={hover === i ? 5.5 : 3}
                  fill="#059669"
                  stroke="#fff"
                  strokeWidth={hover === i ? 2 : 1}
                  tabIndex={0}
                  role="img"
                  aria-label={`${fullLabel(p.date)}: ${p.kg} kg`}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  style={{ outline: "none" }}
                />
              ))}

              {/* x-axis date ticks */}
              {geom.tickIdx.map((i) => (
                <text
                  key={visible[i].date}
                  x={geom.xs[i]}
                  y={H - 8}
                  textAnchor={i === 0 ? "start" : i === visible.length - 1 ? "end" : "middle"}
                  className="fill-neutral-400 text-[10px] font-bold"
                >
                  {dayLabel(visible[i].date)}
                </text>
              ))}
            </svg>

            {hovered && hover != null && (
              <div
                className="pointer-events-none absolute z-10 w-max max-w-[190px] border-2 border-neutral-900 bg-white px-2 py-1.5 shadow-[3px_3px_0_#111]"
                style={{
                  left: `${Math.min(86, Math.max(14, (geom.xs[hover] / W) * 100))}%`,
                  top: `${(geom.ys[hover] / H) * 100}%`,
                  transform: "translate(-50%, -118%)",
                }}
              >
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
                  {fullLabel(hovered.date)}
                </p>
                <p className="text-sm font-extrabold text-neutral-900">
                  {hovered.kg} kg
                  {hoveredPrev && (
                    <span
                      className={`ml-1.5 text-[10px] font-bold ${
                        hovered.kg <= hoveredPrev.kg ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {signed(Math.round((hovered.kg - hoveredPrev.kg) * 10) / 10)} kg
                    </span>
                  )}
                </p>
                <p className="text-[10px] font-semibold text-sky-700">7-day avg {avg[hover]?.kg ?? hovered.kg} kg</p>
              </div>
            )}
          </div>

          {stats && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: `Since ${dayLabel(visible[0].date)}`, value: `${signed(stats.delta)} kg` },
                {
                  label: "Last 7 days",
                  value: stats.last7Delta == null ? "—" : `${signed(stats.last7Delta)} kg`,
                },
                { label: "Lowest", value: `${stats.min} kg` },
                { label: "Highest", value: `${stats.max} kg` },
              ].map((s) => (
                <div key={s.label} className="border-2 border-neutral-900 bg-white px-2.5 py-1.5 shadow-[2px_2px_0_#111]">
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">{s.label}</p>
                  <p className="text-sm font-extrabold text-neutral-900">{s.value}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-neutral-400">
            Hover or tap the line · {visible.length} of {points.length} logs shown · gaps are missed weigh-ins, not
            straight-line averages.
          </p>
        </>
      )}
    </div>
  );
}
