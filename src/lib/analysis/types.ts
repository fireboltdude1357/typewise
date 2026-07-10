/** A Pokemon type name as supplied by the selected generation's type chart. */
export type PokemonType = string;

export type MoveCategory = "physical" | "special" | "status";

/**
 * Utility labels are deliberately extensible. The built-in labels cover common
 * team-building jobs, while callers can supply generation- or format-specific
 * labels through `AnalysisOptions.utilityTargets`.
 */
export type UtilityRole =
  | "recovery"
  | "hazard-setting"
  | "hazard-removal"
  | "speed-control"
  | "priority"
  | "pivoting"
  | "status"
  | "cleric"
  | "phazing"
  | "screens"
  | "setup"
  | "item-control"
  | (string & {});

/** A move selected for one team member. Category, rather than power, decides damage. */
export interface SelectedMove {
  id: string;
  name: string;
  type: PokemonType;
  category: MoveCategory;
  /** `null` supports fixed-damage and other damaging moves without a normal base power. */
  power?: number | null;
  accuracy?: number | null;
  priority?: number;
  utilityRoles?: readonly UtilityRole[];
  /**
   * Whether the move uses the type chart when it deals damage. This defaults
   * to `true`; fixed-damage, OHKO, and counter-style moves set it to `false`.
   */
  usesTypeEffectiveness?: boolean;
  /**
   * A second attacking type whose effectiveness is multiplied with `type`.
   * Flying Press, for example, is Fighting type with Flying effectiveness.
   */
  secondaryEffectivenessType?: PokemonType;
  /**
   * Move-specific effectiveness against one defensive type. Each entry
   * replaces the move's normal modifier for that defensive type before dual
   * types are multiplied (for example Freeze-Dry Water=2).
   */
  effectivenessOverrides?: Readonly<Record<string, number>>;
}

export interface TeamPokemon {
  id: string;
  name: string;
  types: readonly [PokemonType] | readonly [PokemonType, PokemonType];
  moves: readonly SelectedMove[];
}

/**
 * A sparse attack -> defense chart for a specific generation. Missing entries
 * are neutral (1x), matching the conventional representation of type charts.
 */
export interface TypeChartInput {
  generation: number | string;
  types: readonly PokemonType[];
  multipliers: Readonly<
    Record<string, Readonly<Record<string, number>> | undefined>
  >;
}

export type DefensiveTypeCombination =
  | readonly [PokemonType]
  | readonly [PokemonType, PokemonType];

export interface UtilityTarget {
  role: UtilityRole;
  label: string;
  description: string;
}

export interface AnalysisOptions {
  /** Minimum shared weaknesses required for an attacking breaker. Default: 2. */
  minimumThreatenedMembers?: number;
  /** Maximum number of attacking and defensive breaker results. Default: 10 each. */
  breakerLimit?: number;
  /** Moves per complete set. Default: 4. */
  movesPerPokemon?: number;
  /** Override common competitive-team utility expectations. */
  utilityTargets?: readonly UtilityTarget[];
  /**
   * Type combinations that actually occur in the selected generation's
   * catalog. When omitted, every mathematical mono/dual combination is used.
   */
  defensiveTypeCombinations?: readonly DefensiveTypeCombination[];
}

export type MatchupOutcome = "weak" | "resist" | "immune" | "neutral";

export interface MemberMatchup {
  memberId: string;
  memberName: string;
  multiplier: number;
  outcome: MatchupOutcome;
}

export interface MatchupGroup {
  count: number;
  memberNames: readonly string[];
  members: readonly MemberMatchup[];
}

export interface DefensiveTypeReport {
  attackType: PokemonType;
  weak: MatchupGroup;
  resist: MatchupGroup;
  immune: MatchupGroup;
  neutral: MatchupGroup;
  matchups: readonly MemberMatchup[];
}

export interface DefensiveAnalysis {
  byAttackType: readonly DefensiveTypeReport[];
  sharedWeaknesses: readonly DefensiveTypeReport[];
}

