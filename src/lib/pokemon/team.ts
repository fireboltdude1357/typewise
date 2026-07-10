import type { MoveSummary } from "./types";

export function moveSlotGroup(moveId: string) {
  return moveId.startsWith("hiddenpower") ? "hiddenpower" : moveId;
}

export function toggleMoveSelection(
  selected: MoveSummary[],
  move: MoveSummary,
  limit = 4,
) {
  if (selected.some((candidate) => candidate.id === move.id)) {
    return selected.filter((candidate) => candidate.id !== move.id);
  }

  const group = moveSlotGroup(move.id);
  const withoutConflictingVariant = selected.filter(
    (candidate) => moveSlotGroup(candidate.id) !== group,
  );
  if (withoutConflictingVariant.length >= limit) return selected;
  return [...withoutConflictingVariant, move];
}

