import "server-only";

import { Dex, toID } from "@pkmn/dex";
import { Generations } from "@pkmn/data";
import { Sprites } from "@pkmn/img";

import { generationName, generationScope } from "./generations";
import type {
  DexCatalogResponse,
  Generation,
  LearnMethod,
  MoveListResponse,
  MoveSummary,
  PokemonSummary,
  TypeChart,
} from "./types";

const DAMAGE_MULTIPLIER: Record<number, number> = {
  0: 1,
  1: 2,
  2: 0.5,
  3: 0,
};

const generations = new Generations(Dex);

const SOURCE_METHODS: Record<string, Exclude<LearnMethod, "Transfer">> = {
  L: "Level up",
  M: "TM / HM / TR",
  T: "Tutor",
  E: "Egg",
  S: "Event",
  D: "Special",
  R: "Special",
};

const NON_STANDARD_DAMAGE_MOVES = new Set([
  "bide",
  "counter",
  "endeavor",
  "finalgambit",
  "guardianofalola",
  "metalburst",
  "mirrorcoat",
  "naturesmadness",
  "psywave",
  "ruination",
  "superfang",
]);

const TYPE_ORDER = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
];

function sortTypes(types: string[]) {
  return types.sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b));
}

function isStandardPokemon(species: ReturnType<(typeof Dex)["species"]["get"]>) {
  return (
    species.exists &&
    species.num > 0 &&
    !species.isNonstandard &&
    !species.isCosmeticForme
  );
}

function pokemonSummary(
  species: ReturnType<(typeof Dex)["species"]["get"]>,
): PokemonSummary {
  const sprite = Sprites.getDexPokemon(species.name, { gen: "gen5" });

  return {
    id: species.id,
    number: species.num,
    name: species.name,
    baseSpecies: species.baseSpecies,
    forme: species.forme || null,
    introducedIn: species.gen,
    types: [...species.types],
    sprite: sprite.url,
    spriteWidth: sprite.w,
    spriteHeight: sprite.h,
    baseStatTotal: species.bst,
  };
}

function getTypeChart(generation: Generation, typeNames: string[]): TypeChart {
  const dex = Dex.forGen(generation);

  return Object.fromEntries(
    typeNames.map((attackType) => [
      attackType,
      Object.fromEntries(
        typeNames.map((defenseType) => {
          const code = dex.types.get(defenseType).damageTaken[attackType] ?? 0;
          return [defenseType, DAMAGE_MULTIPLIER[code] ?? 1];
        }),
      ),
    ]),
  );
}

export function getDexCatalog(generation: Generation): DexCatalogResponse {
  const dex = Dex.forGen(generation);
  const types = sortTypes(
    dex.types
      .names()
      .filter((type) => type !== "???" && type !== "Stellar"),
  );

  const pokemon = dex.species
    .all()
    .filter(isStandardPokemon)
    .map(pokemonSummary)
    .sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));

  return {
    generation,
    generationLabel: generationName(generation),
    scopeNote: `${generationScope(generation)}. The catalog follows the generation's standard competitive dex and combines learn methods across those paired titles; side-game-only species and forms are excluded.`,
    pokemon,
    types,
    typeChart: getTypeChart(generation, types),
  };
}

function sourceGeneration(source: string) {
  const match = source.match(/^(\d)/);
  return match ? Number(match[1]) : null;
}

function moveMethods(sources: string[], generation: Generation): LearnMethod[] {
  const methods = new Set<LearnMethod>();

  for (const source of sources) {
    const sourceGen = sourceGeneration(source);
    if (!sourceGen || sourceGen > generation) continue;

    const sourceCode = source.charAt(1);
    const method =
      sourceCode === "V"
        ? sourceGen === 8
          ? "Let's Go transfer"
          : "Virtual Console"
        : SOURCE_METHODS[sourceCode];
    if (method) methods.add(method);
    if (sourceGen < generation) methods.add("Transfer");
  }

  return [...methods].sort((a, b) => {
    const order: LearnMethod[] = [
      "Level up",
      "TM / HM / TR",
      "Tutor",
      "Egg",
      "Event",
      "Special",
      "Virtual Console",
      "Let's Go transfer",
      "Transfer",
    ];
    return order.indexOf(a) - order.indexOf(b);
  });
}

