"use client";

import { ChevronRight, Plus, Sparkles, Trash2 } from "lucide-react";

import type { TeamSlot } from "@/lib/pokemon/types";
import { cn } from "@/lib/utils";
import { PokemonImage } from "./pokemon-image";
import { TypePill } from "./type-pill";

export function TeamPanel({
  team,
  onEditMoves,
  onRemove,
}: {
  team: TeamSlot[];
  onEditMoves: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <aside
      id="team-board"
      className="w-full min-w-0 max-w-full scroll-mt-20 overflow-hidden rounded-[1.65rem] border border-black/10 bg-[#191816] text-white shadow-[0_22px_70px_rgba(25,24,22,0.16)] lg:sticky lg:top-20"
    >
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
              Your lineup
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.045em]">
              Team board
            </h2>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ef5b4c] font-mono text-xs font-black">
            {team.length}/6
          </span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#ef5b4c] transition-all duration-300"
            style={{ width: `${(team.length / 6) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        {Array.from({ length: 6 }, (_, index) => {
          const slot = team[index];
          if (!slot) return <EmptySlot key={index} index={index} />;

          return (
            <article
              key={slot.pokemon.id}
              className="group rounded-2xl border border-white/10 bg-white/[0.055] p-3 transition hover:border-white/20 hover:bg-white/[0.075]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/90">
                  <span className="absolute left-1.5 top-1 font-mono text-[8px] font-black text-black/25">
                    {index + 1}
                  </span>
                  <PokemonImage
                    src={slot.pokemon.sprite}
                    alt={slot.pokemon.name}
                    className="h-14 w-14"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black tracking-[-0.02em]">
                    {slot.pokemon.name}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {slot.pokemon.types.map((type) => (
                      <TypePill key={type} type={type} small />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${slot.pokemon.name}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/25 opacity-70 transition hover:bg-[#ef5b4c]/20 hover:text-[#ff8a7e] focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onEditMoves(index)}
                className={cn(
                  "mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition",
                  slot.moves.length
                    ? "border-white/10 bg-black/15 hover:border-white/20"
                    : "border-dashed border-[#ef5b4c]/45 bg-[#ef5b4c]/[0.07] hover:bg-[#ef5b4c]/[0.12]",
                )}
              >
                <div className="min-w-0">
                  <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-white/35">
                    Moves · {slot.moves.length}/4
                  </span>
                  {slot.moves.length ? (
                    <span className="mt-1 block truncate text-[11px] font-semibold text-white/70">
                      {slot.moves.map((move) => move.name).join(" · ")}
                    </span>
                  ) : (
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-[#ff8a7e]">
                      <Sparkles className="h-3 w-3" /> Choose legal moves
                    </span>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
              </button>
            </article>
          );
        })}
      </div>

      <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-5 text-white/60">
        Exact-form duplicates are blocked. Move legality is checked against the
        selected generation&apos;s combined learn sources.
      </div>
    </aside>
  );
}

function EmptySlot({ index }: { index: number }) {
  return (
    <div className="flex h-[76px] items-center gap-3 rounded-2xl border border-dashed border-white/10 px-3 text-white/25">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-white/10">
        <Plus className="h-4 w-4" />
      </span>
      <span>
        <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em]">
          Slot {index + 1}
        </span>
        <span className="mt-1 block text-[11px]">Choose from the Pokédex</span>
      </span>
    </div>
  );
}
