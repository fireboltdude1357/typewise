import { describe, expect, it } from "vitest";

import type { MoveSummary } from "./types";
import { toggleMoveSelection } from "./team";

function move(id: string): MoveSummary {
  return {
    id,
    name: id,
    type: "Normal",
    category: "Physical",
    power: 40,
    accuracy: 100,
    alwaysHits: false,
    pp: 20,
    priority: 0,
    description: "",
    methods: ["Level up"],
    sourceGenerations: [9],
    matchupMode: "standard",
  };
}

describe("toggleMoveSelection", () => {
  it("adds and removes an ordinary move", () => {
    expect(toggleMoveSelection([], move("tackle"))).toHaveLength(1);
    expect(toggleMoveSelection([move("tackle")], move("tackle"))).toEqual([]);
  });

  it("replaces rather than stacks Hidden Power variants", () => {
    const selected = toggleMoveSelection(
      [move("thunderbolt"), move("hiddenpowerice")],
      move("hiddenpowerfire"),
    );

    expect(selected.map((candidate) => candidate.id)).toEqual([
      "thunderbolt",
      "hiddenpowerfire",
    ]);
  });

  it("enforces the four-move limit", () => {
    const selected = [move("one"), move("two"), move("three"), move("four")];
    expect(toggleMoveSelection(selected, move("five"))).toBe(selected);
  });
});