export interface MoveTypeMatchup {
  moveType: PokemonType;
  multiplier: number;
}

export interface MonoTypeCoverageReport {
  defendingType: PokemonType;
  coveredSuperEffectively: boolean;
  bestMultiplier: number;
  bestMoveTypes: readonly PokemonType[];
  matchups: readonly MoveTypeMatchup[];
}

export interface OffensiveCoverageAnalysis {
  /**
   * Unique move types, in type-chart order, from physical and special moves
   * that use type effectiveness.
   */
  damagingMoveTypes: readonly PokemonType[];
  byDefendingType: readonly MonoTypeCoverageReport[];
  coveredTypes: readonly PokemonType[];
  gapTypes: readonly PokemonType[];
}

export interface StabMemberReport {
  memberId: string;
  memberName: string;
  pokemonTypes: readonly PokemonType[];
  damagingStabTypes: readonly PokemonType[];
  missingStabTypes: readonly PokemonType[];
  hasDamagingStab: boolean;
}

export type MovesetIssueKind =
  | "no-moves"
  | "no-damaging-moves"
  | "open-move-slots";

export interface MovesetIssue {
  kind: MovesetIssueKind;
  message: string;
}

export interface MovesetMemberReport {
  memberId: string;
  memberName: string;
  selectedMoveCount: number;
  damagingMoveCount: number;
  statusMoveCount: number;
  openMoveSlots: number;
  issues: readonly MovesetIssue[];
}

export interface UtilityContribution {
  role: UtilityRole;
  memberIds: readonly string[];
  memberNames: readonly string[];
  moveNames: readonly string[];
}

export interface UtilityGap {
  role: UtilityRole;
  label: string;
  description: string;
}

export interface UtilityAnalysis {
  coveredRoles: readonly UtilityRole[];
  missingRoles: readonly UtilityRole[];
  contributions: readonly UtilityContribution[];
  gaps: readonly UtilityGap[];
}

export type GapCategory = "stab" | "moveset" | "utility";
export type GapSeverity = "warning" | "info";

/** Ready-to-render insight shared by cards, summaries, and persisted reports. */
export interface GapInsight {
  id: string;
  category: GapCategory;
  severity: GapSeverity;
  title: string;
  description: string;
  memberIds: readonly string[];
  memberNames: readonly string[];
  types: readonly PokemonType[];
}

export interface TeamGapAnalysis {
  stab: {
    byMember: readonly StabMemberReport[];
    gaps: readonly StabMemberReport[];
  };
  movesets: {
    byMember: readonly MovesetMemberReport[];
    gaps: readonly MovesetMemberReport[];
  };
  utility: UtilityAnalysis;
  insights: readonly GapInsight[];
}

export interface AttackTypeBreaker {
  kind: "attacking-type";
  attackType: PokemonType;
  pressureScore: number;
  threatenedCount: number;
  safeSwitchCount: number;
  neutralCount: number;
  threatenedMembers: readonly MemberMatchup[];
  safeSwitchMembers: readonly MemberMatchup[];
  explanation: string;
}

export interface DefensiveArchetypeMatchup {
  attackingMoveType: PokemonType;
  multiplier: number;
  outcome: MatchupOutcome;
}

export interface DefensiveTypeBreaker {
  kind: "defensive-type-combination";
  types: DefensiveTypeCombination;
  resistanceScore: number;
  resistedMoveTypes: readonly PokemonType[];
  immuneMoveTypes: readonly PokemonType[];
  neutralMoveTypes: readonly PokemonType[];
  matchups: readonly DefensiveArchetypeMatchup[];
  explanation: string;
}

export interface BreakerAnalysis {
  attackingTypes: readonly AttackTypeBreaker[];
  defensiveTypeCombinations: readonly DefensiveTypeBreaker[];
}

export interface TeamAnalysis {
  generation: number | string;
  teamSize: number;
  defense: DefensiveAnalysis;
  offense: OffensiveCoverageAnalysis;
  gaps: TeamGapAnalysis;
  breakers: BreakerAnalysis;
}
