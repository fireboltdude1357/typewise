import type { Generation } from "./types";

export const GENERATION_META: Record<
  Generation,
  { roman: string; title: string; games: string; accent: string }
> = {
  1: {
    roman: "I",
    title: "Kanto",
    games: "Red, Blue & Yellow",
    accent: "#ef4444",
  },
  2: {
    roman: "II",
    title: "Johto",
    games: "Gold, Silver & Crystal",
    accent: "#eab308",
  },
  3: {
    roman: "III",
    title: "Hoenn",
    games: "Ruby, Sapphire, Emerald & FRLG",
    accent: "#22c55e",
  },
  4: {
    roman: "IV",
    title: "Sinnoh",
    games: "Diamond, Pearl, Platinum & HGSS",
    accent: "#60a5fa",
  },
  5: {
    roman: "V",
    title: "Unova",
    games: "Black, White, B2 & W2",
    accent: "#64748b",
  },
  6: {
    roman: "VI",
    title: "Kalos",
    games: "X, Y & ORAS",
    accent: "#ec4899",
  },
  7: {
    roman: "VII",
    title: "Alola",
    games: "Sun, Moon & Ultra Sun / Ultra Moon",
    accent: "#f97316",
  },
  8: {
    roman: "VIII",
    title: "Galar",
    games: "Sword & Shield",
    accent: "#8b5cf6",
  },
  9: {
    roman: "IX",
    title: "Paldea",
    games: "Scarlet & Violet",
    accent: "#a855f7",
  },
};

export function generationName(generation: Generation) {
  return `Generation ${GENERATION_META[generation].roman}`;
}

export function generationScope(generation: Generation) {
  return `${generationName(generation)} union · ${GENERATION_META[generation].games}`;
}
