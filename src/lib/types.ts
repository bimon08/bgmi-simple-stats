export interface Team {
  id: string;
  name: string;
  captain?: string;
  phone?: string;
  notes?: string;
  slot?: number;
  players?: string[];
  paid?: boolean;
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

/** Kill + placement point config */
export interface PointSystem {
  killPoints: number;            // points per kill
  positionPoints: number[];      // index 0 = #1 place, index 1 = #2 place, etc.
}

/** Default BGMI competitive point system */
export const DEFAULT_BGMI_POINTS: PointSystem = {
  killPoints: 1,
  positionPoints: [10, 6, 5, 4, 3, 2, 1, 1], // #9 and above = 0
};

/** Full tournament data stored in localStorage */
export interface Tournament {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;          // set on every save; used for sync conflict resolution
  teams: Team[];
  rules?: string[];
  geminiData?: GeminiOutput;
  assignments?: Record<string, string>; // group label -> teamId
  pointSystem?: PointSystem;
}
