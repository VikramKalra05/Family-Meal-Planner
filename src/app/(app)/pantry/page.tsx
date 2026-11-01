import { deletePantryItem, updatePantryItem } from "./actions";
import { AddPantryForm } from "./add-pantry-form";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

interface PantryRow {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  updated_at: string;
}

export default async function PantryPage() {
  await requireFullProfile();
  const supabase = await createClient();

  const { data: pantry } = await supabase
    .from("pantry_items")
    .select("id, name, quantity, unit, updated_at")
    .order("name");
  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("id, name")
    .order("name");
  const options = (ingredients ?? []).map((i) => ({ id: i.id, name: i.name }));
  const rows = (pantry ?? []) as PantryRow[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Household Pantry</h1>
        <p className="text-sm text-neutral-500">
          What the kitchen already has — the planner prefers this stock before shopping.
        </p>
      </div>

      <AddPantryForm ingredients={options} />

      <div className="space-y-2">
        {rows.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-none bg-white p-4 border-2 border-neutral-900 shadow-[4px_4px_0_#111]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                updated {new Date(item.updated_at).toLocaleDateString("en-IN")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <form action={updatePantryItem} className="flex items-center gap-2">
                <input type="hidden" name="id" value={item.id} />
                <input
                  name="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={item.quantity}
                  className="w-24 rounded-none border-2 border-neutral-900 px-3 py-1.5 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none"
                />
                <span className="w-10 text-xs text-neutral-500">{item.unit}</span>
                <button className="rounded-none border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium hover:bg-amber-50">
                  Save
                </button>
              </form>
              <form action={deletePantryItem}>
                <input type="hidden" name="id" value={item.id} />
                <button className="rounded-none px-2 py-1.5 text-sm text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${item.name}`}>
                  ✕
                </button>
              </form>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="rounded-none bg-white p-8 text-center text-sm text-neutral-500 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
            Pantry is empty — add staples like rice, atta, dals and oil above.
          </p>
        )}
      </div>
    </div>
  );
}
