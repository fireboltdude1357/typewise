export const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type Generation = (typeof GENERATIONS)[number];

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
  spriteWidth: number;
  spriteHeight: number;
  baseStatTotal: number;
};

export type LearnMethod =
  | "Level up"
  | "TM / HM / TR"
  | "Tutor"
  | "Egg"
  | "Event"
  | "Transfer"
  | "Special"
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
  generationLabel: string;
  scopeNote: string;
  pokemon: PokemonSummary[];
  types: string[];
  typeChart: TypeChart;
};

export type MoveListResponse = {
  generation: Generation;
  pokemonId: string;
  pokemonName: string;
  scopeNote: string;
  moves: MoveSummary[];
};

export type TeamSlot = {
  pokemon: PokemonSummary;
  moves: MoveSummary[];
};

export type StoredTeam = {
  name: string;
  generation: Generation;
  slots: TeamSlot[];
};

export function isGeneration(value: number): value is Generation {
  return GENERATIONS.includes(value as Generation);
}
