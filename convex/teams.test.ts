/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.test.ts"]);

const validTeam = {
  name: "Kanto core",
  generation: 1 as const,
  scope: "national" as const,
  slots: [
    {
      pokemonId: "pikachu",
      pokemonName: "Pikachu",
      moves: [{ moveId: "thunderbolt", moveName: "Thunderbolt" }],
    },
  ],
};

describe("saved team authorization and validation", () => {
  it("requires authentication for every user-facing operation", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.teams.list, {})).rejects.toThrow();
    await expect(t.mutation(api.teams.create, validTeam)).rejects.toThrow();
  });

  it("isolates reads, updates, and deletes by Clerk subject", async () => {
    const t = convexTest(schema, modules);
    const alice = t.withIdentity({ subject: "user_alice", issuer: "test" });
    const bob = t.withIdentity({ subject: "user_bob", issuer: "test" });

    const teamId = await alice.mutation(api.teams.create, validTeam);
    expect(await alice.query(api.teams.get, { teamId })).toMatchObject({
      ownerId: "user_alice",
      name: "Kanto core",
    });
    expect(await bob.query(api.teams.get, { teamId })).toBeNull();
    await expect(
      bob.mutation(api.teams.update, { teamId, name: "Stolen" }),
    ).rejects.toThrow();
    await expect(bob.mutation(api.teams.remove, { teamId })).rejects.toThrow();
    expect(await alice.query(api.teams.get, { teamId })).not.toBeNull();
  });

  it("defaults legacy clients without a scope to National", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "user_legacy", issuer: "test" });
    const legacyTeam = {
      name: validTeam.name,
      generation: validTeam.generation,
      slots: validTeam.slots,
    };

    const teamId = await user.mutation(api.teams.create, legacyTeam);

    expect(await user.query(api.teams.get, { teamId })).toMatchObject({
      scope: "national",
      format: "casual",
    });
  });

  it("round-trips competitive mode and set configuration", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "user_competitive", issuer: "test" });
    const competitiveSet = { ability: "Static", item: "Choice Scarf", nature: "Timid" as const, evPreset: "fast-special" as const };
    const teamId = await user.mutation(api.teams.create, { ...validTeam, format: "singles", slots: [{ ...validTeam.slots[0], competitiveSet }] });
    expect(await user.query(api.teams.get, { teamId })).toMatchObject({ format: "singles", slots: [{ competitiveSet }] });
    await user.mutation(api.teams.update, { teamId, format: "doubles", slots: [{ ...validTeam.slots[0], competitiveSet: { ...competitiveSet, item: "Sitrus Berry" } }] });
    expect(await user.query(api.teams.get, { teamId })).toMatchObject({ format: "doubles", slots: [{ competitiveSet: { item: "Sitrus Berry" } }] });
  });

  it("canonicalizes IDs and rejects duplicate forms or move variants", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "user_one", issuer: "test" });

    const teamId = await user.mutation(api.teams.create, {
      ...validTeam,
      slots: [
        {
          pokemonId: "Pika-Chu",
          pokemonName: "Pikachu",
          moves: [{ moveId: "Thunder-Bolt", moveName: "Thunderbolt" }],
        },
      ],
    });
    expect(await user.query(api.teams.get, { teamId })).toMatchObject({
      slots: [
        {
          pokemonId: "pikachu",
          moves: [{ moveId: "thunderbolt" }],
        },
      ],
    });

    await expect(
      user.mutation(api.teams.create, {
        ...validTeam,
        slots: [validTeam.slots[0], validTeam.slots[0]],
      }),
    ).rejects.toThrow();
    await expect(
      user.mutation(api.teams.create, {
        ...validTeam,
        slots: [
          {
            ...validTeam.slots[0],
            moves: [
              { moveId: "hiddenpowerice", moveName: "Hidden Power Ice" },
              { moveId: "hiddenpowerfire", moveName: "Hidden Power Fire" },
            ],
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it("enforces team, moveset, and saved-team limits", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "user_limits", issuer: "test" });

    await expect(
      user.mutation(api.teams.create, {
        ...validTeam,
        slots: Array.from({ length: 7 }, (_, index) => ({
          pokemonId: `pokemon${index}`,
          pokemonName: `Pokemon ${index}`,
          moves: [],
        })),
      }),
    ).rejects.toThrow();

    for (let index = 0; index < 50; index += 1) {
      await user.mutation(api.teams.create, {
        ...validTeam,
        name: `Team ${index}`,
      });
    }
    await expect(
      user.mutation(api.teams.create, { ...validTeam, name: "Team 51" }),
    ).rejects.toThrow();
    expect(await user.query(api.teams.list, {})).toHaveLength(50);
  });
});
