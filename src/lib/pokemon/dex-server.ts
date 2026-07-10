import "server-only";

import { Dex, toID } from "@pkmn/dex";
import { Generations } from "@pkmn/data";
import { Sprites } from "@pkmn/img";

import rawCoreGameData from "../../data/core-game-data.json";
import { generationName, generationScope } from "./generations";
import type {
  CatalogScope,
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

const nationalGenerations = new Generations(Dex, (data) => {
  if (!data.exists) return false;
  const nonstandard =
    "isNonstandard" in data ? data.isNonstandard : undefined;
  return nonstandard !== "CAP" && nonstandard !== "Custom";
});

type MoveSourceMap = Record<string, string[]>;

type CoreTitleData = {
  generation: number;
  name: string;
  kind: string;
  species: string[];
  learnsets: Record<string, MoveSourceMap>;
  syntheticLearnsets: Record<string, MoveSourceMap>;
};

type MovePoolDelta = {
  remove?: string[];
  add?: MoveSourceMap;
};

type CoreGameData = {
  schemaVersion: number;
  titleOrder: string[];
  titles: Record<string, CoreTitleData>;
  hiddenPowerTypes: Record<string, Record<string, string[]>>;
  baseMovePoolDeltas: Record<string, Record<string, MovePoolDelta>>;
};

const coreGameData = rawCoreGameData as unknown as CoreGameData;

if (coreGameData.schemaVersion !== 1) {
  throw new Error(
    `Unsupported core game data schema ${coreGameData.schemaVersion}.`,
  );
}

const SOURCE_METHODS: Record<string, Exclude<LearnMethod, "Transfer">> = {
  L: "Level up",
  M: "TM / HM / TR",
  T: "Tutor",
  E: "Egg",
  S: "Event",
  D: "Special",
  R: "Special",
  K: "Sketch",
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

function isNationalPokemon(
  species: ReturnType<(typeof Dex)["species"]["get"]>,
  generation: Generation,
) {
  return (
    species.exists &&
    species.num > 0 &&
    species.gen <= generation &&
    !species.isCosmeticForme &&
    species.isNonstandard !== "Custom" &&
    species.isNonstandard !== "Unobtainable"
  );
}

function generationTitles(generation: Generation) {
  return coreGameData.titleOrder
    .map((key) => coreGameData.titles[key])
    .filter(
      (title): title is CoreTitleData =>
        title !== undefined && title.generation === generation,
    );
}

function coreGenerationTitles(generation: Generation) {
  return generationTitles(generation).filter(
    (title) => title.kind !== "competitive-title",
  );
}

function coreSpeciesIds(generation: Generation) {
  const dex = Dex.forGen(generation);
  const ids = new Set(
    dex.species.all().filter(isStandardPokemon).map((species) => species.id),
  );

  for (const title of coreGenerationTitles(generation)) {
    for (const speciesId of title.species) {
      const species = dex.species.get(speciesId);
      if (isNationalPokemon(species, generation)) ids.add(species.id);
    }
  }

  return ids;
}

function isPokemonInScope(
  species: ReturnType<(typeof Dex)["species"]["get"]>,
  generation: Generation,
  scope: CatalogScope,
) {
  return scope === "national"
    ? isNationalPokemon(species, generation)
    : coreSpeciesIds(generation).has(species.id);
}

function catalogSpecies(generation: Generation, scope: CatalogScope) {
  const dex = Dex.forGen(generation);
  if (scope === "national") {
    return dex.species
      .all()
      .filter((species) => isNationalPokemon(species, generation));
  }

  return [...coreSpeciesIds(generation)]
    .map((speciesId) => dex.species.get(speciesId))
    .filter((species) => isNationalPokemon(species, generation));
}

function pokemonSummary(
  species: ReturnType<(typeof Dex)["species"]["get"]>,
): PokemonSummary {
  const sprite = Sprites.getDexPokemon(species.name, { gen: "gen5" });
  const nearestVisualForm = species.id.endsWith("totem")
    ? Dex.species.get(species.id.replace(/totem$/, ""))
    : null;
  const nearestVisualSprite = nearestVisualForm?.exists
    ? Sprites.getDexPokemon(nearestVisualForm.name, { gen: "gen5" })
    : null;
  const baseSprite = Sprites.getDexPokemon(species.baseSpecies, { gen: "gen5" });
  const spriteFallbacks = [
    ...(nearestVisualSprite && nearestVisualSprite.url !== sprite.url
      ? [nearestVisualSprite.url]
      : []),
    ...(baseSprite.url !== sprite.url ? [baseSprite.url] : []),
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.num}.png`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${species.num}.png`,
  ];

  return {
    id: species.id,
    number: species.num,
    name: species.name,
    baseSpecies: species.baseSpecies,
    forme: species.forme || null,
    introducedIn: species.gen,
    types: [...species.types],
    sprite: sprite.url,
    spriteFallbacks: [...new Set(spriteFallbacks)],
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

export function getDexCatalog(
  generation: Generation,
  scope: CatalogScope = "national",
): DexCatalogResponse {
  const dex = Dex.forGen(generation);
  const types = sortTypes(
    dex.types
      .names()
      .filter((type) => type !== "???" && type !== "Stellar"),
  );

  const pokemon = catalogSpecies(generation, scope)
    .map(pokemonSummary)
    .sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));

  return {
    generation,
    scope,
    generationLabel: generationName(generation),
    scopeNote:
      scope === "national"
        ? `${generationName(generation)} National roster. Every official species and mechanically distinct form introduced by this generation is included; unavailable primary-title Pokémon use their latest learn sources through this generation.`
        : `${generationScope(generation)} core-game roster. Pokémon must be usable in at least one supported core title from this generation; legal historical transfers and events are labeled.`,
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
      "Sketch",
      "Virtual Console",
      "Let's Go transfer",
      "Transfer",
    ];
    return order.indexOf(a) - order.indexOf(b);
  });
}

