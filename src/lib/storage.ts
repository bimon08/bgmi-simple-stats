import { Tournament } from "./types";

const KEY = "bgmi-tournaments";
const LEGACY_KEY = "bgmi-simple-stats";

export function loadTournaments(): Tournament[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const all = JSON.parse(raw) as Tournament[];
      // Deduplicate by ID — keep the most recently updated copy
      const seen = new Map<string, Tournament>();
      for (const t of all) {
        const existing = seen.get(t.id);
        if (!existing || (t.updatedAt ?? "") >= (existing.updatedAt ?? "")) seen.set(t.id, t);
      }
      return [...seen.values()];
    } catch { return []; }
  }
  // Migrate legacy single tournament
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    try {
      const t = JSON.parse(legacy) as Tournament;
      const arr = [t];
      localStorage.setItem(KEY, JSON.stringify(arr));
      return arr;
    } catch { return []; }
  }
  return [];
}

export function saveTournaments(tournaments: Tournament[]): void {
  localStorage.setItem(KEY, JSON.stringify(tournaments));
}

export function upsertTournament(t: Tournament, all: Tournament[]): Tournament[] {
  const stamped = { ...t, updatedAt: new Date().toISOString() };
  const idx = all.findIndex(x => x.id === t.id);
  const updated = idx >= 0 ? all.map(x => x.id === t.id ? stamped : x) : [...all, stamped];
  saveTournaments(updated);
  return updated;
}

/** Merge remote tournaments into local ones. Newer updatedAt wins per id. */
export function mergeTournaments(local: Tournament[], remote: Tournament[]): Tournament[] {
  const map = new Map<string, Tournament>();
  for (const t of local) map.set(t.id, t);
  for (const t of remote) {
    const existing = map.get(t.id);
    if (!existing) { map.set(t.id, t); continue; }
    const localTs = existing.updatedAt ?? existing.createdAt;
    const remoteTs = t.updatedAt ?? t.createdAt;
    if (remoteTs > localTs) map.set(t.id, t);
  }
  return Array.from(map.values());
}

export function createTournament(name: string): Tournament {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    teams: [],
  };
}

export function deleteTournamentById(id: string, all: Tournament[]): Tournament[] {
  const updated = all.filter(t => t.id !== id);
  saveTournaments(updated);
  // Track deleted IDs so sync doesn't re-add them from DB
  markTournamentDeleted(id);
  return updated;
}

const DELETED_KEY = "bgmi-deleted-tournaments";

export function markTournamentDeleted(id: string): void {
  const ids = getDeletedTournamentIds();
  ids.add(id);
  localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
}

export function getDeletedTournamentIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

export function clearDeletedTournamentId(id: string): void {
  const ids = getDeletedTournamentIds();
  ids.delete(id);
  localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
}

// Legacy compat exports
export function loadTournament(): Tournament | null {
  const all = loadTournaments();
  return all[0] ?? null;
}
export function saveTournament(t: Tournament): void {
  const all = loadTournaments();
  upsertTournament(t, all);
}
export function deleteTournament(): void {
  const all = loadTournaments();
  if (all[0]) deleteTournamentById(all[0].id, all);
}
export function exportData(): string {
  return JSON.stringify(loadTournaments(), null, 2);
}
export function importData(json: string): Tournament {
  const t = JSON.parse(json) as Tournament;
  const all = loadTournaments();
  upsertTournament(t, all);
  return t;
}
