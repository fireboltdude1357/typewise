import {
  assertValidAnalysisInput,
  chartTypes,
  matchupOutcome,
  selectedMoveMultiplier,
  typeMultiplier,
  uniqueInOrder,
} from "./type-effectiveness";
import type {
  AnalysisOptions,
  AttackTypeBreaker,
  BreakerAnalysis,
  DefensiveAnalysis,
  DefensiveTypeCombination,
  DefensiveTypeBreaker,
  DefensiveTypeReport,
  GapInsight,
  MatchupGroup,
  MemberMatchup,
  MonoTypeCoverageReport,
  MovesetIssue,
  MovesetMemberReport,
  OffensiveCoverageAnalysis,
  PokemonType,
  SelectedMove,
  StabMemberReport,
  TeamAnalysis,
  TeamGapAnalysis,
  TeamPokemon,
  TypeChartInput,
  UtilityAnalysis,
  UtilityContribution,
  UtilityRole,
  UtilityTarget,
} from "./types";

export const DEFAULT_UTILITY_TARGETS: readonly UtilityTarget[] = [
  {
    role: "recovery",
    label: "Reliable recovery",
    description: "No selected move is tagged as reliable recovery.",
  },
  {
    role: "hazard-removal",
    label: "Hazard removal",
    description: "No selected move is tagged for removing entry hazards.",
  },
  {
    role: "speed-control",
    label: "Speed control",
    description: "No selected move is tagged as speed control.",
  },
];

const DEFAULT_MOVES_PER_POKEMON = 4;
const DEFAULT_BREAKER_LIMIT = 10;
const DEFAULT_MINIMUM_THREATENED_MEMBERS = 2;

interface ResolvedOptions {
  minimumThreatenedMembers: number;
  breakerLimit: number;
  movesPerPokemon: number;
  utilityTargets: readonly UtilityTarget[];
  defensiveTypeCombinations:
    | readonly DefensiveTypeCombination[]
    | undefined;
}

function resolveOptions(options: AnalysisOptions | undefined): ResolvedOptions {
  return {
    minimumThreatenedMembers: Math.max(
      1,
      Math.floor(
        options?.minimumThreatenedMembers ??
          DEFAULT_MINIMUM_THREATENED_MEMBERS,
      ),
    ),
    breakerLimit: Math.max(
      0,
      Math.floor(options?.breakerLimit ?? DEFAULT_BREAKER_LIMIT),
    ),
    movesPerPokemon: Math.max(
      0,
      Math.floor(options?.movesPerPokemon ?? DEFAULT_MOVES_PER_POKEMON),
    ),
    utilityTargets: options?.utilityTargets ?? DEFAULT_UTILITY_TARGETS,
    defensiveTypeCombinations: options?.defensiveTypeCombinations,
  };
}

function groupMatchups(
  matchups: readonly MemberMatchup[],
  outcome: MemberMatchup["outcome"],
): MatchupGroup {
  const members = matchups.filter((matchup) => matchup.outcome === outcome);
  return {
    count: members.length,
    memberNames: members.map((member) => member.memberName),
    members,
  };
}

function weaknessSeverity(report: DefensiveTypeReport): number {
  return report.weak.members.reduce(
    (total, matchup) => total + matchup.multiplier,
    0,
  );
}

function safeSwitchCount(report: DefensiveTypeReport): number {
  return report.resist.count + report.immune.count;
}

function analyzeDefense(
  team: readonly TeamPokemon[],
  chart: TypeChartInput,
  types: readonly PokemonType[],
): DefensiveAnalysis {
  const byAttackType: DefensiveTypeReport[] = types.map((attackType) => {
    const matchups = team.map<MemberMatchup>((member) => {
      const multiplier = typeMultiplier(chart, attackType, member.types);
      return {
        memberId: member.id,
        memberName: member.name,
        multiplier,
        outcome: matchupOutcome(multiplier),
      };
    });

    return {
      attackType,
      weak: groupMatchups(matchups, "weak"),
      resist: groupMatchups(matchups, "resist"),
      immune: groupMatchups(matchups, "immune"),
      neutral: groupMatchups(matchups, "neutral"),
      matchups,
    };
  });

  const typeIndex = new Map(types.map((type, index) => [type, index]));
  const sharedWeaknesses = byAttackType
    .filter((report) => report.weak.count >= 2)
    .sort(
      (left, right) =>
        right.weak.count - left.weak.count ||
        weaknessSeverity(right) - weaknessSeverity(left) ||
        safeSwitchCount(left) - safeSwitchCount(right) ||
        (typeIndex.get(left.attackType) ?? 0) -
          (typeIndex.get(right.attackType) ?? 0),
    );

  return { byAttackType, sharedWeaknesses };
}

