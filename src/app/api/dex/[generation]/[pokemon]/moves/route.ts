import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { getPokemonMoves } from "@/lib/pokemon/dex-server";
import { isCatalogScope, isGeneration } from "@/lib/pokemon/types";

export const runtime = "nodejs";
export const revalidate = 86400;

const getCachedPokemonMoves = unstable_cache(
  async (
    generation: Parameters<typeof getPokemonMoves>[0],
    pokemon: string,
    scope: Parameters<typeof getPokemonMoves>[2],
  ) => getPokemonMoves(generation, pokemon, scope),
  ["typewise-pokemon-moves-v5"],
  { revalidate: 86400 },
);

type RouteContext = {
  params: Promise<{ generation: string; pokemon: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { generation: rawGeneration, pokemon } = await context.params;
  const generation = Number(rawGeneration);

  if (!isGeneration(generation) || rawGeneration !== String(generation)) {
    return NextResponse.json(
      { error: "Generation must be a whole number from 1 through 9." },
      { status: 400 },
    );
  }

  if (!/^[a-z0-9]{1,100}$/.test(pokemon)) {
    return NextResponse.json(
      { error: "Pokémon IDs must use canonical lowercase letters and numbers." },
      { status: 400 },
    );
  }

  const scope = new URL(request.url).searchParams.get("scope") ?? "national";
  if (!isCatalogScope(scope)) {
    return NextResponse.json(
      { error: 'Scope must be either "national" or "core".' },
      { status: 400 },
    );
  }

  const result = await getCachedPokemonMoves(generation, pokemon, scope);
  if (!result) {
    return NextResponse.json(
      { error: "That Pokémon is not available in this generation." },
      { status: 404 },
    );
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
