"use client";

import { ChevronUp, Plus, Trash2 } from "lucide-react";

import type { TeamSlot } from "@/lib/pokemon/types";
import { PokemonImage } from "./pokemon-image";

export function MobileTeamDock({
  team,
  onEditMoves,
  onClear,
}: {
  team: TeamSlot[];
  onEditMoves: (index: number) => void;
  onClear: () => void;
}) {
  if (team.length === 0) return null;

  return (
    <nav
      aria-label="Quick team controls"
      className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-center gap-1 rounded-2xl border border-white/10 bg-[#191816]/95 p-2 text-white shadow-[0_16px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:hidden"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => {
          const slot = team[index];
          return slot ? (
            <button
              key={slot.pokemon.id}
              type="button"
              onClick={() => onEditMoves(index)}
              aria-label={`Edit ${slot.pokemon.name} moves`}
              className="relative grid h-11 min-w-0 basis-0 flex-1 place-items-center overflow-hidden rounded-xl bg-white/95 transition active:scale-95"
            >
              <PokemonImage
                src={slot.pokemon.sprite}
                alt=""
                className="h-10 w-10"
              />
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ef5b4c] px-1 font-mono text-[7px] font-black">
                {slot.moves.length}
              </span>
            </button>
          ) : (
            <span
              key={index}
              className="grid h-11 min-w-0 basis-0 flex-1 place-items-center rounded-xl border border-dashed border-white/10 text-white/20"
            >
              <Plus className="h-3 w-3" />
            </span>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear team"
        className="grid h-11 w-9 shrink-0 place-items-center rounded-xl text-white/45 transition active:bg-white/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() =>
          document
            .getElementById("team-board")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#ef5b4c] px-3 text-[9px] font-black uppercase tracking-[0.08em]"
      >
        Team {team.length}/6
        <ChevronUp className="h-3 w-3" />
      </button>
    </nav>
  );
}