function isTypeEffectiveDamagingMove(move: SelectedMove): boolean {
  return move.category !== "status" && move.usesTypeEffectiveness !== false;
}

function typeEffectiveDamagingMoves(
  team: readonly TeamPokemon[],
): SelectedMove[] {
  return team.flatMap((member) =>
    member.moves.filter(isTypeEffectiveDamagingMove),
  );
}

function bestSelectedMoveMultiplier(
  chart: TypeChartInput,
  moves: readonly SelectedMove[],
  moveType: PokemonType,
  defendingTypes: readonly PokemonType[],
): number {
  return moves
    .filter((move) => move.type === moveType)
    .reduce(
      (best, move) =>
        Math.max(best, selectedMoveMultiplier(chart, move, defendingTypes)),
      0,
    );
}

function analyzeOffense(
  moves: readonly SelectedMove[],
  chart: TypeChartInput,
  types: readonly PokemonType[],
): OffensiveCoverageAnalysis {
  const selectedMoveTypes = new Set(moves.map((move) => move.type));
  const damagingMoveTypes = types.filter((type) => selectedMoveTypes.has(type));

  const byDefendingType = types.map<MonoTypeCoverageReport>((defendingType) => {
    const matchups = damagingMoveTypes.map((moveType) => ({
      moveType,
      multiplier: bestSelectedMoveMultiplier(
        chart,
        moves,
        moveType,
        [defendingType],
      ),
    }));
    const bestMultiplier = matchups.reduce(
      (best, matchup) => Math.max(best, matchup.multiplier),
      0,
    );
    return {
      defendingType,
      coveredSuperEffectively: bestMultiplier > 1,
      bestMultiplier,
      bestMoveTypes: matchups
        .filter((matchup) => matchup.multiplier === bestMultiplier)
        .map((matchup) => matchup.moveType),
      matchups,
    };
  });

  return {
    damagingMoveTypes,
    byDefendingType,
    coveredTypes: byDefendingType
      .filter((report) => report.coveredSuperEffectively)
      .map((report) => report.defendingType),
    gapTypes: byDefendingType
      .filter((report) => !report.coveredSuperEffectively)
      .map((report) => report.defendingType),
  };
}

function analyzeStab(team: readonly TeamPokemon[]): StabMemberReport[] {
  return team.map((member) => {
    const damagingTypes = new Set(
      member.moves
        .filter(isTypeEffectiveDamagingMove)
        .map((move) => move.type),
    );
    const pokemonTypes = uniqueInOrder(member.types);
    const damagingStabTypes = pokemonTypes.filter((type) =>
      damagingTypes.has(type),
    );
    const missingStabTypes = pokemonTypes.filter(
      (type) => !damagingTypes.has(type),
    );
    return {
      memberId: member.id,
      memberName: member.name,
      pokemonTypes,
      damagingStabTypes,
      missingStabTypes,
      hasDamagingStab: damagingStabTypes.length > 0,
    };
  });
}

function analyzeMovesets(
  team: readonly TeamPokemon[],
  movesPerPokemon: number,
): MovesetMemberReport[] {
  return team.map((member) => {
    const damagingMoveCount = member.moves.filter(
      (move) => move.category !== "status",
    ).length;
    const statusMoveCount = member.moves.length - damagingMoveCount;
    const openMoveSlots = Math.max(0, movesPerPokemon - member.moves.length);
    const issues: MovesetIssue[] = [];

    if (member.moves.length === 0) {
      issues.push({ kind: "no-moves", message: "No moves are selected." });
    } else if (damagingMoveCount === 0) {
      issues.push({
        kind: "no-damaging-moves",
        message: "The selected set has no damaging move.",
      });
    }

    if (openMoveSlots > 0) {
      issues.push({
        kind: "open-move-slots",
        message: `${openMoveSlots} move slot${openMoveSlots === 1 ? " is" : "s are"} still open.`,
      });
    }

    return {
      memberId: member.id,
      memberName: member.name,
      selectedMoveCount: member.moves.length,
      damagingMoveCount,
      statusMoveCount,
      openMoveSlots,
      issues,
    };
  });
}

