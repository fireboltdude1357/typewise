"use client";

import type { Id } from "../../convex/_generated/dataModel";
import {
  AlertCircle,
  ArrowDown,
  Database,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CatalogScope,
  DexCatalogResponse,
  Generation,
  MoveListResponse,
  MoveSummary,
  PokemonSummary,
  TeamSlot,
} from "@/lib/pokemon/types";
import { isCatalogScope, isGeneration } from "@/lib/pokemon/types";
import { AnalysisPanel } from "./analysis-panel";
import { AppHeader } from "./app-header";
import { GenerationGate } from "./generation-gate";
import { MovePicker } from "./move-picker";
import { MobileTeamDock } from "./mobile-team-dock";
import { PokemonCatalog } from "./pokemon-catalog";
import { TeamPanel } from "./team-panel";
import {
  type SavedTeamDocument,
  TeamToolbar,
} from "./team-toolbar";

const LOCAL_DRAFT_KEY = "typewise.team.v1";

type LocalDraft = {
  generation: Generation;
  scope: CatalogScope;
  name: string;
  slots: Array<{ pokemonId: string; moveIds: string[] }>;
};

async function fetchCatalog(
  generation: Generation,
  scope: CatalogScope,
  signal?: AbortSignal,
) {
  const response = await fetch(`/api/dex/${generation}?scope=${scope}`, { signal });
  const body = (await response.json()) as DexCatalogResponse & { error?: string };
  if (!response.ok) throw new Error(body.error || "The Pokédex could not be loaded.");
  return body;
}

async function fetchMoves(
  generation: Generation,
  scope: CatalogScope,
  pokemonId: string,
) {
  const response = await fetch(
    `/api/dex/${generation}/${encodeURIComponent(pokemonId)}/moves?scope=${scope}`,
  );
  const body = (await response.json()) as MoveListResponse & { error?: string };
  if (!response.ok) throw new Error(body.error || "A saved moveset could not be loaded.");
  return body.moves;
}

async function rehydrateDraftSlots(
  generation: Generation,
  scope: CatalogScope,
  catalog: DexCatalogResponse,
  slots: LocalDraft["slots"],
) {
  const pokemonById = new Map(
    catalog.pokemon.map((pokemon) => [pokemon.id, pokemon]),
  );

  const hydrated = await Promise.all(
    slots.slice(0, 6).map(async (slot) => {
      const pokemon = pokemonById.get(slot.pokemonId);
      if (!pokemon) return null;
      if (slot.moveIds.length === 0) return { pokemon, moves: [] } satisfies TeamSlot;

      const legalMoves = await fetchMoves(generation, scope, pokemon.id);
      const movesById = new Map(legalMoves.map((move) => [move.id, move]));
      return {
        pokemon,
        moves: slot.moveIds
          .map((moveId) => movesById.get(moveId))
          .filter((move): move is MoveSummary => move !== undefined)
          .slice(0, 4),
      } satisfies TeamSlot;
    }),
  );

  return hydrated.filter((slot): slot is TeamSlot => slot !== null);
}

