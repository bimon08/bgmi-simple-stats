import { Team } from "./types";

/**
 * Generate the Gemini OCR prompt.
 * Gemini only extracts raw data (position + kills). Points are calculated by the website.
 */
export function generatePrompt(teams: Team[]): string {
  const hasTeams = teams.length > 0;

  const rosterSection = hasTeams
    ? `\nREGISTERED TEAMS (${teams.length}):
${teams.map((t, i) => {
  const playerList = (t.players && t.players.length > 0)
    ? ` — Players: ${t.players.join(", ")}`
    : "";
  return `${i + 1}. ${t.name}${playerList}`;
}).join("\n")}
`
    : "";

  return `Extract BGMI scoreboard stats from screenshots I'll upload.

Upload flow: I'll send screenshots in batches. For each batch, ONLY reply with the word "received" and nothing else. Do NOT analyze or process any images until I send a message that says exactly "ok". Only then should you analyze ALL uploaded images together.
${rosterSection}
BGMI SCOREBOARD LAYOUT:
- LEFT PANEL: #1 (crown) and #2 (silver) teams with player rows showing "[Name] ... [N finishes]"
- RIGHT PANEL: Positions #3–#14, each block has a position number + player rows
- "N finishes" = N kills
- Players in same position block = teammates (max 4)
- Multiple screenshots per match (scrollable). Same #1 and #2 teams = same match.

TASK:
1. Group images by match (same #1/#2 = same match). Label M1, M2, M3…
2. For each match, read every position block: position number, exact player names (keep Unicode/symbols), kills
3. Match players to registered teams above. Unmatched → use letters A, B, C…
4. NEVER merge two position blocks into one group. Each block = one group.
5. Do NOT calculate points. Only output positions and kills.

OUTPUT — wrap the JSON in a \`\`\`json code block so it can be copied easily. No explanation before the JSON:

{
  "matches_detected": 4,
  "groups": [
    {
      "group": "TeamName",
      "players": ["Player1", "Player2"],
      "matches": [
        {
          "match": 1,
          "position": 1,
          "playerKills": { "Player1": 5, "Player2": 3 }
        }
      ]
    }
  ]
}

RULES:
- One position block = one group entry. Never combine blocks.
- Player names EXACTLY as on screen
- "players" = union of all players seen across all matches for that group
- Skip matches where a team doesn't appear
- After the JSON code block, on a new line: "Groups: X | Matches: Y" + list any unmatched teams

I'll upload images now. Reply ONLY with "received" for each batch. Do NOT start analyzing until I say "ok".`;
}