function serializeMove(
  generation: Generation,
  moveId: string,
  rawSources: Set<string>,
  pokemonId: string,
  pokemonTypes: readonly string[],
  hiddenPowerType?: string,
): MoveSummary | null {
  const dex = Dex.forGen(generation);
  const move = dex.moves.get(
    hiddenPowerType ? `Hidden Power ${hiddenPowerType}` : moveId,
  );
  if (!move.exists || move.isNonstandard) return null;

  const sources = [...rawSources].filter((source) => {
    const sourceGen = sourceGeneration(source);
    return sourceGen !== null && sourceGen <= generation;
  });
  const methods = moveMethods(sources, generation);
  if (methods.length === 0) return null;

  let resolvedType: string = move.type;
  if (move.id === "ragingbull") {
    resolvedType = pokemonId.includes("paldeaaqua")
      ? "Water"
      : pokemonId.includes("paldeablaze")
        ? "Fire"
        : pokemonId.includes("paldeacombat")
          ? "Fighting"
          : (pokemonTypes[0] ?? move.type);
  } else if (move.id === "ivycudgel") {
    resolvedType = pokemonId.includes("wellspring")
      ? "Water"
      : pokemonId.includes("hearthflame")
        ? "Fire"
        : pokemonId.includes("cornerstone")
          ? "Rock"
          : "Grass";
  } else if (move.id === "revelationdance") {
    resolvedType = pokemonTypes[0] ?? move.type;
  } else if (move.id === "aurawheel" && pokemonId.includes("hangry")) {
    resolvedType = "Dark";
  }

  const usesTypeEffectiveness =
    !move.ohko &&
    (move.damage === undefined || move.damage === null || move.damage === false) &&
    !NON_STANDARD_DAMAGE_MOVES.has(move.id);

  return {
    id: hiddenPowerType ? `hiddenpower${toID(hiddenPowerType)}` : move.id,
    name: move.name,
    type: resolvedType,
    category: move.category,
    power: move.category === "Status" || move.basePower === 0 ? null : move.basePower,
    accuracy: move.accuracy === true ? null : move.accuracy,
    alwaysHits: move.accuracy === true,
    pp: move.pp,
    priority: move.priority,
    description: move.shortDesc || move.desc || "No description is available.",
    methods,
    sourceGenerations: [
      ...new Set(
        sources
          .map(sourceGeneration)
          .filter((value): value is number => value !== null),
      ),
    ].sort((a, b) => b - a),
    usesTypeEffectiveness,
    ...(move.id === "flyingpress"
      ? { secondaryEffectivenessType: "Flying" }
      : {}),
    ...(move.id === "freezedry"
      ? { effectivenessOverrides: { Water: 2 } }
      : move.id === "thousandarrows"
        ? { effectivenessOverrides: { Flying: 1 } }
        : {}),
  };
}

export async function getPokemonMoves(
  generation: Generation,
  pokemonId: string,
): Promise<MoveListResponse | null> {
  const dex = Dex.forGen(generation);
  const species = dex.species.get(pokemonId);
  if (!isStandardPokemon(species)) return null;

  const learnsets =
    (await generations.get(generation).learnsets.learnable(species.name)) ?? {};
  const moves = Object.entries(learnsets)
    .flatMap(([moveId, sources]) => {
      if (moveId !== "hiddenpower") {
        return [
          serializeMove(
            generation,
            moveId,
            new Set(sources),
            species.id,
            species.types,
          ),
        ];
      }

      return dex.types
        .names()
        .filter(
          (type) =>
            type !== "Normal" &&
            type !== "Fairy" &&
            type !== "???" &&
            type !== "Stellar",
        )
        .map((type) =>
          serializeMove(
            generation,
            moveId,
            new Set(sources),
            species.id,
            species.types,
            type,
          ),
        );
    })
    .filter((move): move is MoveSummary => move !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    generation,
    pokemonId: species.id,
    pokemonName: species.name,
    scopeNote: `Individual move legality is the union of ${generationName(generation)} learn sources. Transfer-only and event-only moves are labeled; mutually exclusive event combinations are not validated.`,
    moves,
  };
}