function mergeMoveSources(
  target: MoveSourceMap,
  additions: MoveSourceMap | undefined,
) {
  if (!additions) return;
  for (const [moveId, sources] of Object.entries(additions)) {
    target[moveId] = [...new Set([...(target[moveId] ?? []), ...sources])];
  }
}

async function legalMoveSources(
  generation: Generation,
  scope: CatalogScope,
  speciesName: string,
  speciesId: string,
) {
  const includeCanonicalPool =
    scope === "national" ||
    isStandardPokemon(Dex.forGen(generation).species.get(speciesId));
  const sources: MoveSourceMap = {};

  if (includeCanonicalPool) {
    const approximate =
      (await nationalGenerations
        .get(generation)
        .learnsets.learnable(speciesName)) ?? {};
    mergeMoveSources(sources, approximate);

    const delta =
      coreGameData.baseMovePoolDeltas[String(generation)]?.[speciesId];
    for (const moveId of delta?.remove ?? []) delete sources[moveId];
    mergeMoveSources(sources, delta?.add);
  }

  const titles =
    scope === "national"
      ? generationTitles(generation)
      : coreGenerationTitles(generation);
  for (const title of titles) {
    mergeMoveSources(sources, title.learnsets[speciesId]);
    mergeMoveSources(sources, title.syntheticLearnsets[speciesId]);
  }

  return sources;
}

function hiddenPowerTypesFor(
  generation: Generation,
  species: ReturnType<(typeof Dex)["species"]["get"]>,
  fallbackTypes: string[],
) {
  const map = coreGameData.hiddenPowerTypes[String(generation)];
  if (!map) return fallbackTypes;

  const battleOnly = Array.isArray(species.battleOnly)
    ? species.battleOnly
    : species.battleOnly
      ? [species.battleOnly]
      : [];
  const candidates = [
    species.id,
    ...(species.changesFrom ? [toID(species.changesFrom)] : []),
    ...battleOnly.map(toID),
    toID(species.baseSpecies),
  ];
  for (const speciesId of candidates) {
    if (map[speciesId]) return map[speciesId];
  }
  return fallbackTypes;
}

function ignoresImmunityForType(
  ignoreImmunity: boolean | Readonly<Record<string, boolean | undefined>> | undefined,
  type: string,
): boolean {
  if (ignoreImmunity === true) return true;
  if (!ignoreImmunity) return false;
  return ignoreImmunity[type] === true;
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
  if (!move.exists || move.isNonstandard === "CAP") {
    return null;
  }

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

  const hasSpecialDamageRule =
    Boolean(move.ohko) ||
    (move.damage !== undefined && move.damage !== null && move.damage !== false) ||
    NON_STANDARD_DAMAGE_MOVES.has(move.id);
  const matchupMode: MoveSummary["matchupMode"] =
    move.category === "Status" ||
    (hasSpecialDamageRule &&
      ignoresImmunityForType(move.ignoreImmunity, resolvedType))
      ? "type-independent"
      : hasSpecialDamageRule
        ? "immunity-only"
        : "standard";

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
    matchupMode,
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
  scope: CatalogScope = "national",
): Promise<MoveListResponse | null> {
  const dex = Dex.forGen(generation);
  const species = dex.species.get(pokemonId);
  if (!isPokemonInScope(species, generation, scope)) return null;

  const learnsets = await legalMoveSources(
    generation,
    scope,
    species.name,
    species.id,
  );
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

      const historicalTypes = dex.types
        .names()
        .filter(
          (type) =>
            type !== "Normal" &&
            type !== "Fairy" &&
            type !== "???" &&
            type !== "Stellar",
        );
      return hiddenPowerTypesFor(generation, species, historicalTypes)
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
    scope,
    pokemonId: species.id,
    pokemonName: species.name,
    scopeNote: `Individual move legality is the ${scope === "national" ? "National" : "core-game"} union of supported ${generationName(generation)} learn sources. Simulator-validated transfers, title-specific sources, Sketch, and events are labeled; mutually exclusive event combinations are not jointly validated.`,
    moves,
  };
}
