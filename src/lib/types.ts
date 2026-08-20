export interface Team {
  id: string;
  name: string;
  captain?: string;
  phone?: string;
  notes?: string;
  slot?: number;
  players?: string[];
  out?: boolean;
  group?: string;  // Group label ("A", "B", "C"...) or "waiting"
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
  penalty?: number;    // penalty points deducted
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
  updatedAt?: string;
  teams: Team[];
  rules?: string[];
  geminiData?: GeminiOutput;
  assignments?: Record<string, string>;
  pointSystem?: PointSystem;
  roomInfo?: { roomId?: string; password?: string; matchTime?: string; note?: string };
  waGroup?: string;               // WhatsApp group invite link
  waMessage?: string;             // Default message template ({team} and {link} placeholders)
  waGroupSent?: string[];         // teamIds that have been sent the invite
  entryFee?: number;              // Entry fee per slot (₹)
  isActive?: boolean;             // Whether booking is open for players
  shareToken?: string;            // Cached UUID share token (for instant share open)
  shortCode?: string;             // Cached 6-char short code
  sharedFrom?: string;            // 6-char code if imported via share (collaborator mode)
  splitEnabled?: boolean;         // Whether tournament has been split into groups
  groupCount?: number;             // Number of groups (default 2)
  finalStage?: {                  // Final stage advancement rules
    advancePerGroup: number;      // How many teams from each group go to final
    totalSlots?: number;          // Total final stage slots (auto-calculated)
  };
  waGroupLinks?: Record<string, string>;  // Per-group WA links keyed by label ("A", "B"...)
  shareEditable?: boolean;                // Whether collaborators can edit (default true)
  penalties?: Record<string, number>;     // teamId → penalty points deducted
}
