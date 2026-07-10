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

  it("returns complete National catalogs for historical generations", () => {
    expect(gen1.pokemon).toHaveLength(151);
    expect(gen1.pokemon[0]).toMatchObject({
      id: "bulbasaur",
      number: 1,
      types: ["Grass", "Poison"],
    });
    expect(gen4.pokemon.some((pokemon) => pokemon.id === "garchomp")).toBe(true);
    expect(gen4.pokemon.some((pokemon) => pokemon.id === "sylveon")).toBe(false);
  });

  it("locks the exhaustive National and core roster counts", () => {
    const nationalCounts = [151, 251, 392, 526, 695, 835, 995, 1183, 1379];
    const nationalSpeciesCounts = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
    const coreCounts = [151, 251, 392, 526, 694, 834, 988, 1032, 1103];
    const coreSpeciesCounts = [151, 251, 386, 493, 649, 721, 809, 845, 842];

    for (const generation of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      const national = getDexCatalog(generation, "national");
      const core = getDexCatalog(generation, "core");
      const index = generation - 1;

      expect(national.pokemon).toHaveLength(nationalCounts[index]);
      expect(new Set(national.pokemon.map((pokemon) => pokemon.number)).size).toBe(
        nationalSpeciesCounts[index],
      );
      expect(core.pokemon).toHaveLength(coreCounts[index]);
      expect(new Set(core.pokemon.map((pokemon) => pokemon.number)).size).toBe(
        coreSpeciesCounts[index],
      );
    }
  });

  it("unions each generation's supported core-title rosters", () => {
    const gen7Core = getDexCatalog(7, "core");
    const gen8Core = getDexCatalog(8, "core");
    const gen8National = getDexCatalog(8, "national");
    const gen9Core = getDexCatalog(9, "core");

    expect(gen7Core.pokemon.some((pokemon) => pokemon.id === "meltan")).toBe(true);
    expect(gen8Core.pokemon.some((pokemon) => pokemon.id === "unown")).toBe(true);
    expect(gen8Core.pokemon.some((pokemon) => pokemon.id === "ursaluna")).toBe(true);
    expect(gen8Core.pokemon.some((pokemon) => pokemon.id === "charizardgmax")).toBe(
      true,
    );
    expect(gen8Core.pokemon.some((pokemon) => pokemon.id === "urshifugmax")).toBe(
      true,
    );
    expect(gen8Core.pokemon.some((pokemon) => pokemon.id === "snivy")).toBe(false);
    expect(gen8National.pokemon.some((pokemon) => pokemon.id === "snivy")).toBe(
      true,
    );
    expect(gen9Core.pokemon.some((pokemon) => pokemon.id === "raichumegax")).toBe(
      true,
    );
    expect(
      gen9Core.pokemon.some((pokemon) => pokemon.id === "garchompmegaz"),
    ).toBe(true);
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

  it(
    "provides a nonempty, internally valid move list for every scoped entry",
    async () => {
      const problems: string[] = [];

      for (const scope of ["national", "core"] as const) {
        for (const generation of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
          const catalog = getDexCatalog(generation, scope);
          for (let start = 0; start < catalog.pokemon.length; start += 50) {
            const batch = catalog.pokemon.slice(start, start + 50);
            const responses = await Promise.all(
              batch.map((pokemon) =>
                getPokemonMoves(generation, pokemon.id, scope),
              ),
            );

            for (const [index, response] of responses.entries()) {
              const pokemon = batch[index];
              const label = `${scope} Gen ${generation} ${pokemon.id}`;
              if (!response || response.moves.length === 0) {
                problems.push(`${label}: empty move list`);
                continue;
              }
              const moveIds = new Set(response.moves.map((move) => move.id));
              if (moveIds.size !== response.moves.length) {
                problems.push(`${label}: duplicate moves`);
              }
              for (const move of response.moves) {
                if (move.methods.length === 0) {
                  problems.push(`${label} ${move.id}: no learn method`);
                }
                if (
                  move.sourceGenerations.some(
                    (sourceGeneration) => sourceGeneration > generation,
                  )
                ) {
                  problems.push(`${label} ${move.id}: future source`);
                }
              }
            }
          }
        }
      }

      expect(problems).toEqual([]);
    },
    120_000,
  );

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

  it("rejects Pokémon that are not in the requested generation or scope", async () => {
    await expect(getPokemonMoves(1, "garchomp")).resolves.toBeNull();
    await expect(getPokemonMoves(8, "snivy", "core")).resolves.toBeNull();
    await expect(getPokemonMoves(8, "snivy", "national")).resolves.not.toBeNull();
  });

  it("keeps battle-focused Champions sources in National scope only", async () => {
    const [nationalAbsol, coreAbsol] = await Promise.all([
      getPokemonMoves(9, "absol", "national"),
      getPokemonMoves(9, "absol", "core"),
    ]);

    expect(nationalAbsol?.moves.some((move) => move.id === "trailblaze")).toBe(
      true,
    );
    expect(coreAbsol?.moves.some((move) => move.id === "trailblaze")).toBe(false);
  });

  it("does not leak National transfers into a core-title-only species", async () => {
    const [coreUrsaluna, nationalUrsaluna] = await Promise.all([
      getPokemonMoves(8, "ursaluna", "core"),
      getPokemonMoves(8, "ursaluna", "national"),
    ]);

    expect(coreUrsaluna?.moves).toHaveLength(23);
    expect(coreUrsaluna?.moves.some((move) => move.id === "headlongrush")).toBe(
      true,
    );
    expect(
      coreUrsaluna?.moves.some((move) =>
        ["attract", "captivate", "confide", "cut"].includes(move.id),
      ),
    ).toBe(false);
    expect(
      nationalUrsaluna?.moves.some((move) => move.id === "attract"),
    ).toBe(true);
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

  it("applies validator-proven form additions and removals", async () => {
    const [
      kyuremBlack,
      gourgeistSmall,
      necrozmaUltra,
      battleBondGreninja,
      fancyVivillon,
      pokeballVivillon,
      rockruff,
      alolanRaichu,
      bloodmoonUrsaluna,
    ] = await Promise.all([
      getPokemonMoves(5, "kyuremblack"),
      getPokemonMoves(6, "gourgeistsmall"),
      getPokemonMoves(7, "necrozmaultra"),
      getPokemonMoves(7, "greninjabond"),
      getPokemonMoves(6, "vivillonfancy"),
      getPokemonMoves(6, "vivillonpokeball"),
      getPokemonMoves(7, "rockruff"),
      getPokemonMoves(7, "raichualola"),
      getPokemonMoves(9, "ursalunabloodmoon"),
    ]);

    expect(
      kyuremBlack?.moves.some((move) =>
        ["glaciate", "scaryface"].includes(move.id),
      ),
    ).toBe(false);
    expect(gourgeistSmall?.moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "bestow" }),
        expect.objectContaining({ id: "destinybond" }),
        expect.objectContaining({ id: "disable" }),
      ]),
    );
    expect(necrozmaUltra?.moves.some((move) => move.id === "photongeyser")).toBe(
      true,
    );
    expect(
      battleBondGreninja?.moves.some((move) => move.id === "toxicspikes"),
    ).toBe(false);
    expect(
      battleBondGreninja?.moves.some((move) => move.id === "watershuriken"),
    ).toBe(true);
    expect(
      fancyVivillon?.moves.some((move) =>
        ["harden", "irondefense", "ragepowder", "stringshot", "tackle"].includes(
          move.id,
        ),
      ),
    ).toBe(false);
    expect(pokeballVivillon?.moves.some((move) => move.id === "ragepowder")).toBe(
      false,
    );
    expect(pokeballVivillon?.moves.some((move) => move.id === "hurricane")).toBe(
      true,
    );
    expect(rockruff?.moves.some((move) => move.id === "happyhour")).toBe(false);
    expect(alolanRaichu?.moves.some((move) => move.id === "doublekick")).toBe(
      false,
    );
    expect(bloodmoonUrsaluna?.moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "bellydrum" }),
        expect.objectContaining({ id: "yawn" }),
      ]),
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
      matchupMode: "standard",
      effectivenessOverrides: { Water: 2 },
    });
    expect(hawlucha?.moves.find((move) => move.id === "flyingpress")).toMatchObject(
      { secondaryEffectivenessType: "Flying" },
    );
    expect(zygarde?.moves.find((move) => move.id === "thousandarrows")).toMatchObject(
      { effectivenessOverrides: { Flying: 1 } },
    );
    expect(chansey?.moves.find((move) => move.id === "seismictoss")).toMatchObject(
      { matchupMode: "type-independent" },
    );
  });

  it("uses generation move data to preserve special-damage immunity quirks", async () => {
    const [
      gen1Chansey,
      gen2Chansey,
      gen1Rhydon,
      gen1Gengar,
      gen2Gengar,
    ] = await Promise.all([
      getPokemonMoves(1, "chansey"),
      getPokemonMoves(2, "chansey"),
      getPokemonMoves(1, "rhydon"),
      getPokemonMoves(1, "gengar"),
      getPokemonMoves(2, "gengar"),
    ]);

    for (const moveId of ["seismictoss", "counter"]) {
      expect(
        gen1Chansey?.moves.find((move) => move.id === moveId),
      ).toMatchObject({ matchupMode: "type-independent" });
      expect(
        gen2Chansey?.moves.find((move) => move.id === moveId),
      ).toMatchObject({ matchupMode: "immunity-only" });
    }

    expect(gen1Rhydon?.moves.find((move) => move.id === "fissure")).toMatchObject(
      { matchupMode: "immunity-only" },
    );
    expect(gen1Gengar?.moves.find((move) => move.id === "nightshade")).toMatchObject(
      { matchupMode: "type-independent" },
    );
    expect(gen2Gengar?.moves.find((move) => move.id === "nightshade")).toMatchObject(
      { matchupMode: "immunity-only" },
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

  it("expands Smeargle's generation-specific Sketch pool", async () => {
    const [gen2Smeargle, gen3Smeargle, gen9Smeargle] = await Promise.all([
      getPokemonMoves(2, "smeargle"),
      getPokemonMoves(3, "smeargle"),
      getPokemonMoves(9, "smeargle"),
    ]);

    expect(gen2Smeargle?.moves.find((move) => move.id === "aeroblast")).toMatchObject({
      methods: ["Sketch"],
    });
    expect(gen3Smeargle?.moves.find((move) => move.id === "spore")).toMatchObject({
      methods: ["Sketch"],
    });
    expect(gen9Smeargle?.moves.find((move) => move.id === "spacialrend")).toMatchObject({
      methods: ["Sketch"],
    });
    expect(gen9Smeargle?.moves.some((move) => move.id === "revivalblessing")).toBe(
      false,
    );
    expect(gen9Smeargle?.moves.length).toBeGreaterThan(650);
  });

  it("constrains event-locked Hidden Power variants", async () => {
    const [gen6Xerneas, gen7Magearna, battleBondGreninja] = await Promise.all([
      getPokemonMoves(6, "xerneas"),
      getPokemonMoves(7, "magearna"),
      getPokemonMoves(7, "greninjabond"),
    ]);

    expect(gen6Xerneas?.moves.some((move) => move.id === "hiddenpowerfighting"))
      .toBe(false);
    expect(gen7Magearna?.moves.some((move) => move.id === "hiddenpowerfighting"))
      .toBe(false);
    expect(
      battleBondGreninja?.moves
        .filter((move) => move.id.startsWith("hiddenpower"))
        .map((move) => move.id),
    ).toEqual(["hiddenpowerghost"]);
  });

  it("provides working base-species image fallbacks for form sprites", () => {
    const totem = getDexCatalog(7).pokemon.find(
      (pokemon) => pokemon.id === "raticatealolatotem",
    );

    expect(totem?.spriteFallbacks).toContain(
      "https://play.pokemonshowdown.com/sprites/gen5/raticate-alola.png",
    );
    expect(totem?.spriteFallbacks).toContain(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/20.png",
    );
  });
});
