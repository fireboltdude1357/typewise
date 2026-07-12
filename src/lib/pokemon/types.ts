export const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const CATALOG_SCOPES = ["national", "core"] as const;

export type Generation = (typeof GENERATIONS)[number];
export type CatalogScope = (typeof CATALOG_SCOPES)[number];

export type MoveCategory = "Physical" | "Special" | "Status";

export type MoveMatchupMode =
  | "standard"
  | "immunity-only"
  | "type-independent";

export type PokemonSummary = {
  id: string;
  number: number;
  name: string;
  baseSpecies: string;
  forme: string | null;
  introducedIn: number;
  types: string[];
  sprite: string;
  spriteFallbacks: string[];
  spriteWidth: number;
  spriteHeight: number;
  baseStatTotal: number;
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  abilities: string[];
  singlesTier: string;
  doublesTier: string;
};

export const BATTLE_FORMATS = ["casual", "singles", "doubles"] as const;
export type BattleFormat = (typeof BATTLE_FORMATS)[number];
export type Nature =
  | "Hardy"
  | "Adamant"
  | "Modest"
  | "Jolly"
  | "Timid"
  | "Bold"
  | "Calm"
  | "Impish"
  | "Careful";
export type EvPreset = "balanced" | "physical" | "special" | "fast-physical" | "fast-special" | "bulky";

export type CompetitiveSet = {
  ability: string;
  item: string;
  nature: Nature;
  evPreset: EvPreset;
};

export type LearnMethod =
  | "Level up"
  | "TM / HM / TR"
  | "Tutor"
  | "Egg"
  | "Event"
  | "Transfer"
  | "Special"
  | "Sketch"
  | "Virtual Console"
  | "Let's Go transfer";

export type MoveSummary = {
  id: string;
  name: string;
  type: string;
  category: MoveCategory;
  power: number | null;
  accuracy: number | null;
  alwaysHits: boolean;
  pp: number;
  priority: number;
  description: string;
  methods: LearnMethod[];
  sourceGenerations: number[];
  matchupMode: MoveMatchupMode;
  secondaryEffectivenessType?: string;
  effectivenessOverrides?: Record<string, number>;
};

export type TypeChart = Record<string, Record<string, number>>;

export type DexCatalogResponse = {
  generation: Generation;
  scope: CatalogScope;
  generationLabel: string;
  scopeNote: string;
  pokemon: PokemonSummary[];
  types: string[];
  typeChart: TypeChart;
};

export type MoveListResponse = {
  generation: Generation;
  scope: CatalogScope;
  pokemonId: string;
  pokemonName: string;
  scopeNote: string;
  moves: MoveSummary[];
};

export type TeamSlot = {
  pokemon: PokemonSummary;
  moves: MoveSummary[];
  competitiveSet?: CompetitiveSet;
};

export type StoredTeam = {
  name: string;
  generation: Generation;
  scope: CatalogScope;
  slots: TeamSlot[];
};

export function isGeneration(value: number): value is Generation {
  return GENERATIONS.includes(value as Generation);
}

export function isCatalogScope(value: string): value is CatalogScope {
  return CATALOG_SCOPES.includes(value as CatalogScope);
}

export function isBattleFormat(value: string): value is BattleFormat {
  return BATTLE_FORMATS.includes(value as BattleFormat);
}
