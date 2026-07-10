"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleGauge,
  Crosshair,
  Info,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
} from "lucide-react";

import {
  analyzeTeam,
  type SelectedMove,
  type TeamPokemon,
  type UtilityRole,
  type UtilityTarget,
} from "@/lib/analysis";
import type { DexCatalogResponse, MoveSummary, TeamSlot } from "@/lib/pokemon/types";
import { cn } from "@/lib/utils";
import { TypePill } from "./type-pill";

const RECOVERY_MOVES = new Set([
  "recover",
  "roost",
  "slackoff",
  "softboiled",
  "milkdrink",
  "moonlight",
  "morningsun",
  "synthesis",
  "shoreup",
  "strengthsap",
  "wish",
  "rest",
  "lifedew",
  "junglehealing",
  "healorder",
  "lunarblessing",
]);
const REMOVAL_MOVES = new Set(["rapidspin", "defog", "mortalspin", "tidyup"]);
const SPEED_MOVES = new Set([
  "tailwind",
  "trickroom",
  "stickyweb",
  "thunderwave",
  "glare",
  "nuzzle",
  "icywind",
  "electroweb",
  "bulldoze",
  "rocktomb",
  "scaryface",
]);
const HAZARD_MOVES = new Set([
  "stealthrock",
  "spikes",
  "toxicspikes",
  "stickyweb",
  "stoneaxe",
  "ceaselessedge",
]);
const PIVOT_MOVES = new Set([
  "uturn",
  "voltswitch",
  "flipturn",
  "partingshot",
  "teleport",
  "chillyreception",
]);

function utilityRoles(move: MoveSummary, generation: number): UtilityRole[] {
  const roles: UtilityRole[] = [];
  if (RECOVERY_MOVES.has(move.id)) roles.push("recovery");
  if (
    REMOVAL_MOVES.has(move.id) &&
    (move.id !== "defog" || generation >= 6)
  ) {
    roles.push("hazard-removal");
  }
  if (SPEED_MOVES.has(move.id)) roles.push("speed-control");
  if (HAZARD_MOVES.has(move.id)) roles.push("hazard-setting");
  if (
    PIVOT_MOVES.has(move.id) &&
    (move.id !== "teleport" || generation >= 8)
  ) {
    roles.push("pivoting");
  }
  if (move.priority > 0 && move.category !== "Status") roles.push("priority");
  return roles;
}

function toAnalysisMove(move: MoveSummary, generation: number): SelectedMove {
  return {
    id: move.id,
    name: move.name,
    type: move.type,
    category: move.category.toLowerCase() as SelectedMove["category"],
    power: move.power,
    accuracy: move.accuracy,
    priority: move.priority,
    utilityRoles: utilityRoles(move, generation),
    matchupMode: move.matchupMode,
    secondaryEffectivenessType: move.secondaryEffectivenessType,
    effectivenessOverrides: move.effectivenessOverrides,
  };
}

function toAnalysisTeam(team: TeamSlot[], generation: number): TeamPokemon[] {
  return team.map((slot) => ({
    id: slot.pokemon.id,
    name: slot.pokemon.name,
    types: slot.pokemon.types as [string] | [string, string],
    moves: slot.moves.map((move) => toAnalysisMove(move, generation)),
  }));
}

function utilityTargets(generation: number): UtilityTarget[] {
  return [
    {
      role: "recovery",
      label: "Reliable recovery",
      description: "No selected move is tagged as reliable recovery.",
    },
    ...(generation >= 2
      ? [
          {
            role: "hazard-removal",
            label: "Hazard removal",
            description: "No selected move removes entry hazards from your side.",
          } satisfies UtilityTarget,
        ]
      : []),
    {
      role: "speed-control",
      label: "Speed control",
      description: "No selected move is tagged as speed control.",
    },
  ];
}

type AnalysisTab = "overview" | "defense" | "offense" | "breakers";

