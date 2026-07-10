"use client";

import { ChevronDown, RotateCcw } from "lucide-react";

import { GENERATION_META } from "@/lib/pokemon/generations";
import type { Generation } from "@/lib/pokemon/types";
import { AuthControls } from "./auth-controls";
import { Brand } from "./generation-gate";

export function AppHeader({
  generation,
  onChangeGeneration,
  onReset,
  hasTeam,
}: {
  generation: Generation;
  onChangeGeneration: () => void;
  onReset: () => void;
  hasTeam: boolean;
}) {
  const meta = GENERATION_META[generation];

  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f4f2ec]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Brand compact />

        <div className="flex items-center gap-2">
          {hasTeam ? (
            <button
              type="button"
              onClick={onReset}
              className="hidden h-9 items-center gap-2 rounded-full px-3 text-xs font-bold text-black/45 transition hover:bg-black/5 hover:text-black sm:inline-flex"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear team
            </button>
          ) : null}
          <button
            type="button"
            onClick={onChangeGeneration}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-xs font-bold shadow-sm transition hover:border-black/25"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: meta.accent }}
            />
            Gen {meta.roman}
            <span className="hidden text-black/40 md:inline">· {meta.title}</span>
            <ChevronDown className="h-3.5 w-3.5 text-black/40" />
          </button>
          <AuthControls />
        </div>
      </div>
    </header>
  );
}

