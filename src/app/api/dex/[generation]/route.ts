import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { getDexCatalog } from "@/lib/pokemon/dex-server";
import { isCatalogScope, isGeneration } from "@/lib/pokemon/types";

export const runtime = "nodejs";
export const revalidate = 86400;

const getCachedDexCatalog = unstable_cache(
  async (
    generation: Parameters<typeof getDexCatalog>[0],
    scope: Parameters<typeof getDexCatalog>[1],
  ) => getDexCatalog(generation, scope),
  ["typewise-dex-catalog-v4"],
  { revalidate: 86400 },
);

type RouteContext = { params: Promise<{ generation: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { generation: rawGeneration } = await context.params;
  const generation = Number(rawGeneration);

  if (!isGeneration(generation) || rawGeneration !== String(generation)) {
    return NextResponse.json(
      { error: "Generation must be a whole number from 1 through 9." },
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

  return NextResponse.json(await getCachedDexCatalog(generation, scope), {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
