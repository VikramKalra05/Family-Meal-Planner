"use client";

import { useState } from "react";

/**
 * Exercise demo image with a two-step fallback: CDN → GitHub raw → local
 * placeholder. Client-side because the error handler needs state; the detail
 * page is a server component and cannot attach one directly.
 */
export function ExerciseImage({
  src,
  fallback,
  alt,
  className,
}: {
  src: string;
  fallback?: string | null;
  alt: string;
  className?: string;
}) {
  const [current, setCurrent] = useState(src);
  const [triedFallback, setTriedFallback] = useState(false);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => {
        if (!triedFallback && fallback) {
          setTriedFallback(true);
          setCurrent(fallback);
        } else {
          setCurrent("/gym-equipment/placeholder.svg");
        }
      }}
    />
  );
}