function analyzeUtility(
  team: readonly TeamPokemon[],
  utilityTargets: readonly UtilityTarget[],
): UtilityAnalysis {
  const contributionMap = new Map<UtilityRole, UtilityContribution>();

  for (const member of team) {
    for (const move of member.moves) {
      for (const role of uniqueInOrder(move.utilityRoles ?? [])) {
        const contribution = contributionMap.get(role) ?? {
          role,
          memberIds: [],
          memberNames: [],
          moveNames: [],
        };
        contributionMap.set(role, {
          role,
          memberIds: uniqueInOrder([...contribution.memberIds, member.id]),
          memberNames: uniqueInOrder([
            ...contribution.memberNames,
            member.name,
          ]),
          moveNames: uniqueInOrder([...contribution.moveNames, move.name]),
        });
      }
    }
  }

  const coveredRoles = [...contributionMap.keys()];
  const uniqueTargets = utilityTargets.filter(
    (target, index) =>
      utilityTargets.findIndex((candidate) => candidate.role === target.role) ===
      index,
  );
  const targetRoles = uniqueTargets.map((target) => target.role);
  const missingRoles = targetRoles.filter(
    (role) => !contributionMap.has(role),
  );

  return {
    coveredRoles,
    missingRoles,
    contributions: [...contributionMap.values()],
    gaps: uniqueTargets
      .filter((target) => !contributionMap.has(target.role))
      .map((target) => ({
        role: target.role,
        label: target.label,
        description: target.description,
      })),
  };
}

function formatTypeList(types: readonly PokemonType[]): string {
  if (types.length <= 1) return types[0] ?? "";
  if (types.length === 2) return `${types[0]} and ${types[1]}`;
  return `${types.slice(0, -1).join(", ")}, and ${types.at(-1)}`;
}

function buildGapInsights(
  stabReports: readonly StabMemberReport[],
  movesetReports: readonly MovesetMemberReport[],
  utility: UtilityAnalysis,
): GapInsight[] {
  const stabInsights: GapInsight[] = stabReports
    .filter((report) => report.missingStabTypes.length > 0)
    .map((report) => ({
      id: `stab:${report.memberId}:${report.missingStabTypes.join("+")}`,
      category: "stab",
      severity: report.hasDamagingStab ? "info" : "warning",
      title: report.hasDamagingStab
        ? `${report.memberName} lacks full STAB coverage`
        : `${report.memberName} has no damaging STAB move`,
      description: `${report.memberName} has no selected damaging ${formatTypeList(report.missingStabTypes)}-type move.`,
      memberIds: [report.memberId],
      memberNames: [report.memberName],
      types: report.missingStabTypes,
    }));

  const movesetInsights: GapInsight[] = movesetReports.flatMap((report) =>
    report.issues.map((issue) => ({
      id: `moveset:${report.memberId}:${issue.kind}`,
      category: "moveset" as const,
      severity:
        issue.kind === "open-move-slots" ? ("info" as const) : ("warning" as const),
      title:
        issue.kind === "no-moves"
          ? `${report.memberName} needs a moveset`
          : issue.kind === "no-damaging-moves"
            ? `${report.memberName} cannot deal direct damage`
            : `${report.memberName} has open move slots`,
      description: issue.message,
      memberIds: [report.memberId],
      memberNames: [report.memberName],
      types: [],
    })),
  );

  const utilityInsights: GapInsight[] = utility.gaps.map((gap) => ({
    id: `utility:${gap.role}`,
    category: "utility",
    severity: "info",
    title: gap.label,
    description: gap.description,
    memberIds: [],
    memberNames: [],
    types: [],
  }));

  return [...stabInsights, ...movesetInsights, ...utilityInsights];
}

function analyzeGaps(
  team: readonly TeamPokemon[],
  options: ResolvedOptions,
): TeamGapAnalysis {
  const stabReports = analyzeStab(team);
  const movesetReports = analyzeMovesets(team, options.movesPerPokemon);
  const utility = analyzeUtility(team, options.utilityTargets);

  return {
    stab: {
      byMember: stabReports,
      gaps: stabReports.filter((report) => report.missingStabTypes.length > 0),
    },
    movesets: {
      byMember: movesetReports,
      gaps: movesetReports.filter((report) => report.issues.length > 0),
    },
    utility,
    insights: buildGapInsights(stabReports, movesetReports, utility),
  };
}

function roundedScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function attackPressureScore(
  threatened: readonly MemberMatchup[],
  safeSwitches: readonly MemberMatchup[],
  teamSize: number,
): number {
  if (teamSize === 0) return 0;

  const threatenedRatio = threatened.length / teamSize;
  const noSafeSwitchRatio = 1 - safeSwitches.length / teamSize;
  const severityRatio =
    threatened.reduce(
      (total, matchup) =>
        total + Math.min(1, Math.max(0, Math.log2(matchup.multiplier) / 2)),
      0,
    ) / teamSize;

  return roundedScore(
    threatenedRatio * 55 + severityRatio * 25 + noSafeSwitchRatio * 20,
  );
}

function namesInParentheses(matchups: readonly MemberMatchup[]): string {
  if (matchups.length === 0) return "none";
  return matchups
    .map((matchup) => `${matchup.memberName} (${matchup.multiplier}x)`)
    .join(", ");
}

function attackingBreakers(
  defense: DefensiveAnalysis,
  teamSize: number,
  options: ResolvedOptions,
  typeIndex: ReadonlyMap<PokemonType, number>,
): AttackTypeBreaker[] {
  return defense.byAttackType
    .filter(
      (report) => report.weak.count >= options.minimumThreatenedMembers,
    )
    .map<AttackTypeBreaker>((report) => {
      const safeSwitchMembers = [
        ...report.resist.members,
        ...report.immune.members,
      ].sort(
        (left, right) =>
          report.matchups.indexOf(left) - report.matchups.indexOf(right),
      );
      return {
        kind: "attacking-type",
        attackType: report.attackType,
        pressureScore: attackPressureScore(
          report.weak.members,
          safeSwitchMembers,
          teamSize,
        ),
        threatenedCount: report.weak.count,
        safeSwitchCount: safeSwitchMembers.length,
        neutralCount: report.neutral.count,
        threatenedMembers: report.weak.members,
        safeSwitchMembers,
        explanation: `${report.attackType} attacks hit ${report.weak.count} of ${teamSize} team members super effectively: ${namesInParentheses(report.weak.members)}. Resistant or immune switch-ins: ${namesInParentheses(safeSwitchMembers)}.`,
      };
    })
    .sort(
      (left, right) =>
        right.pressureScore - left.pressureScore ||
        right.threatenedCount - left.threatenedCount ||
        left.safeSwitchCount - right.safeSwitchCount ||
        (typeIndex.get(left.attackType) ?? 0) -
          (typeIndex.get(right.attackType) ?? 0),
    )
    .slice(0, options.breakerLimit);
}

function allTypeCombinations(
  types: readonly PokemonType[],
): DefensiveTypeCombination[] {
  const combinations: DefensiveTypeCombination[] = [];

  for (let firstIndex = 0; firstIndex < types.length; firstIndex += 1) {
    combinations.push([types[firstIndex]]);
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < types.length;
      secondIndex += 1
    ) {
      combinations.push([types[firstIndex], types[secondIndex]]);
    }
  }
  return combinations;
}

function assertValidDefensiveTypeCombinations(
  combinations: readonly DefensiveTypeCombination[] | undefined,
  chart: TypeChartInput,
  types: readonly PokemonType[],
): void {
  if (combinations === undefined) return;

  const knownTypes = new Set(types);
  for (const combination of combinations) {
    if (combination.length < 1 || combination.length > 2) {
      throw new Error(
        `Defensive type combination ${combination.join("/")} must contain one or two types for generation ${chart.generation}.`,
      );
    }
    if (uniqueInOrder(combination).length !== combination.length) {
      throw new Error(
        `Defensive type combination ${combination.join("/")} repeats a type for generation ${chart.generation}.`,
      );
    }
    for (const type of combination) {
      if (!knownTypes.has(type)) {
        throw new Error(
          `Unknown defensive combination type "${type}" for generation ${chart.generation}.`,
        );
      }
    }
  }
}

function defensiveResistanceScore(
  multipliers: readonly number[],
): number {
  if (multipliers.length === 0) return 0;
  const resistance = multipliers.reduce((total, multiplier) => {
    if (multiplier === 0) return total + 1;
    if (multiplier >= 1) return total;
    return total + Math.min(1, -Math.log2(multiplier) / 2);
  }, 0);
  return roundedScore((resistance / multipliers.length) * 100);
}

