"use client";

import type { WeightPoint } from "@/lib/weight";

/** Minimal dependency-free SVG line chart with a dashed target line. */
export function WeightChart({ points, targetKg }: { points: WeightPoint[]; targetKg: number | null }) {
  if (points.length < 2) {
    return (
      <p className="rounded-none border-2 border-dashed border-neutral-900 px-4 py-10 text-center text-sm text-neutral-400">
        Log at least two days to see your trend line.
      </p>
    );
  }

  const W = 640;
  const H = 240;
  const PAD = { l: 8, r: 8, t: 14, b: 20 };

  const values = points.map((p) => p.kg).concat(targetKg != null ? [targetKg] : []);
  const min = Math.min(...values) - 0.8;
  const max = Math.max(...values) + 0.8;
  const span = Math.max(1, max - min);

  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (kg: number) => PAD.t + (1 - (kg - min) / span) * (H - PAD.t - PAD.b);

  const line = points.map((p, i) => `${x(i)},${y(p.kg)}`).join(" ");
  const area = `${PAD.l},${H - PAD.b} ${line} ${x(points.length - 1)},${H - PAD.b}`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weight trend">
      <defs>
        <linearGradient id="wg-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {targetKg != null && (
        <>
          <line
            x1={PAD.l} x2={W - PAD.r} y1={y(targetKg)} y2={y(targetKg)}
            stroke="#d97706" strokeWidth="1.5" strokeDasharray="6 5"
          />
          <text x={W - PAD.r} y={y(targetKg) - 6} textAnchor="end" className="fill-amber-600 text-[11px] font-semibold">
            target {targetKg} kg
          </text>
        </>
      )}

      <polygon points={area} fill="url(#wg-fill)" />
      <polyline points={line} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.kg)} r={i === points.length - 1 ? 4.5 : 2.5} fill="#059669" stroke="#fff" strokeWidth={i === points.length - 1 ? 2 : 0} />
      ))}
      <text x={x(points.length - 1)} y={y(last.kg) - 10} textAnchor="end" className="fill-neutral-900 text-[12px] font-bold">
        {last.kg} kg
      </text>
      <text x={PAD.l} y={H - 4} className="fill-neutral-400 text-[10px]">
        {points[0].date}
      </text>
      <text x={W - PAD.r} y={H - 4} textAnchor="end" className="fill-neutral-400 text-[10px]">
        {last.date}
      </text>
    </svg>
  );
}
