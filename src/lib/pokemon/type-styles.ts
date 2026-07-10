const TYPE_STYLES: Record<string, { background: string; foreground: string }> = {
  Normal: { background: "#A8A77A", foreground: "#171717" },
  Fire: { background: "#EE8130", foreground: "#171717" },
  Water: { background: "#6390F0", foreground: "#07142f" },
  Electric: { background: "#F7D02C", foreground: "#171717" },
  Grass: { background: "#7AC74C", foreground: "#102307" },
  Ice: { background: "#96D9D6", foreground: "#102a2a" },
  Fighting: { background: "#C22E28", foreground: "#ffffff" },
  Poison: { background: "#A33EA1", foreground: "#ffffff" },
  Ground: { background: "#E2BF65", foreground: "#2b2108" },
  Flying: { background: "#A98FF3", foreground: "#1c123c" },
  Psychic: { background: "#F95587", foreground: "#3c0717" },
  Bug: { background: "#A6B91A", foreground: "#1b1f03" },
  Rock: { background: "#B6A136", foreground: "#211d06" },
  Ghost: { background: "#735797", foreground: "#ffffff" },
  Dragon: { background: "#6F35FC", foreground: "#ffffff" },
  Dark: { background: "#705746", foreground: "#ffffff" },
  Steel: { background: "#B7B7CE", foreground: "#171721" },
  Fairy: { background: "#D685AD", foreground: "#2b0e1d" },
};

export function typeStyle(type: string) {
  return TYPE_STYLES[type] ?? { background: "#d4d4d4", foreground: "#171717" };
}

