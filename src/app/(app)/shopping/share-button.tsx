"use client";

export function ShareButton({
  items,
  weekStart,
}: {
  items: { name: string; display: string; checked: boolean }[];
  weekStart: string;
}) {
  const unchecked = items.filter((i) => !i.checked);
  const text =
    `🛒 Shopping list — week of ${new Date(weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}\n` +
    unchecked.map((i) => `• ${i.name} — ${i.display}`).join("\n") +
    (unchecked.length === 0 ? "\nAll done ✅" : "");
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-none border-2 border-neutral-900 bg-white px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]"
      title="Send the pending items over WhatsApp"
    >
      📱 WhatsApp
    </a>
  );
}
