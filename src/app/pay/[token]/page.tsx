"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Plus, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { use } from "react";

type Transaction = { id: string; amount: number; note: string; createdAt: string };
type Wallet = { id: string; playerName: string; balance: number; transactions: Transaction[] };
type Roster = { teamName: string; players: string[] };
type TournamentItem = {
  id: string; name: string; entryFee: number;
  bookingStatus: string | null; bookedByAdmin: boolean; roster: Roster | null;
};

export default function PlayerWalletPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  // Per-tournament expanded + roster edit state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editPlayers, setEditPlayers] = useState<string[]>([""]);
  const [origTeamName, setOrigTeamName] = useState("");
  const [origPlayers, setOrigPlayers] = useState<string[]>([]);
  const [rosterSaving, setRosterSaving] = useState(false);
  const [rosterSaved, setRosterSaved] = useState(false);

  const refreshTournaments = useCallback(() =>
    fetch(`/api/pay/${token}/tournaments`)
      .then(r => r.ok ? r.json() : { tournaments: [] })
      .then(d => setTournaments(d.tournaments ?? [])),
    [token]);

  useEffect(() => {
    fetch(`/api/pay/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!data) setNotFound(true); else setWallet(data); setLoading(false); });
    refreshTournaments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const bookSlot = async (tournamentId: string) => {
    setBookingId(tournamentId);
    setBookMsg(null);
    const res = await fetch(`/api/pay/${token}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId }),
    });
    const data = await res.json();
    if (res.ok) { setBookMsg("✓ Slot reserved!"); refreshTournaments(); }
    else setBookMsg(data.error ?? "Booking failed");
    setBookingId(null);
  };

  const toggleExpand = (t: TournamentItem) => {
    if (expandedId === t.id) { setExpandedId(null); return; }
    setExpandedId(t.id);
    setRosterSaved(false);
    const players = t.roster?.players?.length ? [...t.roster.players] : [""];
    const name = t.roster?.teamName ?? "";
    setEditTeamName(name);
    setEditPlayers(players);
    setOrigTeamName(name);
    setOrigPlayers(players);
  };

  const saveRoster = async (tournamentId: string) => {
    setRosterSaving(true);
    await fetch(`/api/pay/${token}/roster`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, teamName: editTeamName, players: editPlayers.filter(p => p.trim()) }),
    });
    setRosterSaving(false);
    setRosterSaved(true);
    refreshTournaments();
    setTimeout(() => setRosterSaved(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="h-5 w-5 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
    </div>
  );
  if (notFound) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-2xl mb-2">🔗</p>
        <p className="text-white font-semibold">Invalid link</p>
        <p className="text-zinc-500 text-sm mt-1">This wallet link doesn&apos;t exist</p>
      </div>
    </div>
  );

  const balance = wallet!.balance;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center border-b border-zinc-800/50">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-3 text-2xl font-black text-black shadow-lg shadow-amber-500/25">
          {wallet!.playerName[0].toUpperCase()}
        </div>
        <h1 className="text-lg font-bold text-white">{wallet!.playerName}</h1>
        <p className="text-xs text-zinc-500 mt-0.5">BGMI Tournament Wallet</p>
      </div>

      {/* Balance Card */}
      <div className="px-4 py-6">
        <div className={`rounded-2xl p-6 text-center ${
          balance < 0 ? "bg-red-500/10 border border-red-500/20"
          : balance > 0 ? "bg-emerald-500/10 border border-emerald-500/20"
          : "bg-zinc-900 border border-zinc-800"
        }`}>
          <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Your Balance</p>
          <p className={`text-4xl font-black ${balance < 0 ? "text-red-400" : balance > 0 ? "text-emerald-400" : "text-zinc-400"}`}>
            ₹{Math.abs(balance)}
          </p>
          <p className={`text-sm mt-2 font-medium ${balance < 0 ? "text-red-400/70" : balance > 0 ? "text-emerald-400/70" : "text-zinc-500"}`}>
            {balance < 0 ? "You owe the organiser" : balance > 0 ? "Organiser owes you" : "All settled! ✓"}
          </p>
        </div>
      </div>

      {/* Open Tournaments */}
      {tournaments.length > 0 && (
        <div className="px-4 pb-6">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">Open Tournaments</p>
          <div className="space-y-3">
            {tournaments.map((t) => {
              const booked    = !!t.bookingStatus;
              const confirmed = t.bookingStatus === "CONFIRMED";
              const canAfford = balance >= t.entryFee;
              const isBusy    = bookingId === t.id;
              const isExpanded = expandedId === t.id;

              return (
                <div key={t.id} className="rounded-2xl overflow-hidden transition-all"
                  style={{ background: "#141414", border: isExpanded ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.07)" }}>

                  {/* ── Card Header (always tap to expand if booked) ── */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    onClick={() => booked ? toggleExpand(t) : undefined}
                    style={{ cursor: booked ? "pointer" : "default" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{t.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Entry: ₹{t.entryFee}</p>
                    </div>

                    {confirmed ? (
                      <span className="text-xs font-bold px-3 py-1.5 rounded-xl shrink-0"
                        style={{ background: "rgba(37,211,102,0.15)", color: "#4ade80" }}>✓ Paid</span>
                    ) : booked ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{
                            background: t.bookedByAdmin ? "rgba(124,58,237,0.12)" : "rgba(250,204,21,0.10)",
                            color: t.bookedByAdmin ? "#a78bfa" : "#fbbf24",
                          }}>
                          {t.bookedByAdmin ? "🛡️ Admin booked" : "⏳ Reserved"}
                        </span>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4" style={{ color: "rgba(255,255,255,0.25)" }} />
                          : <ChevronDown className="h-4 w-4" style={{ color: "rgba(255,255,255,0.25)" }} />}
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); bookSlot(t.id); }}
                        disabled={!canAfford || isBusy}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 disabled:opacity-40 active:scale-95 transition-all"
                        style={{ background: canAfford ? "rgba(124,58,237,0.8)" : "rgba(255,255,255,0.07)", color: "white" }}
                      >
                        {isBusy ? "…" : canAfford ? "Book Slot" : "Low Balance"}
                      </button>
                    )}
                  </button>

                  {/* ── Expanded Roster Panel ── */}
                  {isExpanded && booked && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: "rgba(124,58,237,0.2)" }}>
                      <p className="text-[11px] font-bold uppercase tracking-wider pt-2" style={{ color: "rgba(167,139,250,0.6)" }}>Your Roster</p>

                      {/* Team Name */}
                      <input
                        value={editTeamName}
                        onChange={e => setEditTeamName(e.target.value)}
                        placeholder="Team name"
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />

                      {/* Player Fields */}
                      <div className="space-y-2">
                        {editPlayers.map((p, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[11px] font-bold w-5 text-center shrink-0" style={{ color: "rgba(167,139,250,0.4)" }}>
                              {i + 1}
                            </span>
                            <input
                              value={p}
                              onChange={e => { const arr = [...editPlayers]; arr[i] = e.target.value; setEditPlayers(arr); }}
                              placeholder={`Player ${i + 1} IGN`}
                              className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none"
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                            />
                            {editPlayers.length > 1 && (
                              <button
                                onClick={() => setEditPlayers(editPlayers.filter((_, j) => j !== i))}
                                className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
                                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }}
                              >
                                <X className="h-3.5 w-3.5 text-red-400" />
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Add Player */}
                        <button
                          onClick={() => setEditPlayers([...editPlayers, ""])}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 w-full"
                          style={{ background: "rgba(34,197,94,0.1)", border: "1px dashed rgba(34,197,94,0.3)", color: "#4ade80" }}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Player
                        </button>
                      </div>

                      {/* Save */}
                      <button
                        onClick={() => saveRoster(t.id)}
                        disabled={rosterSaving || rosterSaved || (
                          editTeamName === origTeamName &&
                          JSON.stringify(editPlayers.filter(p => p.trim())) === JSON.stringify(origPlayers.filter(p => p.trim()))
                        )}
                        className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
                        style={{ background: rosterSaved ? "rgba(34,197,94,0.2)" : "rgba(124,58,237,0.8)", color: rosterSaved ? "#4ade80" : "white", border: rosterSaved ? "1px solid rgba(34,197,94,0.4)" : "none" }}
                      >
                        {rosterSaving
                          ? <><div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Saving…</>
                          : rosterSaved
                          ? <><Check className="h-4 w-4" /> Saved!</>
                          : "Save Roster"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {bookMsg && (
              <p className="text-center text-sm" style={{ color: bookMsg.startsWith("✓") ? "#4ade80" : "#f87171" }}>{bookMsg}</p>
            )}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="px-4 pb-10">
        <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5">Transaction History</p>
        {wallet!.transactions.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-1.5">
            {wallet!.transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${t.amount < 0 ? "bg-red-500/15" : "bg-emerald-500/15"}`}>
                  {t.amount < 0 ? <TrendingDown className="h-3.5 w-3.5 text-red-400" /> : <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">{t.note}</p>
                  <p className="text-[10px] text-zinc-600">{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${t.amount < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {t.amount < 0 ? "−" : "+"}₹{Math.abs(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-center pb-8"><p className="text-[10px] text-zinc-700">BGMI × Simple Stats</p></div>
    </div>
  );
}
