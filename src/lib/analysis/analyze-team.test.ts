import { describe, expect, it } from "vitest";

import { analyzeTeam, type TypeChartInput, type TeamPokemon } from ".";

const chart: TypeChartInput = {
  generation: 9,
  types: [
    "Normal",
    "Fire",
    "Water",
    "Grass",
    "Electric",
    "Ground",
    "Flying",
    "Bug",
    "Steel",
    "Ghost",
  ],
  multipliers: {
    Normal: { Ghost: 0, Steel: 0.5 },
    Fire: {
      Fire: 0.5,
      Water: 0.5,
      Grass: 2,
      Bug: 2,
      Steel: 2,
    },
    Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2 },
    Grass: {
      Fire: 0.5,
      Water: 2,
      Grass: 0.5,
      Ground: 2,
      Flying: 0.5,
      Bug: 0.5,
      Steel: 0.5,
    },
    Electric: {
      Water: 2,
      Grass: 0.5,
      Electric: 0.5,
      Ground: 0,
      Flying: 2,
    },
    Ground: {
      Fire: 2,
      Grass: 0.5,
      Electric: 2,
      Flying: 0,
      Steel: 2,
    },
    Flying: { Grass: 2, Electric: 0.5, Bug: 2, Steel: 0.5 },
    Bug: { Fire: 0.5, Grass: 2, Flying: 0.5, Steel: 0.5 },
    Steel: { Fire: 0.5, Water: 0.5, Steel: 0.5 },
    Ghost: { Normal: 0, Ghost: 2 },
  },
};

const mechanicsChart: TypeChartInput = {
  generation: 9,
  types: [
    "Normal",
    "Water",
    "Ice",
    "Ground",
    "Flying",
    "Fighting",
    "Grass",
    "Rock",
    "Steel",
    "Bug",
    "Ghost",
  ],
  multipliers: {
    Normal: { Rock: 0.5, Steel: 0.5, Ghost: 0 },
    Water: { Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2 },
    Ice: {
      Water: 0.5,
      Ice: 0.5,
      Ground: 2,
      Flying: 2,
      Grass: 2,
      Steel: 0.5,
    },
    Ground: {
      Flying: 0,
      Grass: 0.5,
      Rock: 2,
      Steel: 2,
      Bug: 0.5,
    },
    Flying: { Fighting: 2, Grass: 2, Rock: 0.5, Steel: 0.5, Bug: 2 },
    Fighting: {
      Normal: 2,
      Ice: 2,
      Flying: 0.5,
      Rock: 2,
      Steel: 2,
      Bug: 0.5,
      Ghost: 0,
    },
    Grass: { Water: 2, Ground: 2, Flying: 0.5, Grass: 0.5, Steel: 0.5 },
    Ghost: { Normal: 0, Ghost: 2 },
  },
};

function pokemon(
  id: string,
  name: string,
  types: TeamPokemon["types"],
  moves: TeamPokemon["moves"] = [],
): TeamPokemon {
  return { id, name, types, moves };
}

function reportFor(
  analysis: ReturnType<typeof analyzeTeam>,
  attackType: string,
) {
  const report = analysis.defense.byAttackType.find(
    (candidate) => candidate.attackType === attackType,
  );
  expect(report).toBeDefined();
  return report!;
}

