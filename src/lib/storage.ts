import { Tournament } from "./types";

const KEY = "bgmi-tournaments";
const LEGACY_KEY = "bgmi-simple-stats";

export function loadTournaments(): Tournament[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { return JSON.parse(raw) as Tournament[]; } catch { return []; }
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
  const idx = all.findIndex(x => x.id === t.id);
  const updated = idx >= 0 ? all.map(x => x.id === t.id ? t : x) : [...all, t];
  saveTournaments(updated);
  return updated;
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
  return updated;
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
