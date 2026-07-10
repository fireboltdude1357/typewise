import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const generationValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
  v.literal(5),
  v.literal(6),
  v.literal(7),
  v.literal(8),
  v.literal(9),
);

export const catalogScopeValidator = v.union(
  v.literal("national"),
  v.literal("core"),
);

export const moveValidator = v.object({
  moveId: v.string(),
  moveName: v.string(),
});

export const teamSlotValidator = v.object({
  pokemonId: v.string(),
  pokemonName: v.string(),
  moves: v.array(moveValidator),
});

export default defineSchema({
  savedTeams: defineTable({
    ownerId: v.string(),
    name: v.string(),
    generation: generationValidator,
    scope: v.optional(catalogScopeValidator),
    slots: v.array(teamSlotValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner_updated_at", ["ownerId", "updatedAt"]),
});
