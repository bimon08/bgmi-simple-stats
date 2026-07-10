/**
 * BGMI Placement Points (official PUBG Mobile rules)
 * 1st=10, 2nd=6, 3rd=5, 4th=4, 5th=3, 6th=2, 7th-8th=1, 9th+=0
 */
export const BGMI_PLACEMENT: Record<number, number> = {
  1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1,
};

export function getPlacementPoints(position: number): number {
  return BGMI_PLACEMENT[position] ?? 0;
}

export function calculateMatchPoints(position: number, teamKills: number): number {
  return getPlacementPoints(position) + teamKills;
}

/**
 * BGMI Tiebreaker Rules:
 * 1. Total Points (higher = better)
 * 2. Chicken Dinners (higher = better)
 * 3. Total Placement Points (higher = better)
 * 4. Total Kills (higher = better)
 * 5. Last Match Position (lower = better)
 */
export function compareTiebreaker(
  a: { totalPoints: number; chickenDinners: number; placementPoints: number; totalKills: number; lastMatchPosition: number },
  b: { totalPoints: number; chickenDinners: number; placementPoints: number; totalKills: number; lastMatchPosition: number }
): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.chickenDinners !== a.chickenDinners) return b.chickenDinners - a.chickenDinners;
  if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
  if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
  return a.lastMatchPosition - b.lastMatchPosition;
}
