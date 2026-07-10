"use client";

import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";

import { GENERATION_META } from "@/lib/pokemon/generations";
import { GENERATIONS, type Generation } from "@/lib/pokemon/types";

export function GenerationGate({
  onSelect,
}: {
  onSelect: (generation: Generation) => void;
}) {
  return (
    <main className="generation-gate min-h-screen overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1440px] flex-col rounded-[2rem] border border-black/10 bg-[#f7f6f1] shadow-[0_30px_100px_rgba(32,27,22,0.12)] sm:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between border-b border-black/10 px-6 py-5 sm:px-10">
          <Brand />
          <div className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-black/45 sm:flex">
            <Sparkles className="h-4 w-4 text-[#ef5b4c]" />
            Data through Gen IX
          </div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative flex flex-col justify-between overflow-hidden border-b border-black/10 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
            <div className="absolute -left-24 bottom-10 h-72 w-72 rounded-full border-[55px] border-[#ef5b4c]/10" />
            <div className="relative">
              <span className="eyebrow">Start here</span>
              <h1 className="mt-6 max-w-2xl text-[clamp(3rem,7vw,7.4rem)] font-black leading-[0.86] tracking-[-0.065em] text-[#191816]">
                Know your
                <span className="block text-[#ef5b4c]">weak side.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-black/60 sm:text-lg sm:leading-8">
                Build a six-Pokémon squad, choose every legal move, and expose
                the matchup gaps before your opponent does.
              </p>
            </div>

            <div className="relative mt-12 flex items-center gap-4 text-sm text-black/45">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-black/15 font-mono text-xs font-bold">
                01
              </span>
              Pick the ruleset generation to begin
              <ArrowRight className="h-4 w-4" />
            </div>
          </section>

          <section className="flex flex-col p-6 sm:p-10 lg:p-14">
            <div className="flex items-end justify-between gap-6">
              <div>
                <span className="eyebrow">Choose a generation</span>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                  Which era are you building for?
                </h2>
              </div>
              <span className="hidden text-right text-xs leading-5 text-black/40 xl:block">
                Main-series learnsets
                <br />
                combined by generation
              </span>
            </div>

            <div className="mt-8 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {GENERATIONS.map((generation) => {
                const meta = GENERATION_META[generation];
                return (
                  <button
                    key={generation}
                    type="button"
                    onClick={() => onSelect(generation)}
                    className="generation-card group relative min-h-32 overflow-hidden rounded-2xl border border-black/10 bg-white p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-black/25 hover:shadow-[0_14px_35px_rgba(25,24,22,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black sm:min-h-36"
                  >
                    <span
                      className="absolute inset-x-0 top-0 h-1 opacity-80 transition-all group-hover:h-1.5"
                      style={{ backgroundColor: meta.accent }}
                    />
                    <span className="flex items-start justify-between">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-black/35">
                        Gen {meta.roman}
                      </span>
                      <ChevronRight className="h-4 w-4 -translate-x-1 text-black/25 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                    </span>
                    <strong className="mt-5 block text-xl font-black tracking-[-0.035em]">
                      {meta.title}
                    </strong>
                    <span className="mt-1.5 block text-xs leading-5 text-black/45">
                      {meta.games}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`pokeball-mark ${compact ? "h-8 w-8" : "h-9 w-9"}`}
        aria-hidden="true"
      />
      <span className="text-lg font-black tracking-[-0.045em]">
        TYPE<span className="text-[#ef5b4c]">WISE</span>
      </span>
    </div>
  );
}

