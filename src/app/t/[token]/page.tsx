"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tournament, StandingRow, GeminiOutput } from "@/lib/types";
import { compareTiebreaker } from "@/lib/points";
import { loadTournaments, saveTournaments } from "@/lib/storage";
import { Download } from "lucide-react";

function computeStandings(t: Tournament): StandingRow[] {
  if (!t.geminiData) return [];
  const assignMap = t.assignments ?? {};
  return (t.geminiData as GeminiOutput).groups.map((group) => {
    const teamId = assignMap[group.group];
    const team = t.teams.find((tm) => tm.id === teamId);
    return {
      teamId: teamId || group.group,
      teamName: team?.name || group.group,
      group: group.group,
      players: group.players,
      totalPoints: group.totals.totalPoints,
      chickenDinners: group.totals.chickenDinners,
      placementPoints: group.totals.totalPlacementPoints,
      totalKills: group.totals.totalKills,
      lastMatchPosition: group.totals.lastMatchPosition,
      positions: group.matches.map((m) => m.position),
      matchCount: group.matches.length,
    };
  }).sort(compareTiebreaker);
}

const getBadge = (rank: number) =>
  rank === 1 ? "bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-black"
    : rank === 2 ? "bg-gradient-to-r from-gray-300 to-gray-400 text-black font-black"
    : rank === 3 ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black"
    : "bg-zinc-800 text-zinc-300 border border-zinc-700";

export default function SharedTournamentPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => r.json())
      .then(({ tournament: t, error: e }) => {
        if (e || !t) { setError("Tournament not found or link expired."); return; }
        setTournament(t);
        setStandings(computeStandings(t));
      })
      .catch(() => setError("Failed to load tournament."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleImport = () => {
    if (!tournament) return;
    setImporting(true);
    try {
      // Clone with a new ID so it doesn't conflict
      const cloned: Tournament = {
        ...tournament,
        id: crypto.randomUUID(),
        name: `${tournament.name} (imported)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const existing = loadTournaments();
      saveTournaments([cloned, ...existing]);
      setImported(true);
      // Redirect to home after short delay
      setTimeout(() => router.push("/"), 1200);
    } catch {
      alert("Import failed — please try again.");
    } finally {
      setImporting(false);
    }
  };

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: "#0a0614" }}>
      <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );

  if (error || !tournament) return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4" style={{ background: "#0a0614" }}>
      <span style={{ fontSize: "48px" }}>🔗</span>
      <p className="text-white font-bold text-lg">Link not found</p>
      <p className="text-sm" style={{ color: "rgba(196,181,253,0.5)" }}>{error}</p>
    </div>
  );

  const thStyle: React.CSSProperties = { padding: "8px 6px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.6)", textAlign: "center" };
  const half = Math.ceil(standings.length / 2);
  const cols = standings.length > 8 ? [standings.slice(0, half), standings.slice(half)] : [standings];

  return (
    <div className="min-h-dvh" style={{ background: "linear-gradient(135deg,#0a0614 0%,#130a2e 100%)" }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(167,139,250,0.6)" }}>OVERALL STANDINGS</p>
          <h1 className="text-3xl font-black text-white">{tournament.name}</h1>
          {tournament.geminiData && (
            <p className="text-sm mt-1" style={{ color: "rgba(196,181,253,0.5)" }}>
              {(tournament.geminiData as GeminiOutput).matches_detected} matches · {standings.length} teams
            </p>
          )}

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={importing || imported}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
            style={{
              background: imported ? "rgba(74,222,128,0.15)" : "linear-gradient(135deg,#7c3aed,#9333ea)",
              border: imported ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(124,58,237,0.5)",
              color: imported ? "#4ade80" : "white",
            }}
          >
            {imported ? (
              <><span>✓</span> Imported! Redirecting…</>
            ) : importing ? (
              <><div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Importing…</>
            ) : (
              <><Download className="h-4 w-4" /> Import to my tournaments</>
            )}
          </button>
        </div>

        {standings.length === 0 ? (
          <div className="text-center py-16">
            <span style={{ fontSize: "48px" }}>📊</span>
            <p className="text-white font-bold mt-3">No standings yet</p>
          </div>
        ) : (
          <div className={`flex gap-4 ${cols.length > 1 ? "" : "justify-center"}`}>
            {cols.map((col, ci) => (
              <div key={ci} className="flex-1 overflow-hidden rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.2)" }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "2px solid rgba(124,58,237,0.3)", background: "rgba(0,0,0,0.3)" }}>
                      <th style={{ ...thStyle, width: "36px" }}>#</th>
                      <th style={{ ...thStyle, textAlign: "left", paddingLeft: "8px" }}>Team</th>
                      <th style={thStyle}>🍗</th>
                      <th style={thStyle}>M</th>
                      <th style={thStyle}>P</th>
                      <th style={thStyle}>K</th>
                      <th style={{ ...thStyle, color: "#a78bfa" }}>T</th>
                    </tr>
                  </thead>
                  <tbody>
                    {col.map((row, idx) => {
                      const rank = ci * half + idx + 1;
                      return (
                        <tr key={row.teamId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                          <td style={{ padding: "8px 4px", textAlign: "center" }}>
                            <span className={`inline-flex items-center justify-center rounded-lg text-xs ${getBadge(rank)}`} style={{ width: "26px", height: "26px" }}>{rank}</span>
                          </td>
                          <td style={{ padding: "8px", fontWeight: 700, color: "white", fontSize: "13px" }}>{row.teamName}</td>
                          <td style={{ padding: "8px 4px", textAlign: "center", color: row.chickenDinners > 0 ? "#facc15" : "rgba(255,255,255,0.3)", fontWeight: 700, fontFamily: "monospace" }}>{row.chickenDinners}</td>
                          <td style={{ padding: "8px 4px", textAlign: "center", color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>{row.matchCount}</td>
                          <td style={{ padding: "8px 4px", textAlign: "center", color: "rgba(255,255,255,0.85)", fontFamily: "monospace", fontWeight: 700 }}>{row.placementPoints}</td>
                          <td style={{ padding: "8px 4px", textAlign: "center", color: "rgba(255,255,255,0.85)", fontFamily: "monospace", fontWeight: 700 }}>{row.totalKills}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}>
                            <span style={{ color: "#a78bfa", fontWeight: 900, fontFamily: "monospace", fontSize: "15px" }}>{row.totalPoints}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Teams list */}
        {tournament.teams.length > 0 && (
          <div className="mt-10">
            <p className="text-xs font-bold tracking-widest mb-4 text-center" style={{ color: "rgba(167,139,250,0.6)" }}>REGISTERED TEAMS — {tournament.teams.length}</p>
            <div className="grid grid-cols-2 gap-2">
              {tournament.teams.map((team, i) => (
                <div key={team.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.12)" }}>
                  <span className="text-xs font-bold" style={{ color: "rgba(139,92,246,0.7)", minWidth: "20px" }}>#{i + 1}</span>
                  <span className="text-sm font-semibold text-white truncate">{team.name}</span>
                  {team.paid !== false && <span className="text-[10px] font-bold ml-auto shrink-0" style={{ color: "#4ade80" }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs mt-10" style={{ color: "rgba(196,181,253,0.25)" }}>Powered by ScoreCalc</p>
      </div>
    </div>
  );
}
