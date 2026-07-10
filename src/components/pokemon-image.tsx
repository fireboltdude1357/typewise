/* eslint-disable @next/next/no-img-element -- Showdown sprites include variable-size PNG and GIF form assets. */
"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

export function PokemonImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
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
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("object-contain [image-rendering:auto]", className)}
    />
  );
}
