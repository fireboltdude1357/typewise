import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { getPokemonMoves } from "@/lib/pokemon/dex-server";
import { isGeneration } from "@/lib/pokemon/types";

export const runtime = "nodejs";
export const revalidate = 86400;

const getCachedPokemonMoves = unstable_cache(
  async (
    generation: Parameters<typeof getPokemonMoves>[0],
    pokemon: string,
  ) => getPokemonMoves(generation, pokemon),
  ["typewise-pokemon-moves-v1"],
  { revalidate: 86400 },
);

type RouteContext = {
  params: Promise<{ generation: string; pokemon: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
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

  const result = await getCachedPokemonMoves(generation, pokemon);
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
