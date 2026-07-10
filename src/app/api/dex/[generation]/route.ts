import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { getDexCatalog } from "@/lib/pokemon/dex-server";
import { isGeneration } from "@/lib/pokemon/types";

export const runtime = "nodejs";
export const revalidate = 86400;

const getCachedDexCatalog = unstable_cache(
  async (generation: Parameters<typeof getDexCatalog>[0]) =>
    getDexCatalog(generation),
  ["typewise-dex-catalog-v1"],
  { revalidate: 86400 },
);

type RouteContext = { params: Promise<{ generation: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { generation: rawGeneration } = await context.params;
  const generation = Number(rawGeneration);

  if (!isGeneration(generation) || rawGeneration !== String(generation)) {
    return NextResponse.json(
      { error: "Generation must be a whole number from 1 through 9." },
      { status: 400 },
    );
  }

  return NextResponse.json(await getCachedDexCatalog(generation), {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
