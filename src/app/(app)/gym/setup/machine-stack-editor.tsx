"use client";

import { GYM_EQUIPMENT, type GymEquipment } from "@/data/gym-equipment";
import type { MachineStack, WeightUnit } from "@/lib/gym/types";

const input =
  "mt-1 w-full rounded-none border-2 border-neutral-900 bg-white px-2 py-1.5 text-xs focus:shadow-[2px_2px_0_#111] focus:outline-none";

const round1 = (n: number) => Math.round(n * 10) / 10;
const toDisplay = (kg: number, unit: WeightUnit) =>
  round1(unit === "lb" ? kg / 0.45359237 : kg);
const toKg = (value: number, unit: WeightUnit) =>
  Math.round((unit === "lb" ? value * 0.45359237 : value) * 100) / 100;

function stackMachines(equipmentIds: string[]): GymEquipment[] {
  return equipmentIds
    .map((id) => GYM_EQUIPMENT.find((e) => e.id === id))
    .filter(
      (e): e is GymEquipment =>
        e !== undefined && (e.category === "machines" || e.category === "cables"),
    );
}

function defaultStack(equipment: GymEquipment, unit: WeightUnit): MachineStack {
  const bottom = unit === "lb" ? 10 : 5;
  const top = unit === "lb" ? 100 : 50;
  return {
    equipmentId: equipment.id,
    label: equipment.name,
    positionCount: 12,
    calibration: [
      { position: 1, kg: toKg(bottom, unit) },
      { position: 12, kg: toKg(top, unit) },
    ],
  };
}

/**
 * Optional calibration for unlabelled machine/cable stacks. The stored
 * calibration is always in kg; the inputs follow the gym's display unit.
 */
export function MachineStackEditor({
  unit,
  equipmentIds,
  stacks,
  onChange,
}: {
  unit: WeightUnit;
  equipmentIds: string[];
  stacks: MachineStack[];
  onChange: (stacks: MachineStack[]) => void;
}) {
  const machines = stackMachines(equipmentIds);
  if (machines.length === 0) {
    return (
      <p className="mt-2 border-2 border-dashed border-neutral-300 px-3 py-3 text-center text-[11px] text-neutral-400">
        Select a machine or cable in step 1 to calibrate its weight stack.
      </p>
    );
  }

  const byId = new Map(stacks.map((s) => [s.equipmentId, s]));

  function toggle(equipment: GymEquipment, on: boolean) {
    if (on) {
      onChange([
        ...stacks.filter((s) => s.equipmentId !== equipment.id),
        defaultStack(equipment, unit),
      ]);
    } else {
      onChange(stacks.filter((s) => s.equipmentId !== equipment.id));
    }
  }

  function update(
    equipmentId: string,
    mutate: (stack: MachineStack) => MachineStack,
  ) {
    onChange(stacks.map((s) => (s.equipmentId === equipmentId ? mutate(s) : s)));
  }

  function setPoint(stack: MachineStack, which: "bottom" | "top", value: number) {
    const points = [...stack.calibration].sort((a, b) => a.position - b.position);
    const bottom = points[0]?.kg ?? 0;
    const top = points[points.length - 1]?.kg ?? 0;
    const nextBottom = which === "bottom" ? toKg(value, unit) : bottom;
    const nextTop = which === "top" ? toKg(value, unit) : top;
    update(stack.equipmentId, (s) => ({
      ...s,
      calibration: [
        { position: 1, kg: nextBottom },
        { position: s.positionCount, kg: nextTop },
      ],
    }));
  }

  return (
    <div className="mt-3 space-y-2">
      {machines.map((equipment) => {
        const stack = byId.get(equipment.id);
        const points = stack ? [...stack.calibration].sort((a, b) => a.position - b.position) : [];
        const bottom = points[0]?.kg ?? 0;
        const top = points[points.length - 1]?.kg ?? 0;
        return (
          <div key={equipment.id} className="border-2 border-neutral-900 bg-amber-50 p-2.5">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(stack)}
                onChange={(e) => toggle(equipment, e.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
              <span className="text-xs font-extrabold">{equipment.name}</span>
              {stack && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  calibrated
                </span>
              )}
            </label>

            {stack && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                  Pin positions
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={stack.positionCount}
                    onChange={(e) => {
                      const positionCount = Math.max(2, Math.min(60, Number(e.target.value) || 2));
                      const bottom = points[0]?.kg ?? 0;
                      const top = points[points.length - 1]?.kg ?? 0;
                      update(equipment.id, (s) => ({
                        ...s,
                        positionCount,
                        calibration: [
                          { position: 1, kg: bottom },
                          { position: positionCount, kg: top },
                        ],
                      }));
                    }}
                    className={input}
                  />
                </label>
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                  Bottom ({unit})
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={toDisplay(bottom, unit)}
                    onChange={(e) => setPoint(stack, "bottom", Number(e.target.value) || 0)}
                    className={input}
                  />
                </label>
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                  Top ({unit})
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={toDisplay(top, unit)}
                    onChange={(e) => setPoint(stack, "top", Number(e.target.value) || 0)}
                    className={input}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[10px] text-neutral-400">
        Pin positions are the holes in the stack. The workout calculator interpolates between the
        bottom and top weight, then records the pin position with the set.
      </p>
    </div>
  );
}
