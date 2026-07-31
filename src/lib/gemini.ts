import { Tournament, GeminiOutput, AssignedGroup, DEFAULT_BGMI_POINTS } from "@/lib/types";

/** Normalize raw Gemini output — clean player names, compute totals */
export function normalizeGeminiData(raw: GeminiOutput, tournament: Tournament): GeminiOutput {
  const ps = tournament.pointSystem ?? DEFAULT_BGMI_POINTS;
  const isValidName = (name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length <= 1) return false;
    if (/^\d+$/.test(trimmed)) return false;
    return true;
  };
  const groups = raw.groups.map((g) => {
    const matches = g.matches.map((m) => {
      const cleanKills: Record<string, number> = {};
      Object.entries(m.playerKills ?? {}).forEach(([name, kills]) => {
        if (isValidName(name)) cleanKills[name] = kills;
      });
      const teamKills = Object.values(cleanKills).reduce((a, b) => a + b, 0);
      const placementPoints = ps.positionPoints[m.position - 1] ?? 0;
      const matchPoints = placementPoints + teamKills * ps.killPoints;
      return { ...m, playerKills: cleanKills, teamKills, placementPoints, matchPoints };
    });
    const rawPlayers: string[] = Array.isArray(g.players)
      ? g.players
      : Object.keys(g.players as unknown as Record<string, number>);
    const players = rawPlayers.filter(isValidName);
    const totals = {
      totalPoints: matches.reduce((a, m) => a + m.matchPoints, 0),
      chickenDinners: matches.filter((m) => m.position === 1).length,
      totalPlacementPoints: matches.reduce((a, m) => a + m.placementPoints, 0),
      totalKills: matches.reduce((a, m) => a + m.teamKills, 0),
      lastMatchPosition: matches[matches.length - 1]?.position ?? 0,
    };
    return { ...g, players, matches, totals };
  });
  return { ...raw, groups };
}

/** Deduplicate player names case-insensitively */
export function uniquePlayers(players: string[]): string[] {
  const seen = new Set<string>();
  return players.filter((p) => { const k = p.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Auto-assign groups to teams and enrich rosters */
export function autoAssignAndEnrich(
  tournament: Tournament,
  data: GeminiOutput,
  existingAssignments: Record<string, string>,
): { assigned: AssignedGroup[]; autoAssignments: Record<string, string>; enrichedTeams: Tournament["teams"] } {
  const autoAssignments: Record<string, string> = { ...existingAssignments };
  const usedTeamIds = new Set(Object.values(autoAssignments));

  data.groups.forEach((g) => {
    if (autoAssignments[g.group]) return;
    const gLower = g.group.toLowerCase().trim();
    const available = (t: { id: string }) => !usedTeamIds.has(t.id);

    // 1. Exact name match
    let match = tournament.teams.find((t) => available(t) && t.name.toLowerCase().trim() === gLower);

    // 2. Contains match
    if (!match && gLower.length >= 4) {
      match = tournament.teams.find((t) => {
        if (!available(t)) return false;
        const tLower = t.name.toLowerCase().trim();
        return (tLower.length >= 4 && tLower.includes(gLower)) || (tLower.length >= 4 && gLower.includes(tLower));
      });
    }

    // 3. Player-name fallback
    if (!match) {
      const registeredMap = new Map<string, string>();
      tournament.teams.forEach((t) => (t.players ?? []).forEach((p) => registeredMap.set(p.toLowerCase().trim(), t.id)));
      for (const player of g.players) {
        const tid = registeredMap.get(player.toLowerCase().trim());
        if (tid) {
          const found = tournament.teams.find((t) => t.id === tid && available(t));
          if (found) { match = found; break; }
        }
      }
    }

    if (match) { autoAssignments[g.group] = match.id; usedTeamIds.add(match.id); }
  });

  const assigned: AssignedGroup[] = data.groups.map((g) => ({
    ...g,
    teamId: autoAssignments[g.group],
    teamName: tournament.teams.find((t) => t.id === autoAssignments[g.group])?.name,
  }));

  // Enrich rosters
  const allRegistered = new Map<string, string>();
  tournament.teams.forEach((team) => (team.players ?? []).forEach((p) => allRegistered.set(p.toLowerCase(), team.id)));

  const isGarbageName = (name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length <= 1) return true;
    if (/^\d+$/.test(trimmed)) return true;
    if (/^[^a-zA-Z]*$/.test(trimmed) && trimmed.length < 3) return true;
    return false;
  };

  const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-\.]+/g, '').replace(/[^a-z0-9]/g, '');
  const isSimilar = (a: string, b: string): boolean => {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    if (na.length >= 4 && nb.length >= 4) {
      const shorter = na.length <= nb.length ? na : nb;
      const longer = na.length > nb.length ? na : nb;
      if (longer.includes(shorter)) return true;
      const prefixLen = Math.ceil(shorter.length * 0.7);
      if (longer.startsWith(shorter.slice(0, prefixLen))) return true;
    }
    return false;
  };

  const enrichedTeams = tournament.teams.map((team) => {
    const matchedGroup = data.groups.find((g) => autoAssignments[g.group] === team.id);
    if (!matchedGroup) return team;
    const discovered = matchedGroup.players.filter((p) => !isGarbageName(p));
    const existing = team.players ?? [];
    const existingLower = new Set(existing.map((p) => p.toLowerCase()));
    const newPlayers = discovered.filter((p) => {
      const k = p.toLowerCase();
      if (existingLower.has(k)) return false;
      if (existing.some((e) => isSimilar(e, p))) return false;
      const owner = allRegistered.get(k);
      if (owner && owner !== team.id) return false;
      for (const [regName, regTeamId] of allRegistered.entries()) {
        if (regTeamId !== team.id && isSimilar(regName, p.toLowerCase())) return false;
      }
      return true;
    });
    if (newPlayers.length === 0) return team;
    return { ...team, players: uniquePlayers([...existing, ...newPlayers]) };
  });

  return { assigned, autoAssignments, enrichedTeams };
}