export function AnalysisPanel({
  catalog,
  team,
}: {
  catalog: DexCatalogResponse;
  team: TeamSlot[];
}) {
  const [tab, setTab] = useState<AnalysisTab>("overview");
  const analysis = useMemo(
    () =>
      analyzeTeam(
        toAnalysisTeam(team, catalog.generation),
        {
          generation: catalog.generation,
          types: catalog.types,
          multipliers: catalog.typeChart,
        },
        {
          utilityTargets: utilityTargets(catalog.generation),
          defensiveTypeCombinations: [
            ...new Map(
              catalog.pokemon.map((pokemon) => [
                [...pokemon.types].sort().join("/"),
                [...pokemon.types].sort() as [string] | [string, string],
              ]),
            ).values(),
          ],
        },
      ),
    [catalog, team],
  );

  if (team.length === 0) {
    return (
      <section className="analysis-shell relative overflow-hidden rounded-[1.8rem] border border-black/10 bg-[#e9e4d8] p-7 sm:p-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[45px] border-black/[0.035]" />
        <span className="eyebrow">03 · Analyze the matchup</span>
        <div className="relative mt-8 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <h2 className="max-w-2xl text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-5xl">
              Your report builds as the team does.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-black/50">
              Add your first Pokémon to reveal shared weaknesses, offensive
              blind spots, missing roles, and the type combinations most likely
              to break through.
            </p>
          </div>
          <div className="hidden grid-cols-3 gap-2 lg:grid">
            {[
              { icon: ShieldAlert, label: "Weaknesses" },
              { icon: Crosshair, label: "Coverage" },
              { icon: Swords, label: "Breakers" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="grid h-28 w-28 place-items-center rounded-2xl border border-black/10 bg-white/55 text-center"
              >
                <span>
                  <Icon className="mx-auto h-5 w-5 text-[#ef5b4c]" />
                  <span className="mt-2 block text-[9px] font-black uppercase tracking-[0.12em] text-black/40">
                    {label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const selectedMoves = team.reduce((total, slot) => total + slot.moves.length, 0);
  const possibleMoves = team.length * 4;
  const coveragePercent = Math.round(
    (analysis.offense.coveredTypes.length / catalog.types.length) * 100,
  );
  const sharedWeaknesses = analysis.defense.sharedWeaknesses;
  const biggestThreat = sharedWeaknesses[0];

  return (
    <section
      aria-labelledby="analysis-title"
      className="overflow-hidden rounded-[1.8rem] border border-black/10 bg-[#faf9f5] shadow-[0_22px_70px_rgba(40,35,28,0.07)]"
    >
      <header className="border-b border-black/10 bg-[#e9e4d8] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <span className="eyebrow">03 · Matchup report</span>
            <h2
              id="analysis-title"
              className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl"
            >
              Here&apos;s where the team bends.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/50">
              Live analysis of {team.length} member{team.length === 1 ? "" : "s"} and{" "}
              {selectedMoves} selected move{selectedMoves === 1 ? "" : "s"} under{" "}
              {catalog.generationLabel} mechanics.
            </p>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 lg:w-auto">
            <Metric
              icon={ShieldAlert}
              value={sharedWeaknesses.length}
              label="shared risks"
              danger={sharedWeaknesses.length > 2}
            />
            <Metric
              icon={CircleGauge}
              value={`${coveragePercent}%`}
              label="type coverage"
            />
            <Metric
              icon={Sparkles}
              value={`${selectedMoves}/${possibleMoves}`}
              label="moves chosen"
            />
          </div>
        </div>

        <nav
          role="tablist"
          className="scrollbar-none mt-7 flex gap-1 overflow-x-auto rounded-xl bg-black/[0.045] p-1"
          aria-label="Analysis sections"
        >
          {([
            ["overview", "Overview"],
            ["defense", "Defense map"],
            ["offense", "Coverage gaps"],
            ["breakers", "Team breakers"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              id={`analysis-tab-${value}`}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls="analysis-tabpanel"
              onClick={() => setTab(value)}
              className={cn(
                "h-9 shrink-0 rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.1em] transition sm:flex-1",
                tab === value
                  ? "bg-[#191816] text-white shadow-sm"
                  : "text-black/40 hover:bg-white/50 hover:text-black/70",
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div
        id="analysis-tabpanel"
        role="tabpanel"
        aria-labelledby={`analysis-tab-${tab}`}
        className="p-4 sm:p-6 lg:p-8"
      >
        {tab === "overview" ? (
          <Overview
            biggestThreat={biggestThreat}
            sharedWeaknesses={sharedWeaknesses}
            coveragePercent={coveragePercent}
            coverageGaps={analysis.offense.gapTypes}
            insights={analysis.gaps.insights}
            teamSize={team.length}
          />
        ) : null}
        {tab === "defense" ? (
          <DefenseMap reports={analysis.defense.byAttackType} />
        ) : null}
        {tab === "offense" ? (
          <OffenseMap
            covered={analysis.offense.coveredTypes}
            gaps={analysis.offense.gapTypes}
            moveTypes={analysis.offense.damagingMoveTypes}
          />
        ) : null}
        {tab === "breakers" ? (
          <Breakers
            attacking={analysis.breakers.attackingTypes}
            defensive={analysis.breakers.defensiveTypeCombinations}
          />
        ) : null}

        <div className="mt-6 flex gap-2 rounded-xl border border-black/[0.07] bg-black/[0.025] p-3 text-[11px] leading-5 text-black/60">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Type-level analysis only. Abilities, items, stats, EVs, weather,
          Terastallization, move order, and format-specific clauses can change a
          real matchup.
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  danger = false,
}: {
  icon: typeof Shield;
  value: string | number;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/10 bg-white/65 p-2.5 sm:min-w-28 sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <strong className={cn("text-lg font-black tracking-[-0.04em] sm:text-xl", danger && "text-[#d64639]")}>
          {value}
        </strong>
        <Icon className={cn("h-4 w-4 text-black/25", danger && "text-[#ef5b4c]")} />
      </div>
      <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.06em] text-black/55">
        {label}
      </span>
    </div>
  );
}

type SharedWeakness = ReturnType<typeof analyzeTeam>["defense"]["sharedWeaknesses"][number];

function Overview({
  biggestThreat,
  sharedWeaknesses,
  coveragePercent,
  coverageGaps,
  insights,
  teamSize,
}: {
  biggestThreat: SharedWeakness | undefined;
  sharedWeaknesses: readonly SharedWeakness[];
  coveragePercent: number;
  coverageGaps: readonly string[];
  insights: ReturnType<typeof analyzeTeam>["gaps"]["insights"];
  teamSize: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Top defensive concern</span>
          <ShieldAlert className="h-4 w-4 text-[#ef5b4c]" />
        </div>
        {biggestThreat ? (
          <>
            <div className="mt-5 flex items-center gap-3">
              <TypePill type={biggestThreat.attackType} />
              <strong className="text-2xl font-black tracking-[-0.04em]">
                {biggestThreat.weak.count}/{teamSize} weak
              </strong>
            </div>
            <p className="mt-3 text-sm leading-6 text-black/50">
              {biggestThreat.weak.memberNames.join(", ")} take super-effective{" "}
              {biggestThreat.attackType}-type damage. You have{" "}
              {biggestThreat.resist.count + biggestThreat.immune.count} safe
              type-based switch
              {biggestThreat.resist.count + biggestThreat.immune.count === 1 ? "" : "es"}.
            </p>
          </>
        ) : (
          <div className="mt-5 flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#3b9362]" />
            <div>
              <strong className="text-sm font-black">No shared weakness yet</strong>
              <p className="mt-1 text-xs leading-5 text-black/45">
                No attacking type hits two current members super effectively.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-1.5">
          {sharedWeaknesses.slice(0, 8).map((report) => (
            <span key={report.attackType} className="inline-flex items-center gap-1 rounded-full bg-[#fff1ee] pr-2">
              <TypePill type={report.attackType} small />
              <span className="text-[9px] font-black text-[#b6382e]">×{report.weak.count}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-[#191816] p-5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
            Offensive reach
          </span>
          <Crosshair className="h-4 w-4 text-[#ff8a7e]" />
        </div>
        <div className="mt-5 flex items-end justify-between gap-4">
          <strong className="text-4xl font-black tracking-[-0.06em]">
            {coveragePercent}%
          </strong>
          <span className="text-right text-[10px] leading-4 text-white/35">
            mono-types hit
            <br />
            super effectively
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#ef5b4c]"
            style={{ width: `${coveragePercent}%` }}
          />
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">
          Blind spots
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {coverageGaps.map((type) => (
            <TypePill key={type} type={type} small />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 lg:col-span-2">
        <span className="eyebrow">Action list</span>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {insights.length ? (
            insights.slice(0, 8).map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))
          ) : (
            <p className="text-sm text-black/45">No immediate set gaps found.</p>
          )}
          {insights.length > 8 ? (
            <details className="rounded-xl border border-black/[0.07] bg-black/[0.018] p-3 md:col-span-2">
              <summary className="cursor-pointer text-xs font-black">
                Show {insights.length - 8} more recommendations
              </summary>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {insights.slice(8).map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  insight,
}: {
  insight: ReturnType<typeof analyzeTeam>["gaps"]["insights"][number];
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-black/[0.07] bg-black/[0.018] p-3">
      <span
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
          insight.severity === "warning"
            ? "bg-[#ef5b4c]/10 text-[#d64639]"
            : "bg-black/5 text-black/45",
        )}
      >
        {insight.severity === "warning" ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <ArrowUpRight className="h-3 w-3" />
        )}
      </span>
      <div>
        <h4 className="text-xs font-black">{insight.title}</h4>
        <p className="mt-1 text-[11px] leading-4 text-black/60">
          {insight.description}
        </p>
      </div>
    </div>
  );
}

function DefenseMap({
  reports,
}: {
  reports: ReturnType<typeof analyzeTeam>["defense"]["byAttackType"];
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Every incoming type</span>
          <h3 className="mt-2 text-xl font-black tracking-[-0.035em]">Pressure map</h3>
        </div>
        <span className="text-[9px] font-semibold text-black/35">Weak · Safe switch · Neutral</span>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const safe = report.resist.count + report.immune.count;
          return (
            <div
              key={report.attackType}
              className={cn(
                "rounded-xl border p-3",
                report.weak.count >= 2 && safe === 0
                  ? "border-[#ef5b4c]/35 bg-[#fff1ee]"
                  : "border-black/[0.08] bg-white",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <TypePill type={report.attackType} small />
                {report.weak.count >= 2 && safe === 0 ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-[#ef5b4c]" />
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                <Count value={report.weak.count} label="weak" tone="danger" />
                <Count value={safe} label="safe" tone="safe" />
                <Count value={report.neutral.count} label="neutral" />
              </div>
              {report.weak.count ? (
                <p className="mt-2 truncate text-[9px] text-black/40" title={report.weak.memberNames.join(", ")}>
                  {report.weak.memberNames.join(" · ")}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Count({ value, label, tone }: { value: number; label: string; tone?: "danger" | "safe" }) {
  return (
    <span className="rounded-lg bg-black/[0.035] py-1.5">
      <strong className={cn("block text-sm", tone === "danger" && value > 0 && "text-[#d64639]", tone === "safe" && value > 0 && "text-[#348158]")}>
        {value}
      </strong>
      <span className="block text-[7px] font-black uppercase tracking-[0.08em] text-black/30">{label}</span>
    </span>
  );
}

function OffenseMap({ covered, gaps, moveTypes }: { covered: readonly string[]; gaps: readonly string[]; moveTypes: readonly string[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
      <div className="rounded-2xl border border-black/10 bg-[#191816] p-5 text-white">
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Selected attack types</span>
        <div className="mt-4 flex flex-wrap gap-2">
          {moveTypes.length ? moveTypes.map((type) => <TypePill key={type} type={type} />) : <p className="text-xs leading-5 text-white/40">Choose at least one damaging move to calculate coverage.</p>}
        </div>
        <p className="mt-5 text-[10px] leading-4 text-white/35">Status moves are intentionally excluded from offensive coverage.</p>
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#348158]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Covered · {covered.length}
            </span>
            <div className="mt-3 flex flex-wrap gap-1.5">{covered.map((type) => <TypePill key={type} type={type} small />)}</div>
          </div>
          <div>
            <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#d64639]">
              <Crosshair className="h-3.5 w-3.5" /> Blind spots · {gaps.length}
            </span>
            <div className="mt-3 flex flex-wrap gap-1.5">{gaps.map((type) => <TypePill key={type} type={type} small />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Breakers({ attacking, defensive }: { attacking: ReturnType<typeof analyzeTeam>["breakers"]["attackingTypes"]; defensive: ReturnType<typeof analyzeTeam>["breakers"]["defensiveTypeCombinations"] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <span className="eyebrow">Offensive breakers</span>
        <h3 className="mt-2 text-xl font-black tracking-[-0.035em]">What punches through</h3>
        <div className="mt-4 space-y-2">
          {attacking.length ? attacking.slice(0, 6).map((breaker, index) => (
            <div key={breaker.attackType} className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[9px] font-black text-black/25">0{index + 1}</span>
                <TypePill type={breaker.attackType} />
                <span className="ml-auto text-[9px] font-black uppercase tracking-[0.08em] text-[#d64639]">{breaker.threatenedCount} threatened</span>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-black/45">{breaker.explanation}</p>
            </div>
          )) : <EmptyBreakers />}
        </div>
      </div>
      <div>
        <span className="eyebrow">Defensive breakers</span>
        <h3 className="mt-2 text-xl font-black tracking-[-0.035em]">What walls the moves</h3>
        <div className="mt-4 space-y-2">
          {defensive.length ? defensive.slice(0, 6).map((breaker, index) => (
            <div key={breaker.types.join("-")} className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[9px] font-black text-black/25">0{index + 1}</span>
                <div className="flex gap-1">{breaker.types.map((type) => <TypePill key={type} type={type} small />)}</div>
                <span className="ml-auto text-[9px] font-black uppercase tracking-[0.08em] text-black/35">score {breaker.resistanceScore}</span>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-black/45">{breaker.explanation}</p>
            </div>
          )) : <EmptyBreakers />}
        </div>
      </div>
    </div>
  );
}

function EmptyBreakers() {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 p-5 text-center">
      <Shield className="mx-auto h-5 w-5 text-black/20" />
      <p className="mt-2 text-xs font-bold text-black/40">Add more members and damaging moves to rank breakers.</p>
    </div>
  );
}
