/* eslint-disable @next/next/no-img-element -- Showdown sprites include variable-size PNG and GIF form assets. */
"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

export function PokemonImage({
  src,
  fallbackSrcs = [],
  alt,
  className,
}: {
  src: string;
  fallbackSrcs?: readonly string[];
  alt: string;
  className?: string;
}) {
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const sources = [...new Set([src, ...fallbackSrcs])];
  const currentSource = sources.find((source) => !failedSources.has(source));

  if (!currentSource) {
    return (
      <span
        aria-label={`${alt} image unavailable`}
        className={cn(
          "grid place-items-center rounded-2xl bg-black/[0.04] text-black/25",
          className,
        )}
      >
        <ImageOff aria-hidden="true" className="h-1/3 w-1/3" />
      </span>
    );
  }

  // Pokémon Showdown serves a mix of PNG and GIF sprite assets with intrinsic
  // dimensions that vary per form, so a native image is the right fit here.
  return (
    <img
      src={currentSource}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() =>
        setFailedSources((previous) => {
          const next = new Set(previous);
          next.add(currentSource);
          return next;
        })
      }
      className={cn("object-contain [image-rendering:auto]", className)}
    />
  );
}
