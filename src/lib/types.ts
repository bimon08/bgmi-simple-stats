export interface Team {
  id: string;
  name: string;
  captain?: string;
  phone?: string;
  notes?: string;
  slot?: number;
}

export interface PlayerKills {
  name: string;
  kills: number;
}

export interface GroupMatch {
  match: number;
  position: number;
  placementPoints: number;
  playerKills: Record<string, number>;
  teamKills: number;
  matchPoints: number;
}

export interface GroupTotals {
  totalPoints: number;
  chickenDinners: number;
  totalPlacementPoints: number;
  totalKills: number;
  lastMatchPosition: number;
}

/** Raw group from Gemini JSON */
export interface GeminiGroup {
  rank: number;
  group: string;
  players: string[];
  matches: GroupMatch[];
  totals: GroupTotals;
}

/** Gemini full output */
export interface GeminiOutput {
  matches_detected: number;
  groups: GeminiGroup[];
}

/** A group with team assignment */
export interface AssignedGroup extends GeminiGroup {
  teamId?: string;
  teamName?: string;
}

/** Standing row for display */
export interface StandingRow {
  teamId: string;
  teamName: string;
  group: string;
  players: string[];
  totalPoints: number;
  chickenDinners: number;
  placementPoints: number;
  totalKills: number;
  lastMatchPosition: number;
  positions: number[]; // per-match positions
  matchCount: number;
}

/** Full tournament data stored in localStorage */
export interface Tournament {
  id: string;
  name: string;
  createdAt: string;
  teams: Team[];
  geminiData?: GeminiOutput;
  assignments?: Record<string, string>; // group label -> teamId
}