export function TeamBuilderApp() {
  const [hydrated, setHydrated] = useState(false);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [scope, setScope] = useState<CatalogScope>("national");
  const [catalog, setCatalog] = useState<DexCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [team, setTeam] = useState<TeamSlot[]>([]);
  const [teamName, setTeamName] = useState("Untitled team");
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [activeSavedTeamId, setActiveSavedTeamId] =
    useState<Id<"savedTeams"> | null>(null);
  const pendingLocalDraft = useRef<LocalDraft | null>(null);
  const requestEpoch = useRef(0);

  /* eslint-disable react-hooks/set-state-in-effect -- Hydrating a browser-only local draft after SSR intentionally updates client state. */
  useEffect(() => {
    try {
      const value = window.localStorage.getItem(LOCAL_DRAFT_KEY);
      if (value) {
        const draft = JSON.parse(value) as Partial<LocalDraft> & {
          team?: TeamSlot[];
        };
        if (
          typeof draft.generation === "number" &&
          isGeneration(draft.generation)
        ) {
          const compactSlots = Array.isArray(draft.slots)
            ? draft.slots
                .filter(
                  (slot) =>
                    slot &&
                    typeof slot.pokemonId === "string" &&
                    Array.isArray(slot.moveIds),
                )
                .map((slot) => ({
                  pokemonId: slot.pokemonId,
                  moveIds: slot.moveIds.filter(
                    (moveId): moveId is string => typeof moveId === "string",
                  ),
                }))
            : Array.isArray(draft.team)
              ? draft.team
                  .filter(
                    (slot) =>
                      slot?.pokemon && typeof slot.pokemon.id === "string",
                  )
                  .map((slot) => ({
                    pokemonId: slot.pokemon.id,
                    moveIds: Array.isArray(slot.moves)
                      ? slot.moves
                          .filter((move) => move && typeof move.id === "string")
                          .map((move) => move.id)
                      : [],
                  }))
              : [];
          pendingLocalDraft.current = {
            generation: draft.generation,
            scope:
              typeof draft.scope === "string" && isCatalogScope(draft.scope)
                ? draft.scope
                : "national",
            name:
              typeof draft.name === "string" && draft.name.trim()
                ? draft.name.slice(0, 80)
                : "Untitled team",
            slots: compactSlots.slice(0, 6),
          };
          setGeneration(draft.generation);
          setScope(pendingLocalDraft.current.scope);
          setTeamName(pendingLocalDraft.current.name);
        }
      }
    } catch {
      window.localStorage.removeItem(LOCAL_DRAFT_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated || generation === null) return;
    if (activeSavedTeamId) return;
    if (pendingLocalDraft.current) return;
    const draft: LocalDraft = {
      generation,
      scope,
      name: teamName,
      slots: team.map((slot) => ({
        pokemonId: slot.pokemon.id,
        moveIds: slot.moves.map((move) => move.id),
      })),
    };
    try {
      window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // A private browser profile or full storage quota should not break the app.
    }
  }, [activeSavedTeamId, generation, hydrated, scope, team, teamName]);

  useEffect(() => {
    if (generation === null) return;
    const controller = new AbortController();
    const requestId = ++requestEpoch.current;
    fetchCatalog(generation, scope, controller.signal)
      .then(async (nextCatalog) => {
        if (
          controller.signal.aborted ||
          requestId !== requestEpoch.current
        ) {
          return;
        }
        const pending = pendingLocalDraft.current;
        if (pending?.generation === generation && pending.scope === scope) {
          const restoredTeam = await rehydrateDraftSlots(
            generation,
            scope,
            nextCatalog,
            pending.slots,
          );
          if (
            controller.signal.aborted ||
            requestId !== requestEpoch.current
          ) {
            return;
          }
          pendingLocalDraft.current = null;
          setTeam(restoredTeam);
        } else {
          setTeam((currentTeam) =>
            currentTeam
              .map((slot) => {
                const currentPokemon = nextCatalog.pokemon.find(
                  (pokemon) => pokemon.id === slot.pokemon.id,
                );
                return currentPokemon
                  ? { ...slot, pokemon: currentPokemon }
                  : null;
              })
              .filter((slot): slot is TeamSlot => slot !== null),
          );
        }
        if (requestId !== requestEpoch.current) return;
        setCatalog(nextCatalog);
      })
      .catch((error) => {
        if (
          requestId !== requestEpoch.current ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        setCatalogError(
          error instanceof Error ? error.message : "The Pokédex could not be loaded.",
        );
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          requestId === requestEpoch.current
        ) {
          setLoadingCatalog(false);
        }
      });

    return () => controller.abort();
  }, [generation, retryKey, scope]);

  const chooseGeneration = useCallback(
    (nextGeneration: Generation) => {
      requestEpoch.current += 1;
      pendingLocalDraft.current = null;
      if (generation !== null && nextGeneration !== generation) {
        setTeam([]);
        setTeamName("Untitled team");
        setActiveSavedTeamId(null);
      }
      setGeneration(nextGeneration);
      setCatalog(null);
      setCatalogError(null);
      setLoadingCatalog(false);
    },
    [generation],
  );

  const changeScope = useCallback(
    (nextScope: CatalogScope) => {
      if (nextScope === scope) return;
      if (
        team.length > 0 &&
        !window.confirm(
          "Changing roster scope clears this lineup because Pokémon and moves may not exist in the new scope. Continue?",
        )
      ) {
        return;
      }
      requestEpoch.current += 1;
      setScope(nextScope);
      setCatalog(null);
      setCatalogError(null);
      setLoadingCatalog(false);
      setTeam([]);
      setActiveSlot(null);
      pendingLocalDraft.current = null;
    },
    [scope, team.length],
  );

  const changeGeneration = useCallback(() => {
    if (
      team.length &&
      !window.confirm(
        "Changing generations clears this local lineup because Pokémon and moves may not be legal in the new ruleset. Continue?",
      )
    ) {
      return;
    }
    requestEpoch.current += 1;
    setGeneration(null);
    setCatalog(null);
    setLoadingCatalog(false);
    setTeam([]);
    setTeamName("Untitled team");
    setActiveSavedTeamId(null);
    pendingLocalDraft.current = null;
    window.localStorage.removeItem(LOCAL_DRAFT_KEY);
  }, [team.length]);

  const resetTeam = useCallback(() => {
    if (!window.confirm("Clear all Pokémon and moves from this draft?")) return;
    requestEpoch.current += 1;
    setLoadingCatalog(false);
    setRetryKey((key) => key + 1);
    setTeam([]);
    setTeamName("Untitled team");
    setActiveSlot(null);
    setActiveSavedTeamId(null);
    pendingLocalDraft.current = null;
  }, []);

  const closeMovePicker = useCallback(() => setActiveSlot(null), []);

  const startNewDraft = useCallback(() => {
    requestEpoch.current += 1;
    setLoadingCatalog(false);
    setRetryKey((key) => key + 1);
    setTeam([]);
    setTeamName("Untitled team");
    setActiveSlot(null);
    setActiveSavedTeamId(null);
    pendingLocalDraft.current = null;
    window.localStorage.removeItem(LOCAL_DRAFT_KEY);
  }, []);

  function addPokemon(pokemon: PokemonSummary) {
    setTeam((currentTeam) => {
      if (
        currentTeam.length >= 6 ||
        currentTeam.some((slot) => slot.pokemon.id === pokemon.id)
      ) {
        return currentTeam;
      }
      return [...currentTeam, { pokemon, moves: [] }];
    });
  }

  function removePokemon(index: number) {
    setTeam((currentTeam) => currentTeam.filter((_, slotIndex) => slotIndex !== index));
    setActiveSlot((current) => {
      if (current === index) return null;
      if (current !== null && current > index) return current - 1;
      return current;
    });
  }

  function setMoves(index: number, moves: MoveSummary[]) {
    setTeam((currentTeam) =>
      currentTeam.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, moves: moves.slice(0, 4) } : slot,
      ),
    );
  }

  async function loadSavedTeam(saved: SavedTeamDocument) {
    const requestId = ++requestEpoch.current;
    const pendingBeforeLoad = pendingLocalDraft.current;
    pendingLocalDraft.current = null;
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const savedScope = saved.scope ?? "national";
      const nextCatalog =
        catalog?.generation === saved.generation && catalog.scope === savedScope
          ? catalog
          : await fetchCatalog(saved.generation, savedScope);
      const nextSlots = await Promise.all(
        saved.slots.slice(0, 6).map(async (compactSlot) => {
          const pokemon = nextCatalog.pokemon.find(
            (candidate) => candidate.id === compactSlot.pokemonId,
          );
          if (!pokemon) return null;
          const availableMoves = await fetchMoves(
            saved.generation,
            savedScope,
            pokemon.id,
          );
          const movesById = new Map(availableMoves.map((move) => [move.id, move]));
          return {
            pokemon,
            moves: compactSlot.moves
              .map((move) => movesById.get(move.moveId))
              .filter((move): move is MoveSummary => move !== undefined)
              .slice(0, 4),
          } satisfies TeamSlot;
        }),
      );
      if (requestId !== requestEpoch.current) return;
      setGeneration(saved.generation);
      setScope(savedScope);
      setCatalog(nextCatalog);
      setTeam(nextSlots.filter((slot): slot is TeamSlot => slot !== null));
      setTeamName(saved.name);
      setActiveSlot(null);
      setActiveSavedTeamId(saved._id);
    } catch (error) {
      if (requestId === requestEpoch.current) {
        pendingLocalDraft.current = pendingBeforeLoad;
        if (!catalog) setRetryKey((key) => key + 1);
      }
      throw error;
    } finally {
      if (requestId === requestEpoch.current) setLoadingCatalog(false);
    }
  }

  if (!hydrated) return <InitialLoader />;
  if (generation === null) return <GenerationGate onSelect={chooseGeneration} />;

  return (
    <div className="min-h-screen bg-[#f4f2ec] text-[#191816]">
      <AppHeader
        generation={generation}
        onChangeGeneration={changeGeneration}
        onReset={resetTeam}
        hasTeam={team.length > 0}
      />

      <main className="mx-auto max-w-[1600px] px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pb-12">
        <section className="mb-8 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#d94a3e]">
              <ShieldCheck className="h-3.5 w-3.5" /> Live team audit
            </div>
            <h1 className="mt-4 max-w-4xl text-[clamp(2.7rem,6vw,6rem)] font-black leading-[0.9] tracking-[-0.065em]">
              Build the matchup.
              <span className="block text-black/25">See the cracks.</span>
            </h1>
          </div>
          <div className="max-w-sm lg:pb-2">
            <p className="text-sm leading-6 text-black/50">
              Search the full legal catalog, lock in four moves per member, then
              inspect every type pressure point.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-black/30">
              Scroll to analysis <ArrowDown className="h-3.5 w-3.5" />
            </div>
          </div>
        </section>

        <TeamToolbar
          name={teamName}
          onNameChange={setTeamName}
          generation={generation}
          scope={scope}
          team={team}
          activeSavedTeamId={activeSavedTeamId}
          onActiveSavedTeamIdChange={setActiveSavedTeamId}
          onLoad={loadSavedTeam}
          onNewDraft={startNewDraft}
        />

        {catalogError ? (
          <CatalogError
            message={catalogError}
            onRetry={() => {
              setCatalogError(null);
              setCatalog(null);
              setRetryKey((key) => key + 1);
            }}
          />
        ) : loadingCatalog || !catalog ? (
          <WorkspaceLoader />
        ) : (
          <>
            <ScopeSelector value={scope} onChange={changeScope} />
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-black/[0.07] bg-white/45 px-3 py-2.5 text-[11px] leading-5 text-black/60">
              <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {catalog.scopeNote}
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
              <PokemonCatalog catalog={catalog} team={team} onAdd={addPokemon} />
              <TeamPanel
                team={team}
                onEditMoves={setActiveSlot}
                onRemove={removePokemon}
              />
            </div>

            <div className="mt-6">
              <AnalysisPanel catalog={catalog} team={team} />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-black/10 px-5 py-8 text-center text-[10px] leading-5 text-black/35">
        Pokémon data derived from Pokémon Showdown under MIT-compatible data
        tooling. Sprites served by Pokémon Showdown with PokéAPI fallbacks.
        Pokémon and all related names are trademarks of Nintendo, Game Freak,
        and The Pokémon Company.
      </footer>

      <MobileTeamDock
        team={team}
        onEditMoves={setActiveSlot}
        onClear={resetTeam}
      />

      {activeSlot !== null && team[activeSlot] ? (
        <MovePicker
          generation={generation}
          scope={scope}
          slot={team[activeSlot]}
          onChange={(moves) => setMoves(activeSlot, moves)}
          onClose={closeMovePicker}
        />
      ) : null}
    </div>
  );
}

function ScopeSelector({
  value,
  onChange,
}: {
  value: CatalogScope;
  onChange: (scope: CatalogScope) => void;
}) {
  return (
    <section className="mb-3 flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/65 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="px-1">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-black/35">
          Roster scope
        </span>
        <p className="mt-1 text-xs font-semibold text-black/60">
          {value === "national"
            ? "Every official species and mechanically distinct form introduced through this generation."
            : "Only Pokémon usable in at least one core title from this generation."}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Roster scope"
        className="grid grid-cols-2 rounded-xl bg-black/[0.045] p-1"
      >
        {([
          ["national", "All Pokémon"],
          ["core", "Core games"],
        ] as const).map(([scopeValue, label]) => (
          <label
            key={scopeValue}
            className={`relative grid h-9 cursor-pointer place-items-center rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.08em] transition focus-within:ring-2 focus-within:ring-[#ef5b4c]/60 ${
              value === scopeValue
                ? "bg-[#191816] text-white shadow-sm"
                : "text-black/45 hover:bg-white/70 hover:text-black"
            }`}
          >
            <input
              type="radio"
              name="roster-scope"
              value={scopeValue}
              checked={value === scopeValue}
              onChange={() => onChange(scopeValue)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <span aria-hidden="true">{label}</span>
            <span className="sr-only">{label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function InitialLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f2ec]">
      <span className="pokeball-mark h-11 w-11 animate-[spin_1.8s_linear_infinite]" />
    </div>
  );
}

function WorkspaceLoader() {
  return (
    <div role="status" aria-live="polite" className="grid min-h-[550px] place-items-center rounded-[1.65rem] border border-black/10 bg-white/50">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#ef5b4c]" />
        <h2 className="mt-4 text-sm font-black">Opening the generation dex</h2>
        <p className="mt-1 text-xs text-black/40">Loading Pokémon, forms, and the historical type chart…</p>
      </div>
    </div>
  );
}

function CatalogError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="grid min-h-[480px] place-items-center rounded-[1.65rem] border border-[#ef5b4c]/20 bg-[#fff1ee] p-8 text-center">
      <div className="max-w-md">
        <AlertCircle className="mx-auto h-8 w-8 text-[#ef5b4c]" />
        <h2 className="mt-4 text-xl font-black">The Pokédex did not open</h2>
        <p className="mt-2 text-sm leading-6 text-black/50">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-xs font-black text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    </div>
  );
}
