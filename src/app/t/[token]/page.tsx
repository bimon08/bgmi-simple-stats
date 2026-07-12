"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Tournament, Team } from "@/lib/types";
import { Plus, Trash2, RefreshCw, Check, Phone } from "lucide-react";

const REFRESH_MS = 15_000;

export default function SharedTournamentPage() {
  const { token } = useParams<{ token: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Add team form
  const [teamName, setTeamName] = useState("");
  const [teamPhone, setTeamPhone] = useState("");

  const tournamentRef = useRef<Tournament | null>(null);
  tournamentRef.current = tournament;

  // ── fetch latest from server ──────────────────────────────────────────────
  const fetchLatest = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setSyncing(true);
    const res = await fetch(`/api/share/${token}`);
    const data = await res.json();
    if (!quiet) setLoading(false);
    else setSyncing(false);
    if (data.error || !data.tournament) { setError("Tournament not found."); return; }
    setTournament(data.tournament);
  }, [token]);

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(() => fetchLatest(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  // ── save to server (debounced via ref) ───────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToServer = useCallback((t: Tournament) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fetch(`/api/share/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament: t }),
      });
      setSaving(false);
      setLastSaved(new Date());
    }, 800);
  }, [token]);

  const updateTournament = (updated: Tournament) => {
    setTournament(updated);
    saveToServer(updated);
  };

  // ── add team ─────────────────────────────────────────────────────────────
  const addTeam = () => {
    if (!teamName.trim() || !tournament) return;
    const newTeam: Team = {
      id: crypto.randomUUID(),
      name: teamName.trim(),
      phone: teamPhone.replace(/\D/g, "") || undefined,
      players: [],
      paid: false,
    };
    updateTournament({ ...tournament, teams: [...tournament.teams, newTeam] });
    setTeamName("");
    setTeamPhone("");
  };

  // ── delete team ───────────────────────────────────────────────────────────
  const deleteTeam = (id: string) => {
    if (!tournament) return;
    updateTournament({ ...tournament, teams: tournament.teams.filter(t => t.id !== id) });
  };

  // ── loading / error states ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: "#0a0614" }}>
      <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );
  if (error || !tournament) return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4" style={{ background: "#0a0614" }}>
      <span style={{ fontSize: 48 }}>🔗</span>
      <p className="text-white font-bold text-lg">Link not found</p>
    </div>
  );

  return (
    <div className="min-h-dvh pb-10" style={{ background: "linear-gradient(135deg,#0a0614 0%,#130a2e 100%)" }}>
      {/* Header */}
      <div className="px-4 pt-10 pb-5 text-center sticky top-0 z-10 backdrop-blur-md" style={{ background: "rgba(10,6,20,0.85)", borderBottom: "1px solid rgba(124,58,237,0.15)" }}>
        <p className="text-[10px] font-bold tracking-widest mb-1" style={{ color: "rgba(167,139,250,0.5)" }}>COLLABORATIVE EDIT</p>
        <h1 className="text-xl font-black text-white">{tournament.name}</h1>
        <div className="flex items-center justify-center gap-3 mt-2">
          <span className="text-xs px-2 py-0.5 rounded-lg font-bold" style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}>
            {tournament.teams.length} teams
          </span>
          {tournament.isActive && (
            <span className="text-xs px-2 py-0.5 rounded-lg font-bold" style={{ background: "rgba(37,211,102,0.12)", color: "#4ade80" }}>
              🟢 Booking Open · ₹{tournament.entryFee}
            </span>
          )}
          {/* Sync status */}
          <span className="text-xs flex items-center gap-1" style={{ color: "rgba(167,139,250,0.45)" }}>
            {saving ? (
              <><div className="h-3 w-3 rounded-full border border-violet-500 border-t-transparent animate-spin" /> Saving…</>
            ) : syncing ? (
              <><RefreshCw className="h-3 w-3 animate-spin" /> Syncing…</>
            ) : lastSaved ? (
              <><Check className="h-3 w-3 text-green-400" /> Saved</>
            ) : null}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        {/* Add team form */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <p className="text-[10px] font-bold tracking-widest" style={{ color: "rgba(167,139,250,0.5)" }}>ADD TEAM</p>
          <input
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && teamName.trim()) addTeam(); }}
            placeholder="Team name"
            className="w-full bg-transparent text-white text-sm focus:outline-none py-2 border-b"
            style={{ borderColor: "rgba(124,58,237,0.25)", caretColor: "#a78bfa" }}
          />
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(167,139,250,0.4)" }} />
            <input
              value={teamPhone}
              onChange={e => setTeamPhone(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && teamName.trim()) addTeam(); }}
              placeholder="Leader phone (optional)"
              className="flex-1 bg-transparent text-white text-sm focus:outline-none"
              style={{ caretColor: "#a78bfa" }}
            />
          </div>
          <button
            onClick={addTeam}
            disabled={!teamName.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
          >
            <Plus className="h-4 w-4" /> Add Team
          </button>
        </div>

        {/* Team list */}
        <p className="text-[10px] font-bold tracking-widest px-1" style={{ color: "rgba(167,139,250,0.4)" }}>REGISTERED TEAMS</p>
        {tournament.teams.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: "rgba(167,139,250,0.25)" }}>No teams yet</p>
        ) : (
          <div className="space-y-2">
            {tournament.teams.map((team, i) => (
              <div key={team.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.1)" }}>
                <span className="text-xs font-bold w-6 shrink-0 text-center" style={{ color: "rgba(139,92,246,0.6)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{team.name}</p>
                  {team.phone && (
                    <p className="text-[11px] truncate" style={{ color: "rgba(167,139,250,0.4)" }}>{team.phone}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteTeam(team.id)}
                  className="p-1.5 rounded-lg active:scale-90 transition-all"
                  style={{ color: "rgba(248,113,113,0.5)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-[10px] pt-4" style={{ color: "rgba(167,139,250,0.2)" }}>
          Auto-syncs every 15s · Changes visible to all editors
        </p>
      </div>
    </div>
  );
}
