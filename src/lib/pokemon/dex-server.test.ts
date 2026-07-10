import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDexCatalog, getPokemonMoves } from "./dex-server";
import type { DexCatalogResponse } from "./types";

describe("generation-aware dex data", () => {
  let gen1: DexCatalogResponse;
  let gen4: DexCatalogResponse;
  let gen6: DexCatalogResponse;

  beforeAll(() => {
    gen1 = getDexCatalog(1);
    gen4 = getDexCatalog(4);
    gen6 = getDexCatalog(6);
  });

  it("returns complete standard catalogs for historical generations", () => {
    expect(gen1.pokemon).toHaveLength(151);
    expect(gen1.pokemon[0]).toMatchObject({
      id: "bulbasaur",
      number: 1,
      types: ["Grass", "Poison"],
    });
    expect(gen4.pokemon.some((pokemon) => pokemon.id === "garchomp")).toBe(true);
    expect(gen4.pokemon.some((pokemon) => pokemon.id === "sylveon")).toBe(false);
  });

  it("keeps every generation catalog internally consistent", () => {
    for (const generation of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      const catalog = getDexCatalog(generation);
      const ids = new Set(catalog.pokemon.map((pokemon) => pokemon.id));

      expect(ids.size).toBe(catalog.pokemon.length);
      expect(catalog.pokemon.length).toBeGreaterThanOrEqual(
        generation === 1 ? 151 : 200,
      );
      expect(
        catalog.pokemon.every(
          (pokemon) =>
            pokemon.introducedIn <= generation &&
            pokemon.types.every((type) => catalog.types.includes(type)) &&
            pokemon.sprite.startsWith("https://"),
        ),
      ).toBe(true);
      expect(Object.keys(catalog.typeChart)).toEqual(catalog.types);
    }
  });

  it("uses the selected generation's available types and type chart", () => {
    expect(gen1.types).not.toContain("Dark");
    expect(gen1.types).not.toContain("Steel");
    expect(gen1.types).not.toContain("Fairy");
    expect(gen6.types).toContain("Fairy");
    expect(gen1.typeChart.Electric.Ground).toBe(0);
    expect(gen6.typeChart.Fairy.Dragon).toBe(2);
  });

  it("returns historical move metadata and legal learn sources", async () => {
    const response = await getPokemonMoves(4, "pikachu");
    const thunderbolt = response?.moves.find((move) => move.id === "thunderbolt");

    expect(response?.moves.length).toBeGreaterThan(50);
    expect(thunderbolt).toMatchObject({
      type: "Electric",
      category: "Special",
      power: 95,
      accuracy: 100,
    });
    expect(thunderbolt?.methods.length).toBeGreaterThan(0);
    expect(response?.moves.some((move) => move.type === "Fairy")).toBe(false);
    expect(response?.moves).toContainEqual(
      expect.objectContaining({
        id: "hiddenpowerice",
        name: "Hidden Power Ice",
        type: "Ice",
        power: 70,
      }),
    );
    expect(response?.moves).not.toContainEqual(
      expect.objectContaining({ id: "hiddenpower", type: "Normal" }),
    );
  });

  it("rejects Pokémon that are not standard in a generation", async () => {
    await expect(getPokemonMoves(1, "garchomp")).resolves.toBeNull();
  });

  it("does not leak a base regional form's learnset into its variant", async () => {
    const alolanVulpix = await getPokemonMoves(7, "vulpixalola");

    expect(alolanVulpix?.moves.some((move) => move.id === "freezedry")).toBe(true);
    expect(alolanVulpix?.moves.some((move) => move.id === "ember")).toBe(false);
  });

  it("inherits legal moves for size and cosmetic battle forms", async () => {
    const pumpkabooSmall = await getPokemonMoves(6, "pumpkaboosmall");
    const squawkabillyBlue = await getPokemonMoves(9, "squawkabillyblue");

    expect(pumpkabooSmall?.moves.some((move) => move.id === "flamethrower")).toBe(
      true,
    );
    expect(pumpkabooSmall?.moves.length).toBeGreaterThan(50);
    expect(squawkabillyBlue?.moves.some((move) => move.id === "bravebird")).toBe(
      true,
    );
  });

  it("serializes move-specific effectiveness mechanics", async () => {
    const [lapras, hawlucha, zygarde, chansey] = await Promise.all([
      getPokemonMoves(9, "lapras"),
      getPokemonMoves(6, "hawlucha"),
      getPokemonMoves(7, "zygarde"),
      getPokemonMoves(1, "chansey"),
    ]);

    expect(lapras?.moves.find((move) => move.id === "freezedry")).toMatchObject({
      usesTypeEffectiveness: true,
      effectivenessOverrides: { Water: 2 },
    });
    expect(hawlucha?.moves.find((move) => move.id === "flyingpress")).toMatchObject(
      { secondaryEffectivenessType: "Flying" },
    );
    expect(zygarde?.moves.find((move) => move.id === "thousandarrows")).toMatchObject(
      { effectivenessOverrides: { Flying: 1 } },
    );
    expect(chansey?.moves.find((move) => move.id === "seismictoss")).toMatchObject(
      { usesTypeEffectiveness: false },
    );
  });

  it("resolves form-dependent move types", async () => {
    const [ogerpon, tauros] = await Promise.all([
      getPokemonMoves(9, "ogerponwellspring"),
      getPokemonMoves(9, "taurospaldeablaze"),
    ]);

    expect(ogerpon?.moves.find((move) => move.id === "ivycudgel")?.type).toBe(
      "Water",
    );
    expect(tauros?.moves.find((move) => move.id === "ragingbull")?.type).toBe(
      "Fire",
    );
  });
});
