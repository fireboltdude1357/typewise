import { ConvexError, type Infer, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import {
  catalogScopeValidator,
  generationValidator,
  teamSlotValidator,
} from "./schema";

const MAX_TEAM_NAME_LENGTH = 80;
const MAX_TEAM_SIZE = 6;
const MAX_MOVES_PER_POKEMON = 4;
const MAX_IDENTIFIER_LENGTH = 100;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_SAVED_TEAMS_PER_USER = 50;

type TeamSlot = Infer<typeof teamSlotValidator>;
type AuthenticatedContext = Pick<QueryCtx | MutationCtx, "auth">;

async function requireUserId(ctx: AuthenticatedContext) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in to access saved teams.",
    });
  }

  return identity.subject;
}

function invalidArgument(message: string): never {
  throw new ConvexError({ code: "INVALID_ARGUMENT", message });
}

function normalizeRequiredString(
  value: string,
  label: string,
  maxLength: number,
) {
  const normalized = value.trim();

  if (normalized.length === 0) {
    invalidArgument(`${label} cannot be empty.`);
  }

  if (normalized.length > maxLength) {
    invalidArgument(`${label} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function normalizeTeamName(name: string) {
  return normalizeRequiredString(name, "Team name", MAX_TEAM_NAME_LENGTH);
}

function normalizeIdentifier(value: string, label: string) {
  const displayValue = normalizeRequiredString(
    value,
    label,
    MAX_IDENTIFIER_LENGTH,
  );
  const canonical = displayValue.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!canonical) invalidArgument(`${label} must contain letters or numbers.`);
  return canonical;
}

function normalizeSlots(slots: TeamSlot[]): TeamSlot[] {
  if (slots.length > MAX_TEAM_SIZE) {
    invalidArgument(`A team can contain at most ${MAX_TEAM_SIZE} Pokémon.`);
  }

  const seenPokemonIds = new Set<string>();

  return slots.map((slot, slotIndex) => {
    if (slot.moves.length > MAX_MOVES_PER_POKEMON) {
      invalidArgument(
        `${slot.pokemonName || `Pokémon in slot ${slotIndex + 1}`} can have at most ${MAX_MOVES_PER_POKEMON} moves.`,
      );
    }

    const pokemonId = normalizeIdentifier(
      slot.pokemonId,
      `Pokémon ID in slot ${slotIndex + 1}`,
    );
    if (seenPokemonIds.has(pokemonId)) {
      invalidArgument("A saved team cannot contain the same Pokémon form twice.");
    }
    seenPokemonIds.add(pokemonId);
    const pokemonName = normalizeRequiredString(
      slot.pokemonName,
      `Pokémon name in slot ${slotIndex + 1}`,
      MAX_DISPLAY_NAME_LENGTH,
    );
    const seenMoveIds = new Set<string>();
    const moves = slot.moves.map((move) => {
      const moveId = normalizeIdentifier(
        move.moveId,
        `Move ID for ${pokemonName}`,
      );
      const moveName = normalizeRequiredString(
        move.moveName,
        `Move name for ${pokemonName}`,
        MAX_DISPLAY_NAME_LENGTH,
      );

      const moveGroup = moveId.startsWith("hiddenpower")
        ? "hiddenpower"
        : moveId;
      if (seenMoveIds.has(moveGroup)) {
        invalidArgument(`${pokemonName} cannot have the same move twice.`);
      }
      seenMoveIds.add(moveGroup);

      return { moveId, moveName };
    });

    return { pokemonId, pokemonName, moves };
  });
}

async function getOwnedTeam(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  teamId: Id<"savedTeams">,
  ownerId: string,
) {
  const team = await ctx.db.get(teamId);

  if (!team || team.ownerId !== ownerId) {
    return null;
  }

  return team;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);

    return await ctx.db
      .query("savedTeams")
      .withIndex("by_owner_updated_at", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(MAX_SAVED_TEAMS_PER_USER);
  },
});

export const get = query({
  args: { teamId: v.id("savedTeams") },
  handler: async (ctx, { teamId }) => {
    const ownerId = await requireUserId(ctx);
    return await getOwnedTeam(ctx, teamId, ownerId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    generation: generationValidator,
    scope: v.optional(catalogScopeValidator),
    slots: v.array(teamSlotValidator),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const existingTeams = await ctx.db
      .query("savedTeams")
      .withIndex("by_owner_updated_at", (q) => q.eq("ownerId", ownerId))
      .take(MAX_SAVED_TEAMS_PER_USER);
    if (existingTeams.length >= MAX_SAVED_TEAMS_PER_USER) {
      invalidArgument(
        `You can save up to ${MAX_SAVED_TEAMS_PER_USER} teams. Delete one before saving another.`,
      );
    }
    const now = Date.now();

    return await ctx.db.insert("savedTeams", {
      ownerId,
      name: normalizeTeamName(args.name),
      generation: args.generation,
      scope: args.scope ?? "national",
      slots: normalizeSlots(args.slots),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    teamId: v.id("savedTeams"),
    name: v.optional(v.string()),
    generation: v.optional(generationValidator),
    scope: v.optional(catalogScopeValidator),
    slots: v.optional(v.array(teamSlotValidator)),
  },
  handler: async (ctx, { teamId, name, generation, scope, slots }) => {
    const ownerId = await requireUserId(ctx);
    const team = await getOwnedTeam(ctx, teamId, ownerId);

    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Saved team not found.",
      });
    }

    if (
      name === undefined &&
      generation === undefined &&
      scope === undefined &&
      slots === undefined
    ) {
      invalidArgument("Provide at least one team field to update.");
    }

    await ctx.db.patch(teamId, {
      ...(name === undefined ? {} : { name: normalizeTeamName(name) }),
      ...(generation === undefined ? {} : { generation }),
      ...(scope === undefined ? {} : { scope }),
      ...(slots === undefined ? {} : { slots: normalizeSlots(slots) }),
      updatedAt: Date.now(),
    });

    return teamId;
  },
});

export const remove = mutation({
  args: { teamId: v.id("savedTeams") },
  handler: async (ctx, { teamId }) => {
    const ownerId = await requireUserId(ctx);
    const team = await getOwnedTeam(ctx, teamId, ownerId);

    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Saved team not found.",
      });
    }

    await ctx.db.delete(teamId);
    return teamId;
  },
});
