import { Team } from "./types";

/**
 * Generate the Gemini OCR prompt.
 * If teams are provided, includes the roster for better matching.
 */
export function generatePrompt(teams: Team[]): string {
  const hasTeams = teams.length > 0;

  const rosterSection = hasTeams
    ? `\n═══════════════════════════════════════
REGISTERED TEAMS (${teams.length} teams)
═══════════════════════════════════════
${teams.map((t, i) => `${i + 1}. ${t.name}${t.captain ? ` (Captain: ${t.captain})` : ""}`).join("\n")}
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

STEP 3 — GROUP TEAMS ACROSS MATCHES
Players who appear together in the same position block = same team.
Track the same team across matches by recognizing recurring player names.
Assign each unique team a group label: A, B, C, D, ...

STEP 4 — CALCULATE POINTS

Placement Points table:
  #1 = 10 pts
  #2 = 6 pts
  #3 = 5 pts
  #4 = 4 pts
  #5 = 3 pts
  #6 = 2 pts
  #7 = 1 pt
  #8 = 1 pt
  #9 and below = 0 pts

Kill Points: 1 point per kill (sum of all team members' kills)

Match Points = Placement Points + Kill Points

STEP 5 — CALCULATE TOTALS (across all matches)
  - Total Points = sum of all Match Points
  - Chicken Dinners = count of matches where position = #1
  - Total Placement Points = sum of placement points across matches
  - Total Kills = sum of team kills across matches
  - Last Match Position = position in the highest-numbered match

STEP 6 — SORT by tiebreaker (rank 1 at top)
  1st: Total Points (higher = better)
  2nd: Chicken Dinners (higher = better)
  3rd: Total Placement Points (higher = better)
  4th: Total Kills (higher = better)
  5th: Last Match Position (lower = better)

═══════════════════════════════════════
OUTPUT FORMAT — Return ONLY this JSON
═══════════════════════════════════════

{
  "matches_detected": 4,
  "groups": [
    {
      "rank": 1,
      "group": "A",
      "players": ["ExactScreenName1", "ExactScreenName2", "ExactScreenName3"],
      "matches": [
        {
          "match": 1,
          "position": 1,
          "placementPoints": 10,
          "playerKills": {
            "ExactScreenName1": 5,
            "ExactScreenName2": 3,
            "ExactScreenName3": 2
          },
          "teamKills": 10,
          "matchPoints": 20
        }
      ],
      "totals": {
        "totalPoints": 26,
        "chickenDinners": 1,
        "totalPlacementPoints": 13,
        "totalKills": 13,
        "lastMatchPosition": 5
      }
    }
  ]
}

═══════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════

- "groups" array MUST be sorted by rank (tiebreaker rules above)
- Player names: EXACTLY as on screen — keep ALL Unicode, symbols, foreign chars
- "N finishes" = N kills. Double-check — stylized font can be tricky
- If a team doesn't appear in a match, skip that match entry for them
- "players" = union of all players seen for that group across all matches
- Don't skip any team or player visible in the screenshots
- After the JSON, confirm:
  Groups found: X | Matches detected: Y
  Any teams you couldn't track across matches? List them.

═══════════════════════════════════════
I'll upload images now. When I say "ok", analyze using the rules above.`;
}
