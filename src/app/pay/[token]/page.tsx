"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Pencil, Check, X, Phone } from "lucide-react";
import { use } from "react";

type Transaction = { id: string; amount: number; note: string; createdAt: string };
type Wallet = { id: string; playerName: string; phone: string | null; balance: number; transactions: Transaction[] };
type TournamentItem = {
  id: string; name: string; entryFee: number;
  bookingStatus: string | null; bookingId: string | null; bookedByAdmin: boolean;
  roster: { players: string[]; teamName: string } | null;
};

export default function PlayerWalletPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // Roster form: tournamentId → player names being entered
  const [rosterForm, setRosterForm] = useState<{ id: string; players: string[]; teamName: string; editBookingId?: string; originalPlayers?: string[]; originalTeamName?: string } | null>(null);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const refreshTournaments = useCallback(() =>
    fetch(`/api/pay/${token}/tournaments`)
      .then(r => r.ok ? r.json() : { tournaments: [] })
      .then(d => setTournaments(d.tournaments ?? [])),
    [token]);

  useEffect(() => {
    fetch(`/api/pay/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!data) setNotFound(true); else { setWallet(data); setNameInput(data.playerName); } setLoading(false); });
    refreshTournaments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const bookSlot = async (tournamentId: string, players: string[], editBookingId?: string) => {
    const filled = players.map(p => p.trim()).filter(Boolean);
    if (filled.length < 2) { setBookMsg("Enter at least 2 player names"); return; }
    setBookingId(tournamentId);
    setBookMsg(null);
    const teamName = rosterForm?.teamName?.trim() || "";
    if (!teamName) { setBookMsg("Enter a team name"); return; }
    const method = editBookingId ? "PATCH" : "POST";
    const body = editBookingId
      ? JSON.stringify({ bookingId: editBookingId, players: filled, teamName })
      : JSON.stringify({ tournamentId, players: filled, teamName });
    const res = await fetch(`/api/pay/${token}/book`, {
      method,
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();
    if (res.ok) { setBookMsg(editBookingId ? "✓ Players updated!" : "✓ Slot booked!"); setRosterForm(null); refreshTournaments(); }
    else setBookMsg(data.error ?? (editBookingId ? "Update failed" : "Booking failed"));
    setBookingId(null);
  };

  const cancelBooking = async (bId: string, tournamentId: string) => {
    setCancellingId(tournamentId);
    const res = await fetch(`/api/pay/${token}/book`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: bId }),
    });
    const data = await res.json();
    if (res.ok) { setBookMsg("Booking cancelled"); refreshTournaments(); }
    else setBookMsg(data.error ?? "Cancel failed");
    setCancellingId(null);
  };

  const saveName = async () => {
    const clean = nameInput.trim();
    if (!clean) { setNameError("Name required"); return; }
    if (!/^[a-zA-Z0-9 ]+$/.test(clean)) { setNameError("Only English letters, numbers & spaces"); return; }
    setNameSaving(true);
    const res = await fetch(`/api/pay/${token}/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: clean }),
    });
    const data = await res.json();
    setNameSaving(false);
    if (res.ok) {
      setWallet(w => w ? { ...w, playerName: data.playerName } : w);
      setNameInput(data.playerName);
      setEditingName(false);
      setNameError("");
    } else {
      setNameError(data.error ?? "Failed to save");
    }
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

        {/* Name display / edit */}
        {editingName ? (
          <div className="flex items-center justify-center gap-2 mt-1">
            <input
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setNameError(""); }}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNameInput(wallet!.playerName); setNameError(""); }}}
              autoFocus
              maxLength={30}
              className="text-base font-bold text-white bg-transparent border-b border-amber-500/60 focus:outline-none text-center w-40"
              placeholder="Your name"
            />
            <button onClick={saveName} disabled={nameSaving} className="h-7 w-7 rounded-full flex items-center justify-center active:scale-90" style={{ background: "rgba(34,197,94,0.2)" }}>
              {nameSaving ? <div className="h-3 w-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-400" />}
            </button>
            <button onClick={() => { setEditingName(false); setNameInput(wallet!.playerName); setNameError(""); }} className="h-7 w-7 rounded-full flex items-center justify-center active:scale-90" style={{ background: "rgba(239,68,68,0.15)" }}>
              <X className="h-3.5 w-3.5 text-red-400" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingName(true); setNameInput(wallet!.playerName); }}
            className="flex items-center justify-center gap-1.5 mx-auto group"
          >
            <h1 className="text-lg font-bold text-white">{wallet!.playerName}</h1>
            <Pencil className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </button>
        )}
        {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}

        {/* Phone */}
        {wallet!.phone && (() => {
          const raw = wallet!.phone!;
          // Insert space after country code: total digits - 10 = country code length
          const display = raw.replace(/^(\+)(\d+)$/, (_, plus, digits) => {
            if (digits.length > 10) {
              const ccLen = digits.length - 10;
              return `${plus}${digits.slice(0, ccLen)} ${digits.slice(ccLen)}`;
            }
            return raw;
          });
          return (
            <p className="text-xs text-zinc-500 mt-1 flex items-center justify-center gap-1.5">
              <Phone className="h-3 w-3 shrink-0" />
              {display}
            </p>
          );
        })()}
        <p className="text-[10px] text-zinc-700 mt-0.5">BGMI Tournament Wallet</p>
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
          {(() => {
            const reserved = tournaments.filter(t => t.bookingStatus && t.bookingStatus !== "CONFIRMED");
            if (!reserved.length) return null;
            const totalFees = reserved.reduce((sum, t) => sum + (t.entryFee ?? 0), 0);
            const names = reserved.map(r => r.name).join(", ");

            if (totalFees > 0) {
              return <p className="text-xs mt-2" style={{ color: "rgba(74,222,128,0.45)" }}>
                ₹{totalFees} is reserved from ₹{balance} for {names}
              </p>;
            }
            return <p className="text-xs mt-2" style={{ color: "rgba(74,222,128,0.45)" }}>
              {reserved.length} slot{reserved.length > 1 ? "s" : ""} reserved for {names}
            </p>;
          })()}
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
              const skipped   = t.bookingStatus === "SKIPPED";
              const canAfford = balance >= t.entryFee;
              const isBusy    = bookingId === t.id;
              const isCancelling = cancellingId === t.id;
              const selfBooked = booked && !t.bookedByAdmin && !confirmed;
              const canEdit = booked && !confirmed; // both self and admin-booked can edit
              const showForm  = rosterForm?.id === t.id;
              const openEdit = canEdit && !showForm ? () => {
                const existingPlayers = t.roster?.players ?? [];
                const prefilled = [wallet!.playerName, ...existingPlayers.slice(1)];
                while (prefilled.length < 4) prefilled.push("");
                const existingTeamName = t.roster?.teamName ?? "";
                setRosterForm({ id: t.id, players: prefilled, teamName: existingTeamName, editBookingId: t.bookingId!, originalPlayers: [...prefilled], originalTeamName: existingTeamName });
                setBookMsg(null);
              } : undefined;

              return (
                <div key={t.id} className="rounded-2xl overflow-hidden"
                  style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3.5 ${openEdit || showForm ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
                    onClick={showForm ? () => { setRosterForm(null); setBookMsg(null); } : openEdit}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{t.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Entry: ₹{t.entryFee}</p>
                    </div>

                    {confirmed ? (
                      <span className="text-xs font-bold px-3 py-1.5 rounded-xl shrink-0"
                        style={{ background: "rgba(37,211,102,0.15)", color: "#4ade80" }}>✓ Paid</span>
                    ) : booked ? (
                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{
                            background: t.bookedByAdmin ? "rgba(124,58,237,0.12)" : "rgba(37,211,102,0.10)",
                            color: t.bookedByAdmin ? "#a78bfa" : "#4ade80",
                          }}>
                          {t.bookedByAdmin ? "🛡️ Booked by Admin" : "✓ Booked"}
                        </span>
                        {selfBooked && showForm && (
                          <button onClick={() => { cancelBooking(t.bookingId!, t.id); setRosterForm(null); }}
                            disabled={isCancelling}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg disabled:opacity-40 active:scale-95 transition-all"
                            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                            {isCancelling ? "…" : "Cancel"}
                          </button>
                        )}
                      </div>
                    ) : showForm ? null : (
                      <button
                        onClick={e => { e.stopPropagation(); setRosterForm({ id: t.id, players: [wallet!.playerName, "", "", ""], teamName: "" }); }}
                        disabled={isBusy}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 disabled:opacity-40 active:scale-95 transition-all"
                        style={{ background: "rgba(124,58,237,0.8)", color: "white" }}
                      >
                        {canAfford ? "Book Slot" : "Book (low bal)"}
                      </button>
                    )}
                  </div>

                  {/* Player roster form */}
                  {showForm && (
                    <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                      <input
                        value={rosterForm!.teamName}
                        onChange={e => setRosterForm(f => f ? { ...f, teamName: e.target.value } : f)}
                        placeholder="Team Name *"
                        className="w-full bg-zinc-800 text-white text-sm font-bold rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                      {rosterForm!.players.map((p, i) => (
                        i === 0 ? (
                          <div key={i} className="w-full bg-zinc-900 text-zinc-400 text-sm rounded-lg px-3 py-2 flex items-center gap-2 border border-zinc-700/50">
                            <span className="text-zinc-600 text-xs">👑</span>
                            <span className="flex-1 truncate">{p}</span>
                            <span className="text-[10px] text-zinc-600">Leader</span>
                          </div>
                        ) : (
                          <div key={i} className="flex gap-1.5 items-center">
                            <input
                              value={p}
                              onChange={e => setRosterForm(f => f ? { ...f, players: f.players.map((v, j) => j === i ? e.target.value : v) } : f)}
                              placeholder={`Player ${i + 1}${i === 1 ? " *" : ""}`}
                              className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                            {i >= 4 && (
                              <button
                                onClick={() => setRosterForm(f => f ? { ...f, players: f.players.filter((_, j) => j !== i) } : f)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 text-zinc-500 hover:text-red-400 active:scale-90 transition-all"
                                style={{ background: "rgba(255,255,255,0.05)" }}
                              >×</button>
                            )}
                          </div>
                        )
                      ))}
                      {/* Add player button */}
                      <button
                        onClick={() => setRosterForm(f => f ? { ...f, players: [...f.players, ""] } : f)}
                        className="w-full py-2 text-sm rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(167,139,250,0.6)", border: "1px dashed rgba(124,58,237,0.25)" }}
                      >
                        <span className="text-base leading-none">+</span> Add player
                      </button>
                      <div className="pt-1">
                        <button onClick={() => bookSlot(t.id, rosterForm!.players, rosterForm!.editBookingId)}
                          disabled={isBusy || !rosterForm!.teamName?.trim() || !rosterForm!.players[1]?.trim() || (
                            !!rosterForm!.editBookingId &&
                            rosterForm!.teamName.trim() === (rosterForm!.originalTeamName ?? "").trim() &&
                            JSON.stringify(rosterForm!.players.map(p => p.trim()).filter(Boolean)) ===
                            JSON.stringify((rosterForm!.originalPlayers ?? []).map(p => p.trim()).filter(Boolean))
                          )}
                          className="w-full py-2 text-sm font-bold rounded-lg disabled:opacity-40 active:scale-95 transition-all"
                          style={{ background: "rgba(124,58,237,0.8)", color: "white" }}>
                          {isBusy ? "…" : "Confirm Booking"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {bookMsg && (
              <p className="text-center text-sm" style={{ color: bookMsg.startsWith("✓") || bookMsg.includes("updated") || bookMsg.includes("cancelled") ? "#4ade80" : "#f87171" }}>{bookMsg}</p>
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
