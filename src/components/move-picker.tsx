"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import type {
  Generation,
  LearnMethod,
  MoveListResponse,
  MoveSummary,
  TeamSlot,
} from "@/lib/pokemon/types";
import { moveSlotGroup, toggleMoveSelection } from "@/lib/pokemon/team";
import { cn, normalizeSearchText } from "@/lib/utils";
import { PokemonImage } from "./pokemon-image";
import { TypePill } from "./type-pill";

const moveCache = new Map<string, MoveListResponse>();
const METHODS: LearnMethod[] = [
  "Level up",
  "TM / HM / TR",
  "Tutor",
  "Egg",
  "Event",
  "Transfer",
  "Special",
  "Virtual Console",
  "Let's Go transfer",
];

export function MovePicker({
  generation,
  slot,
  onChange,
  onClose,
}: {
  generation: Generation;
  slot: TeamSlot;
  onChange: (moves: MoveSummary[]) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<MoveListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const dialogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const cacheKey = `${generation}:${slot.pokemon.id}`;
      const cached = moveCache.get(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/dex/${generation}/${encodeURIComponent(slot.pokemon.id)}/moves`,
          { signal },
        );
        const body = (await response.json()) as MoveListResponse & { error?: string };
        if (!response.ok) {
          throw new Error(body.error || "The move list could not be loaded.");
        }
        moveCache.set(cacheKey, body);
        setData(body);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The move list could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    },
    [generation, slot.pokemon.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      if (window.matchMedia("(min-width: 640px)").matches) {
        searchRef.current?.focus();
      } else {
        closeRef.current?.focus();
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const selectedIds = useMemo(
    () => new Set(slot.moves.map((move) => move.id)),
    [slot.moves],
  );
  const moveTypes = useMemo(
    () => [...new Set(data?.moves.map((move) => move.type) ?? [])].sort(),
    [data],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return (data?.moves ?? []).filter((move) => {
      return (
        (!normalizedQuery ||
          normalizeSearchText(move.name).includes(normalizedQuery) ||
          normalizeSearchText(move.description).includes(normalizedQuery)) &&
        (typeFilter === "All" || move.type === typeFilter) &&
        (categoryFilter === "All" || move.category === categoryFilter) &&
        (methodFilter === "All" ||
          move.methods.includes(methodFilter as LearnMethod))
      );
    });
  }, [data, query, typeFilter, categoryFilter, methodFilter]);

  function toggleMove(move: MoveSummary) {
    onChange(toggleMoveSelection(slot.moves, move));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#191816]/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-picker-title"
        className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[1.75rem] bg-[#f7f6f1] shadow-2xl sm:max-h-[90vh] sm:rounded-[1.75rem] lg:grid lg:grid-cols-[310px_1fr]"
      >
        <aside className="border-b border-black/10 bg-[#191816] p-5 text-white sm:p-6 lg:border-b-0 lg:border-r lg:border-white/10">
          <div className="flex items-start justify-between lg:block">
            <div className="flex items-center gap-4 lg:block">
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/95 lg:h-32 lg:w-full">
                <PokemonImage
                  src={slot.pokemon.sprite}
                  alt={slot.pokemon.name}
                  className="h-20 w-20 lg:h-28 lg:w-28"
                />
              </span>
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
                  Configure moves
                </span>
                <h2
                  id="move-picker-title"
                  className="mt-1 text-xl font-black tracking-[-0.04em] lg:mt-4 lg:text-2xl"
                >
                  {slot.pokemon.name}
                </h2>
                <div className="mt-2 flex gap-1">
                  {slot.pokemon.types.map((type) => (
                    <TypePill key={type} type={type} small />
                  ))}
                </div>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close move picker"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/15 hover:text-white lg:absolute lg:right-7 lg:top-7 lg:z-10 lg:bg-black/5 lg:text-black/50 lg:hover:bg-black/10 lg:hover:text-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 hidden lg:block">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
                Selected moves
              </span>
              <span className="font-mono text-[10px] font-bold text-[#ff8a7e]">
                {slot.moves.length}/4
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {Array.from({ length: 4 }, (_, index) => {
                const move = slot.moves[index];
                return move ? (
                  <button
                    key={move.id}
                    type="button"
                    onClick={() => toggleMove(move)}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-left transition hover:border-[#ff8a7e]/40 hover:bg-[#ef5b4c]/10"
                  >
                    <TypePill type={move.type} small />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold">
                      {move.name}
                    </span>
                    <X className="h-3 w-3 text-white/30" />
                  </button>
                ) : (
                  <div
                    key={index}
                    className="flex h-10 items-center rounded-xl border border-dashed border-white/10 px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-white/20"
                  >
                    Empty move slot
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 hidden rounded-xl border border-white/10 bg-white/[0.045] p-3 text-[11px] leading-5 text-white/60 lg:block">
            <span className="mb-1 flex items-center gap-1.5 font-bold text-white/65">
              <ShieldCheck className="h-3.5 w-3.5 text-[#ff8a7e]" />
              Legality scope
            </span>
            {data?.scopeNote ??
              "Move sources are checked against the selected generation."}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-black/10 p-4 pr-14 sm:p-6 sm:pr-16">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="eyebrow">All legal moves</span>
                <h3 className="mt-1 text-lg font-black tracking-[-0.035em]">
                  Find the right coverage
                </h3>
              </div>
              {data ? (
                <span className="font-mono text-[10px] font-bold text-black/35">
                  {data.moves.length} moves
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <label className="relative">
                <span className="sr-only">Search moves</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search moves or effects..."
                  className="h-10 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-xs font-semibold outline-none transition placeholder:font-normal placeholder:text-black/30 focus:border-black/30"
                />
              </label>
              <FilterSelect
                label="Type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={["All", ...moveTypes]}
              />
              <FilterSelect
                label="Category"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={["All", "Physical", "Special", "Status"]}
              />
              <FilterSelect
                label="Method"
                value={methodFilter}
                onChange={setMethodFilter}
                options={["All", ...METHODS]}
              />
            </div>

            {slot.moves.length ? (
              <div className="scrollbar-none mt-3 flex items-center gap-2 overflow-x-auto lg:hidden">
                <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.1em] text-black/50">
                  Selected {slot.moves.length}/4
                </span>
                {slot.moves.map((move) => (
                  <button
                    key={move.id}
                    type="button"
                    onClick={() => toggleMove(move)}
                    aria-label={`Remove ${move.name}`}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#ef5b4c]/25 bg-[#fff1ee] pl-1 pr-2 text-[10px] font-bold"
                  >
                    <TypePill type={move.type} small />
                    {move.name}
                    <X className="h-3 w-3 text-[#c83d32]" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <div role="status" aria-live="polite" className="grid min-h-80 place-items-center text-center">
                <div>
                  <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-[#ef5b4c]" />
                  <p className="mt-3 text-xs font-bold text-black/45">
                    Checking every learn source…
                  </p>
                </div>
              </div>
            ) : error ? (
              <div role="alert" className="grid min-h-80 place-items-center text-center">
                <div className="max-w-sm">
                  <AlertCircle className="mx-auto h-7 w-7 text-[#ef5b4c]" />
                  <h4 className="mt-3 font-black">Moves could not be loaded</h4>
                  <p className="mt-1 text-sm text-black/45">{error}</p>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="mt-4 rounded-full bg-black px-4 py-2 text-xs font-bold text-white"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : filtered.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {filtered.map((move) => {
                  const selected = selectedIds.has(move.id);
                  const replacesVariant = slot.moves.some(
                    (candidate) =>
                      moveSlotGroup(candidate.id) === moveSlotGroup(move.id),
                  );
                  const disabled =
                    !selected && slot.moves.length >= 4 && !replacesVariant;
                  return (
                    <button
                      key={move.id}
                      type="button"
                      onClick={() => toggleMove(move)}
                      disabled={disabled}
                      aria-pressed={selected}
                      className={cn(
                        "group min-w-0 rounded-2xl border p-3 text-left transition",
                        selected
                          ? "border-[#ef5b4c]/50 bg-[#fff1ee] shadow-[inset_0_0_0_1px_rgba(239,91,76,0.08)]"
                          : disabled
                            ? "cursor-not-allowed border-black/[0.06] bg-black/[0.015] opacity-45"
                            : "border-black/10 bg-white hover:-translate-y-px hover:border-black/25 hover:shadow-sm",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <TypePill type={move.type} small />
                        <strong className="min-w-0 flex-1 truncate text-xs font-black">
                          {move.name}
                        </strong>
                        <span
                          className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition",
                            selected
                              ? "border-[#ef5b4c] bg-[#ef5b4c] text-white"
                              : "border-black/15 text-transparent group-hover:border-black/30",
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.06em] text-black/55">
                        <span>{move.category}</span>
                        <span className="text-black/15">·</span>
                        <span>Power {move.power ?? "—"}</span>
                        <span className="text-black/15">·</span>
                        <span>
                          Acc {move.alwaysHits ? "Always" : (move.accuracy ?? "—")}
                        </span>
                        {move.priority ? (
                          <>
                            <span className="text-black/15">·</span>
                            <span>Priority {move.priority > 0 ? "+" : ""}{move.priority}</span>
                          </>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-black/60">
                        {move.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {move.methods.slice(0, 3).map((method) => (
                          <span
                            key={method}
                            className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[9px] font-bold text-black/55"
                          >
                            {method}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center text-center">
                <div>
                  <Sparkles className="mx-auto h-6 w-6 text-black/25" />
                  <h4 className="mt-3 font-black">No moves match</h4>
                  <p className="mt-1 text-xs text-black/40">
                    Clear a filter or try a broader search.
                  </p>
                </div>
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-black/10 bg-white/60 px-4 py-3 sm:px-6">
            <span aria-live="polite" className="text-[10px] font-semibold text-black/55">
              {filtered.length} shown · {slot.moves.length} of 4 selected
            </span>
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-full bg-[#191816] px-5 text-xs font-black text-white transition hover:bg-[#ef5b4c]"
            >
              Close
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">Filter by {label.toLowerCase()}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-black/10 bg-white pl-3 pr-8 text-[10px] font-bold outline-none transition focus:border-black/30 sm:w-auto sm:min-w-28"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "All" ? `${label}: All` : option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/30" />
    </label>
  );
}
