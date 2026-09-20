const bestKey = "terebore-best";
export function parseBest(value: string | null): number {
  if (value === null || value.trim() === "") return 0;
  const score = Number(value);
  return Number.isSafeInteger(score) && score >= 0 ? score : 0;
}
export function loadBest(storage: () => Pick<Storage, "getItem">): number {
  try {
    return parseBest(storage().getItem(bestKey));
  } catch {
    return 0;
  }
}
export function saveBest(
  score: number,
  storage: () => Pick<Storage, "setItem">,
): void {
  if (!Number.isSafeInteger(score) || score < 0) return;
  try {
    storage().setItem(bestKey, String(score));
  } catch {
    /* Play continues without storage. */
  }
}
