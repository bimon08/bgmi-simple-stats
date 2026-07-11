import { Team } from "./types";

/**
 * Generate the Gemini OCR prompt.
 * Gemini only extracts raw data (position + kills). Points are calculated by the website.
 */
export function generatePrompt(teams: Team[]): string {
  const hasTeams = teams.length > 0;

  const rosterSection = hasTeams
    ? `\n═══════════════════════════════════════
REGISTERED TEAMS (${teams.length} teams)
Match scoreboard players to these rosters to identify each team.
Use the registered team name as the "group" value in the output.
═══════════════════════════════════════
${teams.map((t, i) => {
  const playerList = (t.players && t.players.length > 0)
    ? `\n   Players: ${t.players.join(", ")}`
    : "";
  return `${i + 1}. ${t.name}${playerList}`;
}).join("\n")}
`
    : "";

  return `I need you to extract stats from BGMI (Battlegrounds Mobile India) match scoreboard screenshots.

I'll upload screenshots in batches (max 10 images per message). DO NOT analyze yet — just acknowledge each batch. When I say "ok", start the full analysis.
${rosterSection}
═══════════════════════════════════════
HOW TO READ BGMI SCOREBOARDS
═══════════════════════════════════════

Each scoreboard has TWO panels:

LEFT PANEL: Shows #1 and #2 teams
  - #1 team has a CROWN icon, #2 has a silver medal
  - Each player row: [PlayerName] ... [N finishes] or [N finish]
  - "finishes" = kills. Read the NUMBER before "finishes"/"finish"

RIGHT PANEL: Shows positions #3 through #14 (scrollable)
  - Each position block: big number on left, then player rows
  - Each player row: [PlayerName] ... [N finishes]

MULTIPLE IMAGES per match: The scoreboard scrolls, so one match has 2-5 screenshots. Images showing the SAME #1 and #2 teams (same players, same kills) belong to the SAME match.

Players in the SAME position block are TEAMMATES (max 4 per team).

═══════════════════════════════════════
YOUR TASK (when I say "ok")
═══════════════════════════════════════

STEP 1 — GROUP IMAGES BY MATCH
Identify which images belong to the same match (same #1 and #2 teams = same match).
Label them M1, M2, M3, M4 in the order you detect them.

STEP 2 — READ EVERY POSITION GROUP
For each match, read every position block (#1 through #14):
  - Position number
  - All player names EXACTLY as shown (keep all Unicode, symbols, foreign chars)
  - Each player's kills (number before "finishes")

STEP 3 — IDENTIFY TEAMS
Match the players you see on screen to the registered rosters above.
- Some teams have a full player list — match any of those names
- Some teams have only 1 name (the leader) — if that one name appears on screen, ALL players in that same position block belong to that team
- If you cannot match any player in a position block to any registered team → use the next available letter (A, B, C …)
Track recurring player groups across matches — same players = same team.

**Do NOT calculate any points.** Only output raw positions and kills.
The website will calculate placement points, kill points, totals, and rankings.

═══════════════════════════════════════
OUTPUT FORMAT — Return ONLY this JSON
═══════════════════════════════════════

{
  "matches_detected": 4,
  "groups": [
    {
      "group": "TSMent",
      "players": ["ExactScreenName1", "ExactScreenName2", "ExactScreenName3"],
      "matches": [
        {
          "match": 1,
          "position": 1,
          "playerKills": {
            "ExactScreenName1": 5,
            "ExactScreenName2": 3,
            "ExactScreenName3": 2
          }
        }
      ]
    }
  ]
}

═══════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════

- Do NOT include placementPoints, matchPoints, teamKills, totals, or rank in the output
- Player names: EXACTLY as on screen — keep ALL Unicode, symbols, foreign chars
- "N finishes" = N kills. Double-check — stylized font can be tricky
- If a team doesn't appear in a match, skip that match entry for them
- "players" = union of all players seen for that group across all matches
- Don't skip any team or player visible in the screenshots
- After the JSON, confirm:
  Groups found: X | Matches detected: Y
  Any teams you couldn't match to the roster? List them.

═══════════════════════════════════════
I'll upload images now. When I say "ok", analyze using the rules above.`;
}
