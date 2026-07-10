"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";

import type {
  DexCatalogResponse,
  PokemonSummary,
  TeamSlot,
} from "@/lib/pokemon/types";
import { cn, formatNumber, normalizeSearchText } from "@/lib/utils";
import { PokemonImage } from "./pokemon-image";
import { TypePill } from "./type-pill";

const PAGE_SIZE = 60;

export function PokemonCatalog({
  catalog,
  team,
  onAdd,
}: {
  catalog: DexCatalogResponse;
  team: TeamSlot[];
  onAdd: (pokemon: PokemonSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const teamIds = useMemo(
    () => new Set(team.map((slot) => slot.pokemon.id)),
    [team],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    const numericQuery = /^\d+$/.test(normalizedQuery)
      ? Number(normalizedQuery)
      : null;
    return catalog.pokemon.filter((pokemon) => {
      const matchesQuery =
        !normalizedQuery ||
        normalizeSearchText(pokemon.name).includes(normalizedQuery) ||
        normalizeSearchText(pokemon.baseSpecies).includes(normalizedQuery) ||
        pokemon.number === numericQuery;
      const matchesType =
        !typeFilter || pokemon.types.includes(typeFilter);
      return matchesQuery && matchesType;
    });
  }, [catalog.pokemon, query, typeFilter]);

  return (
    <section
      aria-labelledby="catalog-title"
      className="w-full min-w-0 max-w-full overflow-hidden rounded-[1.65rem] border border-black/10 bg-[#faf9f5] shadow-[0_18px_60px_rgba(40,35,28,0.06)]"
    >
      <div className="border-b border-black/10 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="eyebrow">02 · Build your team</span>
            <h2
              id="catalog-title"
              className="mt-2 text-2xl font-black tracking-[-0.045em]"
            >
              Choose your Pokémon
            </h2>
          </div>
          <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 font-mono text-[10px] font-bold text-black/45">
            {formatNumber(catalog.pokemon.length)} available
          </span>
        </div>

        <div className="mt-5 flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search Pokémon by name or Pokédex number</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Search name or #..."
              className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-10 text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-black/30 focus:border-black/30 focus:ring-4 focus:ring-black/[0.04]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-black/30 hover:bg-black/5 hover:text-black"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
        </div>

        <div className="scrollbar-none mt-3 flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setTypeFilter(null);
              setVisibleCount(PAGE_SIZE);
            }}
            className={cn(
              "h-7 shrink-0 rounded-full border px-3 text-[10px] font-bold uppercase tracking-[0.08em] transition",
              typeFilter === null
                ? "border-black bg-black text-white"
                : "border-black/10 bg-white text-black/45 hover:border-black/25",
            )}
            aria-pressed={typeFilter === null}
          >
            All types
          </button>
          {catalog.types.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setTypeFilter(typeFilter === type ? null : type);
                setVisibleCount(PAGE_SIZE);
              }}
              className={cn(
                "shrink-0 rounded-full transition hover:-translate-y-px",
                typeFilter === type && "ring-2 ring-black ring-offset-2",
              )}
              aria-pressed={typeFilter === type}
            >
              <TypePill type={type} />
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div
          aria-live="polite"
          className="mb-3 flex items-center justify-between px-1 text-[11px] font-semibold text-black/55"
        >
          <span>
            Showing {Math.min(visibleCount, filtered.length)} of{" "}
            {formatNumber(filtered.length)} matches
          </span>
          <span>{team.length}/6 on team</span>
        </div>

        {filtered.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.slice(0, visibleCount).map((pokemon) => {
              const added = teamIds.has(pokemon.id);
              const full = team.length >= 6;
              return (
                <article
                  key={pokemon.id}
                  className={cn(
                    "pokemon-card group relative min-w-0 overflow-hidden rounded-2xl border bg-white p-3 transition duration-200",
                    added
                      ? "border-[#ef5b4c]/40 bg-[#fff7f5]"
                      : "border-black/10 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_12px_25px_rgba(30,25,20,0.08)]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold tracking-[0.08em] text-black/30">
                      #{String(pokemon.number).padStart(4, "0")}
                    </span>
                    {pokemon.forme ? (
                      <span className="max-w-[70%] truncate rounded-full bg-black/[0.04] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-black/40">
                        {pokemon.forme}
                      </span>
                    ) : null}
                  </div>

                  <PokemonImage
                    src={pokemon.sprite}
                    alt={pokemon.name}
                    className="mx-auto mt-1 h-20 w-full transition duration-200 group-hover:scale-105 sm:h-24"
                  />

                  <h3 className="truncate text-[13px] font-black tracking-[-0.025em] sm:text-sm">
                    {pokemon.name}
                  </h3>
                  <div className="mt-1.5 flex min-w-0 flex-wrap gap-1">
                    {pokemon.types.map((type) => (
                      <TypePill key={type} type={type} small />
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={added || full}
                    onClick={() => onAdd(pokemon)}
                    aria-label={
                      added
                        ? `${pokemon.name} is already on the team`
                        : `Add ${pokemon.name} to team`
                    }
                    className={cn(
                      "mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.08em] transition",
                      added
                        ? "bg-[#ef5b4c]/10 text-[#c93d31]"
                        : full
                          ? "cursor-not-allowed bg-black/[0.04] text-black/25"
                          : "bg-[#191816] text-white hover:bg-[#ef5b4c]",
                    )}
                  >
                    {added ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> {full ? "Team full" : "Add to team"}
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-8 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-black/[0.04] text-black/30">
                <Search className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-black">No Pokémon found</h3>
              <p className="mt-1 text-sm text-black/45">
                Try another name, number, or type filter.
              </p>
            </div>
          </div>
        )}

        {visibleCount < filtered.length ? (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="mt-3 h-11 w-full rounded-xl border border-black/10 bg-white text-xs font-black uppercase tracking-[0.1em] transition hover:border-black/25 hover:bg-black/[0.02]"
          >
            Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
          </button>
        ) : null}
      </div>
    </section>
  );
}
