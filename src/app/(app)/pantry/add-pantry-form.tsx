"use client";

import { useActionState, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { WorkingBar } from "@/components/ai-working";
import { addPantryItem } from "./actions";

interface SimpleOption {
  id: string;
  name: string;
}

const input =
  "rounded-none border-2 border-neutral-900 bg-white px-3 py-2.5 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none";
const primary =
  "rounded-none bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-50";

export function AddPantryForm({ ingredients }: { ingredients: SimpleOption[] }) {
  const [state, action, pending] = useActionState(addPantryItem, { error: null, ok: null });
  const [picked, setPicked] = useState<{ id: string | null; name: string } | null>(null);

  const options: ComboboxOption[] = ingredients.map((i) => ({
    id: i.id,
    label: i.name,
  }));

  function handleSubmit(fd: FormData) {
    if (!picked?.name.trim()) return;
    fd.set("name", picked.name.trim());
    fd.set("ingredient_id", picked.id ?? "");
    action(fd);
  }

  return (
    <form
      key={state.ok ?? "new"}
      action={handleSubmit}
      aria-busy={pending}
      className="flex flex-wrap items-end gap-2 rounded-none bg-white p-4 border-2 border-neutral-900 shadow-[4px_4px_0_#111]"
    >
      <div className="min-w-64 flex-[2]">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500" htmlFor="pantry-item">
          What&apos;s in the kitchen?
        </label>
        <div id="pantry-item">
          <Combobox
            options={options}
            value={picked?.id ?? null}
            onSelect={(id) => {
              const opt = options.find((o) => o.id === id);
              setPicked({ id, name: opt?.label ?? "" });
            }}
            onCreate={(name) => setPicked({ id: null, name })}
            createMacros={false}
            createLabel="Add"
            placeholder="Search staples or type your own…"
          />
        </div>
        {picked && !picked.id && (
          <p className="mt-1 text-[10px] text-neutral-400">
            Custom item: <span className="font-medium text-neutral-600">{picked.name}</span>
          </p>
        )}
      </div>

      <input type="hidden" name="name" value={picked?.name ?? ""} />
      <input type="hidden" name="ingredient_id" value={picked?.id ?? ""} />

      <div className="w-24">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500" htmlFor="quantity">
          Qty
        </label>
        <input
          id="quantity" name="quantity" type="number" min="0" step="0.01" required
          key={`qty-${state.ok}`}
          defaultValue="1"
          className={`${input} w-full`}
        />
      </div>
      <div className="w-24">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500" htmlFor="unit">
          Unit
        </label>
        <select id="unit" name="unit" className={`${input} w-full`} defaultValue="kg">
          <option value="g">g</option>
          <option value="kg">kg</option>
          <option value="ml">ml</option>
          <option value="l">l</option>
          <option value="piece">piece</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending || !picked?.name.trim()}
        className={`${primary} ${pending ? "nb-loading cursor-wait" : ""}`}
      >
        {pending ? "◌ Adding…" : "Add to pantry"}
      </button>

      {pending && (
        <div className="w-full">
          <WorkingBar label="Saving to pantry…" />
        </div>
      )}

      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
