"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button wired to the enclosing form's server-action status.
 * Prevents double submits and swaps in honest "working" copy while the
 * request is in flight — the button is the only feedback on many forms.
 */
export function SubmitButton({
  children,
  pendingText,
  className = "",
  pendingClassName = "",
  disabled = false,
  title,
  ariaLabel,
}: {
  children: ReactNode;
  pendingText?: ReactNode;
  className?: string;
  pendingClassName?: string;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      aria-disabled={disabled || pending || undefined}
      aria-label={ariaLabel}
      title={title}
      className={`${className} ${pending ? `cursor-wait nb-loading ${pendingClassName}` : ""}`}
    >
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