function defensiveBreakers(
  coverage: OffensiveCoverageAnalysis,
  moves: readonly SelectedMove[],
  chart: TypeChartInput,
  types: readonly PokemonType[],
  options: ResolvedOptions,
): DefensiveTypeBreaker[] {
  if (coverage.damagingMoveTypes.length === 0) return [];

  const defendingTypeCombinations =
    options.defensiveTypeCombinations ?? allTypeCombinations(types);

  return defendingTypeCombinations
    .map<DefensiveTypeBreaker | null>((defendingTypes) => {
      const matchups = coverage.damagingMoveTypes.map((attackingMoveType) => {
        const multiplier = bestSelectedMoveMultiplier(
          chart,
          moves,
          attackingMoveType,
          defendingTypes,
        );
        return {
          attackingMoveType,
          multiplier,
          outcome: matchupOutcome(multiplier),
        };
      });
      if (
        matchups.some((matchup) => matchup.outcome === "weak") ||
        matchups.every((matchup) => matchup.outcome === "neutral")
      ) {
        return null;
      }

      const resistedMoveTypes = matchups
        .filter((matchup) => matchup.outcome === "resist")
        .map((matchup) => matchup.attackingMoveType);
      const immuneMoveTypes = matchups
        .filter((matchup) => matchup.outcome === "immune")
        .map((matchup) => matchup.attackingMoveType);
      const neutralMoveTypes = matchups
        .filter((matchup) => matchup.outcome === "neutral")
        .map((matchup) => matchup.attackingMoveType);
      const blockedMoveTypes = [...resistedMoveTypes, ...immuneMoveTypes];

      return {
        kind: "defensive-type-combination",
        types: defendingTypes,
        resistanceScore: defensiveResistanceScore(
          matchups.map((matchup) => matchup.multiplier),
        ),
        resistedMoveTypes,
        immuneMoveTypes,
        neutralMoveTypes,
        matchups,
        explanation: `${defendingTypes.join("/")} resists or nullifies ${blockedMoveTypes.length} of ${coverage.damagingMoveTypes.length} selected attacking types (${formatTypeList(blockedMoveTypes)}), with no selected type hitting it super effectively.`,
      };
    })
    .filter((breaker): breaker is DefensiveTypeBreaker => breaker !== null)
    .sort(
      (left, right) =>
        right.resistanceScore - left.resistanceScore ||
        right.immuneMoveTypes.length - left.immuneMoveTypes.length ||
        right.resistedMoveTypes.length - left.resistedMoveTypes.length ||
        left.types
          .map((type) => types.indexOf(type))
          .join("-")
          .localeCompare(
            right.types.map((type) => types.indexOf(type)).join("-"),
            "en",
            { numeric: true },
          ),
    )
    .slice(0, options.breakerLimit);
}

function analyzeBreakers(
  defense: DefensiveAnalysis,
  coverage: OffensiveCoverageAnalysis,
  moves: readonly SelectedMove[],
  teamSize: number,
  chart: TypeChartInput,
  types: readonly PokemonType[],
  options: ResolvedOptions,
): BreakerAnalysis {
  const typeIndex = new Map(types.map((type, index) => [type, index]));
  return {
    attackingTypes: attackingBreakers(
      defense,
      teamSize,
      options,
      typeIndex,
    ),
    defensiveTypeCombinations: defensiveBreakers(
      coverage,
      moves,
      chart,
      types,
      options,
    ),
  };
}

/**
 * Produces a deterministic, serializable team report. No Pokemon data or type
 * rules are fetched here; callers supply the chart for the selected generation.
 */
export function analyzeTeam(
  team: readonly TeamPokemon[],
  chart: TypeChartInput,
  options?: AnalysisOptions,
): TeamAnalysis {
  assertValidAnalysisInput(team, chart);
  const resolvedOptions = resolveOptions(options);
  const types = chartTypes(chart);
  assertValidDefensiveTypeCombinations(
    resolvedOptions.defensiveTypeCombinations,
    chart,
    types,
  );
  const defense = analyzeDefense(team, chart, types);
  const moves = typeEffectiveDamagingMoves(team);
  const offense = analyzeOffense(moves, chart, types);

  return {
    generation: chart.generation,
    teamSize: team.length,
    defense,
    offense,
    gaps: analyzeGaps(team, resolvedOptions),
    breakers: analyzeBreakers(
      defense,
      offense,
      moves,
      team.length,
      chart,
      types,
      resolvedOptions,
    ),
  };
}
