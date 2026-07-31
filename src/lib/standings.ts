import { Tournament, StandingRow, DEFAULT_BGMI_POINTS } from "@/lib/types";
import { compareTiebreaker } from "@/lib/points";

/** Compute sorted standings rows from tournament data. Pure function — no side effects. */
export function computeStandings(t: Tournament): StandingRow[] {
  if (!t.geminiData) return [];
  const assignMap = t.assignments ?? {};
  const ps = t.pointSystem ?? DEFAULT_BGMI_POINTS;
  const groups = t.geminiData.groups.map((group) => {
    if (group.totals) return group;
    const matches = group.matches.map((m) => {
      const teamKills = Object.values(m.playerKills ?? {}).reduce((a, b) => a + b, 0);
      const placementPoints = ps.positionPoints[m.position - 1] ?? 0;
      const matchPoints = placementPoints + teamKills * ps.killPoints;
      return { ...m, teamKills, placementPoints, matchPoints };
    });
    const totals = {
      totalPoints: matches.reduce((a, m) => a + m.matchPoints, 0),
      chickenDinners: matches.filter((m) => m.position === 1).length,
      totalPlacementPoints: matches.reduce((a, m) => a + m.placementPoints, 0),
      totalKills: matches.reduce((a, m) => a + m.teamKills, 0),
      lastMatchPosition: matches[matches.length - 1]?.position ?? 0,
    };
    return { ...group, matches, totals };
  });
  const rows: StandingRow[] = groups.map((group) => {
    const teamId = assignMap[group.group];
    const team = t.teams.find((tm) => tm.id === teamId);
    return {
      teamId: teamId || group.group,
      teamName: team?.name || group.group,
      group: group.group,
      players: group.players,
      totalPoints: group.totals.totalPoints,
      chickenDinners: group.totals.chickenDinners,
      placementPoints: group.totals.totalPlacementPoints,
      totalKills: group.totals.totalKills,
      lastMatchPosition: group.totals.lastMatchPosition,
      positions: group.matches.map((m) => m.position),
      matchCount: group.matches.length,
    };
  }).filter((row) => {
    const team = t.teams.find((tm) => tm.id === row.teamId);
    return !team?.out;
  });

  // Add 0-stat rows for registered IN teams not in any group
  const assignedTeamIds = new Set(Object.values(assignMap));
  t.teams.forEach((team) => {
    if (team.out) return;
    if (assignedTeamIds.has(team.id)) return;
    rows.push({
      teamId: team.id, teamName: team.name, group: "—",
      players: team.players ?? [], totalPoints: 0, chickenDinners: 0,
      placementPoints: 0, totalKills: 0, lastMatchPosition: 0,
      positions: [], matchCount: 0,
    });
  });

  rows.sort(compareTiebreaker);
  return rows;
}

/** Normalize groups and build AssignedGroup[] for the openAction flow */
export function normalizeAndAssign(t: Tournament) {
  if (!t.geminiData) return { groups: [], assignments: t.assignments || {}, matchesDetected: 0 };
  const ps = t.pointSystem ?? DEFAULT_BGMI_POINTS;
  const normalizedGroups = t.geminiData.groups.map((g) => {
    if (g.totals) return g;
    const matches = g.matches.map((m) => {
      const teamKills = Object.values(m.playerKills ?? {}).reduce((a, b) => a + b, 0);
      const placementPoints = ps.positionPoints[m.position - 1] ?? 0;
      const matchPoints = placementPoints + teamKills * ps.killPoints;
      return { ...m, teamKills, placementPoints, matchPoints };
    });
    const totals = {
      totalPoints: matches.reduce((a, m) => a + m.matchPoints, 0),
      chickenDinners: matches.filter((m) => m.position === 1).length,
      totalPlacementPoints: matches.reduce((a, m) => a + m.placementPoints, 0),
      totalKills: matches.reduce((a, m) => a + m.teamKills, 0),
      lastMatchPosition: matches[matches.length - 1]?.position ?? 0,
    };
    return { ...g, matches, totals };
  });
  const assignments = t.assignments || {};
  return {
    groups: normalizedGroups.map((g) => ({
      ...g,
      teamId: assignments[g.group],
      teamName: t.teams.find((tm) => tm.id === assignments[g.group])?.name,
    })),
    assignments,
    matchesDetected: t.geminiData.matches_detected,
  };
}
