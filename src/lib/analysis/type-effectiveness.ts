import type {
  MatchupOutcome,
  PokemonType,
  SelectedMove,
  TypeChartInput,
} from "./types";

const NEUTRAL_MULTIPLIER = 1;

/** Deduplicates values without reordering them. */
export function uniqueInOrder<T>(values: readonly T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

export function chartTypes(chart: TypeChartInput): PokemonType[] {
  return uniqueInOrder(chart.types);
}

/** Returns a single-type multiplier from a conventional sparse type chart. */
export function singleTypeMultiplier(
  chart: TypeChartInput,
  attackType: PokemonType,
  defendingType: PokemonType,
): number {
  const multiplier = chart.multipliers[attackType]?.[defendingType];
  return multiplier ?? NEUTRAL_MULTIPLIER;
}

/**
 * Multiplies each defensive type modifier. This naturally handles immunity,
 * quarter-resists, and double weaknesses (for example 2 * 0 = 0 and 2 * 2 = 4).
 */
export function typeMultiplier(
  chart: TypeChartInput,
  attackType: PokemonType,
  defendingTypes: readonly PokemonType[],
): number {
  return uniqueInOrder(defendingTypes).reduce(
    (total, defendingType) =>
      total * singleTypeMultiplier(chart, attackType, defendingType),
    NEUTRAL_MULTIPLIER,
  );
}

/**
 * Calculates the type-chart multiplier for a selected move. Overrides replace
 * the move's complete modifier against one defensive type, while a secondary
 * effectiveness type is otherwise multiplied with the move's own type. The
 * per-type results are then multiplied across a dual-type defender.
 *
 * `immunity-only` moves collapse every non-zero matchup to neutral, while
 * `type-independent` moves always return neutral. This lets callers retain
 * real immunities without treating fixed-damage moves as ordinary coverage.
 */
export function selectedMoveMultiplier(
  chart: TypeChartInput,
  move: Pick<
    SelectedMove,
    | "type"
    | "matchupMode"
    | "secondaryEffectivenessType"
    | "effectivenessOverrides"
  >,
  defendingTypes: readonly PokemonType[],
): number {
  const matchupMode = move.matchupMode ?? "standard";
  if (matchupMode === "type-independent") return NEUTRAL_MULTIPLIER;

  const standardMultiplier = uniqueInOrder(defendingTypes).reduce(
    (total, defendingType) => {
      const override = move.effectivenessOverrides?.[defendingType];
      if (override !== undefined) return total * override;

      const primaryMultiplier = singleTypeMultiplier(
        chart,
        move.type,
        defendingType,
      );
      const secondaryMultiplier = move.secondaryEffectivenessType
        ? singleTypeMultiplier(
            chart,
            move.secondaryEffectivenessType,
            defendingType,
          )
        : NEUTRAL_MULTIPLIER;
      return total * primaryMultiplier * secondaryMultiplier;
    },
    NEUTRAL_MULTIPLIER,
  );

  return matchupMode === "immunity-only" && standardMultiplier !== 0
    ? NEUTRAL_MULTIPLIER
    : standardMultiplier;
}

export function matchupOutcome(multiplier: number): MatchupOutcome {
  if (multiplier === 0) return "immune";
  if (multiplier > NEUTRAL_MULTIPLIER) return "weak";
  if (multiplier < NEUTRAL_MULTIPLIER) return "resist";
  return "neutral";
}

export function assertValidAnalysisInput(
  teamTypesAndMoves: readonly {
    name: string;
    types: readonly PokemonType[];
    moves: readonly {
      name: string;
      type: PokemonType;
      category: SelectedMove["category"];
      matchupMode?: SelectedMove["matchupMode"];
      secondaryEffectivenessType?: PokemonType;
      effectivenessOverrides?: Readonly<Record<string, number>>;
    }[];
  }[],
  chart: TypeChartInput,
): void {
  const types = chartTypes(chart);
  if (types.length === 0) {
    throw new Error("The supplied type chart must contain at least one type.");
  }

  const knownTypes = new Set(types);
  for (const [attackType, row] of Object.entries(chart.multipliers)) {
    if (!knownTypes.has(attackType)) {
      throw new Error(
        `Type chart attack type \"${attackType}\" is not present in chart.types.`,
      );
    }

    for (const [defendingType, multiplier] of Object.entries(row ?? {})) {
      if (!knownTypes.has(defendingType)) {
        throw new Error(
          `Type chart defense type \"${defendingType}\" is not present in chart.types.`,
        );
      }
      if (!Number.isFinite(multiplier) || multiplier < 0) {
        throw new Error(
          `Invalid ${attackType} -> ${defendingType} multiplier: ${multiplier}.`,
        );
      }
    }
  }

  for (const member of teamTypesAndMoves) {
    for (const type of member.types) {
      if (!knownTypes.has(type)) {
        throw new Error(
          `Unknown type \"${type}\" on ${member.name} for generation ${chart.generation}.`,
        );
      }
    }
    for (const move of member.moves) {
      const usesPrimaryType =
        move.category !== "status" &&
        (move.matchupMode ?? "standard") !== "type-independent";
      if (usesPrimaryType && !knownTypes.has(move.type)) {
        throw new Error(
          `Unknown move type \"${move.type}\" on ${move.name} for generation ${chart.generation}.`,
        );
      }
      if (
        move.secondaryEffectivenessType !== undefined &&
        !knownTypes.has(move.secondaryEffectivenessType)
      ) {
        throw new Error(
          `Unknown secondary effectiveness type \"${move.secondaryEffectivenessType}\" on ${move.name} for generation ${chart.generation}.`,
        );
      }
      for (const [defendingType, multiplier] of Object.entries(
        move.effectivenessOverrides ?? {},
      )) {
        if (!knownTypes.has(defendingType)) {
          throw new Error(
            `Unknown effectiveness override type \"${defendingType}\" on ${move.name} for generation ${chart.generation}.`,
          );
        }
        if (!Number.isFinite(multiplier) || multiplier < 0) {
          throw new Error(
            `Invalid ${move.name} -> ${defendingType} effectiveness override: ${multiplier}.`,
          );
        }
      }
    }
  }
}
