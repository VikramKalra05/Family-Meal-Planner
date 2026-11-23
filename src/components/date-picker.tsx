"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { istDateISO } from "@/lib/date";

/**
 * Neobrutalist date picker — the native calendar popup ignores the app's
 * design language and shows a US-style date in the trigger. This one is
 * controlled, posts a hidden ISO value inside a form, and renders its panel
 * in a portal so it is never clipped by a card or by the page grid.
 *
 * Dates are handled in UTC on purpose: every date in this app is a calendar
 * day (IST), never an instant, so local-midnight conversions are wrong.
 */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const PANEL_WIDTH = 288;
const PANEL_HEIGHT = 336;

export type DatePickerFormat = "short" | "long" | "compact";

export interface DatePickerProps {
  /** ISO yyyy-mm-dd. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable day (ISO). */
  min?: string;
  /** Latest selectable day (ISO). */
  max?: string;
  /** Today in IST; used for the shortcut and the today cell. */
  today?: string;
  /** When set, a hidden input with this name is posted with the form. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Accessible label, e.g. "Diary date". */
  label?: string;
  format?: DatePickerFormat;
  allowClear?: boolean;
  /** Applied to the relative root. Use "block w-full" inside forms. */
  className?: string;
  /** Applied to the trigger button. */
  buttonClassName?: string;
}

function parseISO(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string, format: DatePickerFormat): string {
  if (!value) return "Pick a date";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  };
  if (format === "long") opts.weekday = "short";
  if (format !== "compact") opts.year = "numeric";
  return new Intl.DateTimeFormat("en-IN", opts).format(parseISO(value));
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      className="shrink-0"
    >
      <rect x="3" y="5" width="18" height="16" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

const TRIGGER_BASE = "flex items-center gap-1.5";
const DEFAULT_TRIGGER =
  "border-2 border-neutral-900 bg-white px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50";

export function DatePicker({
  value,
  onChange,
  min,
  max,
  today = istDateISO(),
  name,
  required = false,
  disabled = false,
  label = "Date",
  format = "short",
  allowClear = false,
  className = "",
  buttonClassName = "",
}: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = parseISO(value || today);
  const [view, setView] = useState({
    year: selected.getUTCFullYear(),
    month: selected.getUTCMonth(),
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // A fixed panel would detach from its trigger on scroll; closing is the
    // least surprising behaviour and avoids a stale floating panel. Scrolling
    // inside the panel itself (short viewports) must not close it.
    const onViewportChange = (event: Event) => {
      if (
        event.type === "scroll" &&
        event.target instanceof Node &&
        panelRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open]);

  function openPicker() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.right - width),
      Math.max(8, window.innerWidth - width - 8),
    );
    const below = rect.bottom + 8;
    const top =
      below + PANEL_HEIGHT > window.innerHeight - 8
        ? Math.max(8, rect.top - PANEL_HEIGHT - 8)
        : below;
    setPosition({ top, left, width });
    const d = parseISO(value || today);
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
    setOpen(true);
  }

  function toggleOpen() {
    if (open) setOpen(false);
    else openPicker();
  }

  function pick(date: string) {
    onChange(date);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(view.year, view.month + delta, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  function isDisabled(date: string): boolean {
    return Boolean((min && date < min) || (max && date > max));
  }

  const first = new Date(Date.UTC(view.year, view.month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const dayCount = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: dayCount }, (_, i) => i + 1),
  ];
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(first);
  const display = formatDate(value, format);
  const todayDisabled = isDisabled(today);

  return (
    <div ref={rootRef} className={`relative ${className || "inline-block"}`}>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${display}`}
        className={`${TRIGGER_BASE} ${buttonClassName || DEFAULT_TRIGGER}`}
      >
        <CalendarIcon />
        <span className="truncate">{display}</span>
        <span aria-hidden className="text-[8px] leading-none">
          ▼
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`Choose ${label.toLowerCase()}`}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className="z-[70] max-h-[calc(100vh-1rem)] overflow-y-auto border-2 border-neutral-900 bg-white shadow-[5px_5px_0_#111]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-neutral-900 bg-yellow-100 px-2 py-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="flex h-6 w-6 items-center justify-center border-2 border-neutral-900 bg-white text-sm font-extrabold leading-none"
              >
                ‹
              </button>
              <span className="text-[11px] font-extrabold uppercase tracking-wide">{monthLabel}</span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="flex h-6 w-6 items-center justify-center border-2 border-neutral-900 bg-white text-sm font-extrabold leading-none"
              >
                ›
              </button>
            </div>

            <div className="p-2">
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((day, index) => (
                  <span
                    key={`${day}-${index}`}
                    className="flex h-6 items-center justify-center text-[9px] font-extrabold uppercase tracking-wide text-neutral-400"
                  >
                    {day}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-0.5">
                {cells.map((day, index) => {
                  if (day == null) return <span key={`blank-${index}`} />;
                  const date = toISO(new Date(Date.UTC(view.year, view.month, day)));
                  const isSelected = date === value;
                  const isToday = date === today;
                  const blocked = isDisabled(date);
                  return (
                    <button
                      key={date}
                      type="button"
                      disabled={blocked}
                      onClick={() => pick(date)}
                      aria-label={formatDate(date, "long")}
                      aria-current={isSelected ? "date" : undefined}
                      className={`flex h-7 w-full items-center justify-center border-2 text-[11px] font-extrabold tabular-nums transition-colors ${
                        isSelected
                          ? "border-neutral-900 bg-yellow-300"
                          : isToday
                            ? "border-neutral-900 bg-lime-200"
                            : blocked
                              ? "cursor-not-allowed border-transparent text-neutral-300"
                              : "border-transparent text-neutral-700 hover:border-neutral-900 hover:bg-white"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t-2 border-neutral-900 px-2 py-1.5">
              <button
                type="button"
                onClick={() => pick(today)}
                disabled={todayDisabled}
                className="text-[10px] font-extrabold uppercase tracking-wide underline disabled:opacity-40"
              >
                Today
              </button>
              <div className="flex items-center gap-3">
                {allowClear && value && (
                  <button
                    type="button"
                    onClick={() => pick("")}
                    className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-red-600"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