describe("analyzeTeam", () => {
  it("returns a complete, useful empty-team result", () => {
    const result = analyzeTeam([], chart);

    expect(result.generation).toBe(9);
    expect(result.teamSize).toBe(0);
    expect(result.defense.byAttackType).toHaveLength(chart.types.length);
    expect(
      result.defense.byAttackType.every(
        (entry) =>
          entry.weak.count === 0 &&
          entry.resist.count === 0 &&
          entry.immune.count === 0 &&
          entry.neutral.count === 0,
      ),
    ).toBe(true);
    expect(result.offense.damagingMoveTypes).toEqual([]);
    expect(result.offense.gapTypes).toEqual(chart.types);
    expect(result.offense.byDefendingType[0]).toMatchObject({
      bestMultiplier: 0,
      bestMoveTypes: [],
      coveredSuperEffectively: false,
    });
    expect(result.breakers.attackingTypes).toEqual([]);
    expect(result.breakers.defensiveTypeCombinations).toEqual([]);
  });

  it("describes a partial Pokemon and its unfinished moveset", () => {
    const result = analyzeTeam([
      pokemon("bulbasaur", "Bulbasaur", ["Grass"]),
    ], chart);

    expect(result.gaps.stab.gaps).toEqual([
      expect.objectContaining({
        memberName: "Bulbasaur",
        damagingStabTypes: [],
        missingStabTypes: ["Grass"],
        hasDamagingStab: false,
      }),
    ]);
    expect(result.gaps.movesets.gaps[0]).toMatchObject({
      selectedMoveCount: 0,
      damagingMoveCount: 0,
      openMoveSlots: 4,
      issues: [
        { kind: "no-moves", message: "No moves are selected." },
        {
          kind: "open-move-slots",
          message: "4 move slots are still open.",
        },
      ],
    });
    expect(result.gaps.insights.map((insight) => insight.id)).toContain(
      "stab:bulbasaur:Grass",
    );
  });

  it("multiplies both defensive types for 4x weaknesses and 0.25x resists", () => {
    const result = analyzeTeam([
      pokemon("scizor", "Scizor", ["Bug", "Steel"]),
      pokemon("charizard", "Charizard", ["Fire", "Flying"]),
    ], chart);

    const fire = reportFor(result, "Fire");
    expect(fire.weak).toMatchObject({
      count: 1,
      memberNames: ["Scizor"],
      members: [expect.objectContaining({ multiplier: 4, outcome: "weak" })],
    });

    const grass = reportFor(result, "Grass");
    expect(
      grass.resist.members.find(
        (matchup) => matchup.memberName === "Charizard",
      ),
    ).toMatchObject({ multiplier: 0.25, outcome: "resist" });
  });

  it("lets a dual-type immunity override the other type's weakness", () => {
    const result = analyzeTeam([
      pokemon("swampert", "Swampert", ["Water", "Ground"]),
    ], chart);

    const electric = reportFor(result, "Electric");
    expect(electric.weak.count).toBe(0);
    expect(electric.immune).toMatchObject({
      count: 1,
      memberNames: ["Swampert"],
      members: [
        expect.objectContaining({ multiplier: 0, outcome: "immune" }),
      ],
    });
  });

  it("uses the supplied generation's chart instead of hardcoded matchups", () => {
    const olderChart: TypeChartInput = {
      ...chart,
      generation: 5,
      multipliers: {
        ...chart.multipliers,
        Ghost: { Normal: 0, Ghost: 2, Steel: 0.5 },
      },
    };
    const team = [pokemon("scizor", "Scizor", ["Bug", "Steel"])] as const;

    const modernGhost = reportFor(analyzeTeam(team, chart), "Ghost");
    const olderGhost = reportFor(analyzeTeam(team, olderChart), "Ghost");

    expect(modernGhost.neutral.members[0].multiplier).toBe(1);
    expect(olderGhost.resist.members[0].multiplier).toBe(0.5);
  });

  it("ranks shared weaknesses by severity and then by available safe switches", () => {
    const severityResult = analyzeTeam([
      pokemon("heat-one", "Heat One", ["Fire", "Electric"]),
      pokemon("heat-two", "Heat Two", ["Fire", "Electric"]),
    ], chart);

    const severityOrder = severityResult.defense.sharedWeaknesses.map(
      (report) => report.attackType,
    );
    expect(severityOrder.indexOf("Ground")).toBeLessThan(
      severityOrder.indexOf("Water"),
    );
    expect(reportFor(severityResult, "Ground").weak.members).toEqual([
      expect.objectContaining({ multiplier: 4 }),
      expect.objectContaining({ multiplier: 4 }),
    ]);

    const safeSwitchResult = analyzeTeam([
      pokemon("grass-one", "Grass One", ["Grass"]),
      pokemon("grass-two", "Grass Two", ["Grass"]),
      pokemon("water-switch", "Water Switch", ["Water"]),
    ], chart);
    const safeSwitchOrder = safeSwitchResult.defense.sharedWeaknesses.map(
      (report) => report.attackType,
    );
    expect(safeSwitchOrder.indexOf("Flying")).toBeLessThan(
      safeSwitchOrder.indexOf("Fire"),
    );
    expect(reportFor(safeSwitchResult, "Flying").resist.count).toBe(0);
    expect(reportFor(safeSwitchResult, "Fire").resist.count).toBe(1);
  });

  it("excludes status moves from offense and damaging STAB coverage", () => {
    const result = analyzeTeam([
      pokemon("raichu", "Raichu", ["Electric"], [
        {
          id: "thunder-wave",
          name: "Thunder Wave",
          type: "Electric",
          category: "status",
          utilityRoles: ["speed-control"],
        },
      ]),
    ], chart);

    expect(result.offense.damagingMoveTypes).toEqual([]);
    expect(result.offense.coveredTypes).toEqual([]);
    expect(result.gaps.stab.byMember[0]).toMatchObject({
      damagingStabTypes: [],
      hasDamagingStab: false,
    });
    expect(result.gaps.movesets.byMember[0]).toMatchObject({
      damagingMoveCount: 0,
      statusMoveCount: 1,
    });
    expect(result.gaps.utility.coveredRoles).toEqual(["speed-control"]);
    expect(result.gaps.utility.missingRoles).not.toContain("speed-control");
  });

  it("deduplicates utility targets by role without dropping later roles", () => {
    const result = analyzeTeam([], chart, {
      utilityTargets: [
        {
          role: "recovery",
          label: "Recovery",
          description: "Needs recovery.",
        },
        {
          role: "recovery",
          label: "Duplicate recovery",
          description: "This duplicate is ignored.",
        },
        {
          role: "hazard-removal",
          label: "Hazard removal",
          description: "Needs hazard removal.",
        },
      ],
    });

    expect(result.gaps.utility.missingRoles).toEqual([
      "recovery",
      "hazard-removal",
    ]);
    expect(result.gaps.utility.gaps).toEqual([
      {
        role: "recovery",
        label: "Recovery",
        description: "Needs recovery.",
      },
      {
        role: "hazard-removal",
        label: "Hazard removal",
        description: "Needs hazard removal.",
      },
    ]);
  });

  it("reports mono-type super-effective coverage from damaging moves", () => {
    const result = analyzeTeam([
      pokemon("coverage", "Coverage Tester", ["Fire"], [
        {
          id: "flamethrower",
          name: "Flamethrower",
          type: "Fire",
          category: "special",
          power: 90,
        },
        {
          id: "surf",
          name: "Surf",
          type: "Water",
          category: "special",
          power: 90,
        },
        {
          id: "will-o-wisp",
          name: "Will-O-Wisp",
          type: "Fire",
          category: "status",
        },
      ]),
    ], chart);

    expect(result.offense.damagingMoveTypes).toEqual(["Fire", "Water"]);
    expect(result.offense.coveredTypes).toEqual([
      "Fire",
      "Grass",
      "Ground",
      "Bug",
      "Steel",
    ]);
    expect(result.offense.gapTypes).toEqual([
      "Normal",
      "Water",
      "Electric",
      "Flying",
      "Ghost",
    ]);
    expect(
      result.offense.byDefendingType.find(
        (entry) => entry.defendingType === "Grass",
      ),
    ).toMatchObject({
      bestMultiplier: 2,
      bestMoveTypes: ["Fire"],
      coveredSuperEffectively: true,
    });
  });

  it("uses Freeze-Dry's override against mono- and dual-type Water defenders", () => {
    const result = analyzeTeam(
      [
        pokemon("freeze-dry-user", "Freeze-Dry User", ["Ice"], [
          {
            id: "freeze-dry",
            name: "Freeze-Dry",
            type: "Ice",
            category: "special",
            power: 70,
            effectivenessOverrides: { Water: 2 },
          },
          {
            id: "ice-beam",
            name: "Ice Beam",
            type: "Ice",
            category: "special",
            power: 90,
          },
          {
            id: "surf",
            name: "Surf",
            type: "Water",
            category: "special",
            power: 90,
          },
        ]),
      ],
      mechanicsChart,
      { breakerLimit: 100 },
    );

    expect(
      result.offense.byDefendingType.find(
        (entry) => entry.defendingType === "Water",
      ),
    ).toMatchObject({
      bestMultiplier: 2,
      bestMoveTypes: ["Ice"],
      coveredSuperEffectively: true,
      matchups: [
        { moveType: "Water", multiplier: 0.5 },
        { moveType: "Ice", multiplier: 2 },
      ],
    });

    const waterIceWall = result.breakers.defensiveTypeCombinations.find(
      (breaker) => breaker.types.join("/") === "Water/Ice",
    );
    expect(waterIceWall).toMatchObject({
      resistedMoveTypes: ["Water"],
      neutralMoveTypes: ["Ice"],
      matchups: [
        { attackingMoveType: "Water", multiplier: 0.5, outcome: "resist" },
        { attackingMoveType: "Ice", multiplier: 1, outcome: "neutral" },
      ],
    });

    expect(
      result.breakers.defensiveTypeCombinations.some(
        (breaker) => breaker.types.join("/") === "Water/Ground",
      ),
    ).toBe(false);
  });

  it("combines both Flying Press effectiveness types across mono- and dual-type defenders", () => {
    const result = analyzeTeam(
      [
        pokemon("flying-press-user", "Flying Press User", ["Fighting"], [
          {
            id: "flying-press",
            name: "Flying Press",
            type: "Fighting",
            category: "physical",
            power: 100,
            secondaryEffectivenessType: "Flying",
          },
        ]),
      ],
      mechanicsChart,
      { breakerLimit: 100 },
    );

    expect(
      result.offense.byDefendingType.find(
        (entry) => entry.defendingType === "Normal",
      ),
    ).toMatchObject({
      bestMultiplier: 2,
      bestMoveTypes: ["Fighting"],
      coveredSuperEffectively: true,
    });
    expect(
      result.offense.byDefendingType.find(
        (entry) => entry.defendingType === "Rock",
      ),
    ).toMatchObject({
      bestMultiplier: 1,
      coveredSuperEffectively: false,
    });

    const flyingSteelWall = result.breakers.defensiveTypeCombinations.find(
      (breaker) => breaker.types.join("/") === "Flying/Steel",
    );
    expect(flyingSteelWall).toMatchObject({
      resistanceScore: 50,
      resistedMoveTypes: ["Fighting"],
      matchups: [
        {
          attackingMoveType: "Fighting",
          multiplier: 0.5,
          outcome: "resist",
        },
      ],
    });
  });

  it("lets Thousand Arrows hit Flying types without erasing the other defensive type", () => {
    const result = analyzeTeam(
      [
        pokemon("thousand-arrows-user", "Thousand Arrows User", ["Ground"], [
          {
            id: "thousand-arrows",
            name: "Thousand Arrows",
            type: "Ground",
            category: "physical",
            power: 90,
            effectivenessOverrides: { Flying: 1 },
          },
        ]),
      ],
      mechanicsChart,
      { breakerLimit: 100 },
    );

    expect(
      result.offense.byDefendingType.find(
        (entry) => entry.defendingType === "Flying",
      ),
    ).toMatchObject({
      bestMultiplier: 1,
      bestMoveTypes: ["Ground"],
      coveredSuperEffectively: false,
    });

    const flyingGrassWall = result.breakers.defensiveTypeCombinations.find(
      (breaker) => breaker.types.join("/") === "Flying/Grass",
    );
    expect(flyingGrassWall).toMatchObject({
      resistanceScore: 50,
      resistedMoveTypes: ["Ground"],
      immuneMoveTypes: [],
      matchups: [
        {
          attackingMoveType: "Ground",
          multiplier: 0.5,
          outcome: "resist",
        },
      ],
    });
  });

  it("excludes special-damage moves from coverage and STAB while retaining their type immunities", () => {
    const result = analyzeTeam(
      [
        pokemon(
          "special-damage-user",
          "Special Damage User",
          ["Fighting", "Ground"],
          [
            {
              id: "seismic-toss",
              name: "Seismic Toss",
              type: "Fighting",
              category: "physical",
              power: null,
              matchupMode: "immunity-only",
            },
            {
              id: "fissure",
              name: "Fissure",
              type: "Ground",
              category: "physical",
              power: null,
              matchupMode: "immunity-only",
            },
            {
              id: "night-shade",
              name: "Night Shade",
              type: "Ghost",
              category: "special",
              power: null,
              matchupMode: "immunity-only",
            },
          ],
        ),
      ],
      mechanicsChart,
      {
        breakerLimit: 100,
        defensiveTypeCombinations: [
          ["Normal"],
          ["Ghost"],
          ["Flying"],
          ["Ghost", "Flying"],
          ["Rock"],
        ],
      },
    );

    expect(result.offense.damagingMoveTypes).toEqual([]);
    expect(result.offense.coveredTypes).toEqual([]);
    expect(
      result.breakers.defensiveTypeCombinations.map((breaker) => ({
        types: breaker.types,
        immuneMoveTypes: breaker.immuneMoveTypes,
      })),
    ).toEqual([
      {
        types: ["Flying", "Ghost"],
        immuneMoveTypes: ["Ground", "Fighting"],
      },
      { types: ["Normal"], immuneMoveTypes: ["Ghost"] },
      { types: ["Flying"], immuneMoveTypes: ["Ground"] },
      { types: ["Ghost"], immuneMoveTypes: ["Fighting"] },
    ]);
    expect(result.gaps.stab.byMember[0]).toMatchObject({
      damagingStabTypes: [],
      missingStabTypes: ["Fighting", "Ground"],
      hasDamagingStab: false,
    });
    expect(result.gaps.movesets.byMember[0]).toMatchObject({
      damagingMoveCount: 3,
      statusMoveCount: 0,
    });
  });

  it("does not invent immunities for type-independent special damage", () => {
    const result = analyzeTeam(
      [
        pokemon("gen-one-ghost", "Gen I Ghost", ["Ghost"], [
          {
            id: "night-shade",
            name: "Night Shade",
            type: "Ghost",
            category: "special",
            power: null,
            matchupMode: "type-independent",
          },
        ]),
      ],
      mechanicsChart,
      {
        defensiveTypeCombinations: [["Normal"], ["Ghost"]],
      },
    );

    expect(result.offense.damagingMoveTypes).toEqual([]);
    expect(result.gaps.stab.byMember[0].hasDamagingStab).toBe(false);
    expect(result.breakers.defensiveTypeCombinations).toEqual([]);
  });

  it("accepts historical typeless status and type-independent moves", () => {
    const result = analyzeTeam(
      [
        pokemon("legacy-user", "Legacy User", ["Ghost"], [
          {
            id: "bide",
            name: "Bide",
            type: "???",
            category: "physical",
            power: null,
            matchupMode: "type-independent",
          },
          {
            id: "curse",
            name: "Curse",
            type: "???",
            category: "status",
            power: null,
            matchupMode: "type-independent",
          },
        ]),
      ],
      mechanicsChart,
    );

    expect(result.offense.damagingMoveTypes).toEqual([]);
    expect(result.gaps.movesets.byMember[0]).toMatchObject({
      damagingMoveCount: 1,
      statusMoveCount: 1,
    });
  });

  it("ranks and explains attacking and defensive breaker archetypes", () => {
    const result = analyzeTeam([
      pokemon("gyarados", "Gyarados", ["Water", "Flying"], [
        {
          id: "thunderbolt",
          name: "Thunderbolt",
          type: "Electric",
          category: "special",
          power: 90,
        },
      ]),
      pokemon("pelipper", "Pelipper", ["Water", "Flying"]),
    ], chart);

    expect(result.breakers.attackingTypes[0]).toMatchObject({
      attackType: "Electric",
      threatenedCount: 2,
      safeSwitchCount: 0,
      threatenedMembers: [
        expect.objectContaining({ memberName: "Gyarados", multiplier: 4 }),
        expect.objectContaining({ memberName: "Pelipper", multiplier: 4 }),
      ],
    });
    expect(result.breakers.attackingTypes[0].explanation).toContain(
      "Electric attacks hit 2 of 2 team members",
    );

    const groundWall = result.breakers.defensiveTypeCombinations.find(
      (breaker) =>
        breaker.types.length === 1 && breaker.types[0] === "Ground",
    );
    expect(groundWall).toMatchObject({
      resistanceScore: 100,
      immuneMoveTypes: ["Electric"],
      neutralMoveTypes: [],
    });
    expect(groundWall?.explanation).toContain(
      "with no selected type hitting it super effectively",
    );
  });

  it("normalizes and deduplicates supplied catalog type combinations", () => {
    const team = [
      pokemon("electric-user", "Electric User", ["Electric"], [
        {
          id: "thunderbolt",
          name: "Thunderbolt",
          type: "Electric",
          category: "special",
          power: 90,
        },
      ]),
    ];

    const unconstrained = analyzeTeam(team, chart, { breakerLimit: 100 });
    expect(
      unconstrained.breakers.defensiveTypeCombinations.some(
        (breaker) => breaker.types.join("/") === "Ground/Ghost",
      ),
    ).toBe(true);

    const constrained = analyzeTeam(team, chart, {
      breakerLimit: 100,
      defensiveTypeCombinations: [
        ["Ground"],
        ["Water"],
        ["Flying", "Ground"],
        ["Ground", "Flying"],
        ["Ground"],
      ],
    });
    expect(
      constrained.breakers.defensiveTypeCombinations.map(
        (breaker) => breaker.types,
      ),
    ).toEqual([["Ground"], ["Ground", "Flying"]]);
  });

  it("rejects generation-mismatched Pokemon and move types", () => {
    expect(() =>
      analyzeTeam(
        [pokemon("future", "Future Pokemon", ["Fairy"])],
        chart,
      ),
    ).toThrow('Unknown type "Fairy" on Future Pokemon for generation 9.');
  });

  it("rejects generation-mismatched move mechanics", () => {
    expect(() =>
      analyzeTeam(
        [
          pokemon("future", "Future Pokemon", ["Normal"], [
            {
              id: "future-press",
              name: "Future Press",
              type: "Normal",
              category: "physical",
              secondaryEffectivenessType: "Fairy",
            },
          ]),
        ],
        chart,
      ),
    ).toThrow(
      'Unknown secondary effectiveness type "Fairy" on Future Press for generation 9.',
    );

    expect(() =>
      analyzeTeam(
        [
          pokemon("future", "Future Pokemon", ["Normal"], [
            {
              id: "future-freeze",
              name: "Future Freeze",
              type: "Normal",
              category: "special",
              effectivenessOverrides: { Fairy: 2 },
            },
          ]),
        ],
        chart,
      ),
    ).toThrow(
      'Unknown effectiveness override type "Fairy" on Future Freeze for generation 9.',
    );
  });
});
