import { Tournament } from "./types";

const STORAGE_KEY = "bgmi-simple-stats";

export function loadTournament(): Tournament | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tournament;
  } catch {
    return null;
  }
}

export function saveTournament(t: Tournament): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export function createTournament(name: string): Tournament {
  const t: Tournament = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    teams: [],
  };
  saveTournament(t);
  return t;
}

export function deleteTournament(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportData(): string {
  const t = loadTournament();
  return JSON.stringify(t, null, 2);
}

export function importData(json: string): Tournament {
  const t = JSON.parse(json) as Tournament;
  saveTournament(t);
  return t;
}
