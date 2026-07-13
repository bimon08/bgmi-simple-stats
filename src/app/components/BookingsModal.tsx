"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Tournament } from "@/lib/types";

interface BookingRow {
  id: string;
  status: string;
  entryFee: number;
  bookedByAdmin: boolean;
  wallet: { playerName: string; phone: string | null; balance: number };
}
interface BookingsData {
  bookings: BookingRow[];
  pending: number;
  confirmed: number;
  entryFee: number;
  isActive: boolean;
}

interface Props {
  tournament: Tournament;
  save: (t: Tournament) => void;
  onClose: () => void;
  onSyncNow: () => void;
}

const norm = (p?: string | null) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
};

export default function BookingsModal({ tournament, save, onClose, onSyncNow }: Props) {
  const [data, setData] = useState<BookingsData | null>(null);
  const [debiting, setDebiting] = useState(false);
  // isActive owned locally — initialized from DB on mount, not from parent prop
  const [isActive, setIsActive] = useState<boolean>(tournament.isActive ?? false);

  useEffect(() => {
    fetch(`/api/tournaments/${tournament.id}/bookings`)
      .then(r => r.json())
      .then((d: BookingsData) => {
        setData(d);
        if (d.isActive !== undefined) {
          setIsActive(d.isActive);
          // Sync DB truth back to parent React state (for the Bookings pill indicator)
          if (d.isActive !== (tournament.isActive ?? false)) {
            save({ ...tournament, isActive: d.isActive });
          }
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.id]);

  const debitAll = async () => {
    setDebiting(true);
    const res = await fetch(`/api/tournaments/${tournament.id}/bookings/debit`, { method: "POST" });
    const json = await res.json();
    setDebiting(false);
    if (json.ok) {
      toast.success(`Debited ₹${tournament.entryFee ?? 0} from ${json.debited} player${json.debited !== 1 ? "s" : ""}`);
      fetch(`/api/tournaments/${tournament.id}/bookings`).then(r => r.json()).then(setData);
    } else toast.error("Debit failed");
  };

  const bookingByPhone = new Map((data?.bookings ?? []).map(b => [norm(b.wallet.phone), b]));
  const teams = tournament.teams.filter(t => !t.out);
  // Track which bookings matched ANY team (including OUT) so OUT teams don't appear as unmatched
  const matchedBookingIds = new Set<string>();
  tournament.teams.forEach(t => {
    const b = bookingByPhone.get(norm(t.phone));
    if (b) matchedBookingIds.add(b.id);
  });
  const unmatchedBookings = (data?.bookings ?? []).filter(b => !matchedBookingIds.has(b.id));
  // Only count bookings for IN teams (not OUT)
  const inTeamPhones = new Set(teams.map(t => norm(t.phone)));
  const inTeamBookings = (data?.bookings ?? []).filter(b => inTeamPhones.has(norm(b.wallet.phone)));
  const pendingCount   = inTeamBookings.filter(b => b.status === "PENDING").length;
  const confirmedCount = inTeamBookings.filter(b => b.status === "CONFIRMED").length;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl anim-slide-up flex flex-col" style={{ background: "#13092b", border: "1px solid rgba(124,58,237,0.3)", maxHeight: "88dvh" }} onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 shrink-0">
          <p className="text-[10px] font-bold tracking-widest text-center mb-1" style={{ color: "rgba(167,139,250,0.5)" }}>SLOT BOOKINGS</p>
          <p className="text-base font-bold text-white text-center mb-3">{tournament.name}</p>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-xs font-bold shrink-0" style={{ color: "rgba(196,181,253,0.5)" }}>₹</span>
              <input
                type="number" min={0}
                value={tournament.entryFee ?? ""}
                onChange={(e) => save({ ...tournament, entryFee: Number(e.target.value) || 0 })}
                placeholder="Entry fee"
                className="flex-1 bg-transparent text-sm text-white focus:outline-none w-0"
                style={{ caretColor: "#a78bfa" }}
              />
            </div>
            <button disabled={data === null} onClick={async () => {
              const next = !isActive;
              setIsActive(next);
              save({ ...tournament, isActive: next });
              const res = await fetch(`/api/tournaments/${tournament.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: next }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error(`Toggle failed (${res.status}): ${err?.error ?? "unknown"}`);
                // Revert optimistic update
                setIsActive(!next);
                save({ ...tournament, isActive: !next });
              }
            }} className="flex items-center gap-2 px-3 py-2.5 rounded-xl shrink-0 press-scale" style={{ background: isActive ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${isActive ? "rgba(37,211,102,0.35)" : "rgba(255,255,255,0.08)"}`, opacity: data === null ? 0.4 : 1, pointerEvents: data === null ? "none" : "auto" }}>
              <div className="h-4 w-4 rounded-full flex items-center justify-center" style={{ background: isActive ? "#25d366" : "rgba(255,255,255,0.2)" }}>
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
              <span className="text-xs font-bold" style={{ color: isActive ? "#4ade80" : "rgba(196,181,253,0.4)" }}>{isActive ? "On" : "Off"}</span>
            </button>
          </div>
          <div className="flex justify-center gap-3 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(250,204,21,0.15)", color: "#fbbf24" }}>{pendingCount} pending</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(37,211,102,0.12)", color: "#4ade80" }}>{confirmedCount} confirmed</span>
            <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(196,181,253,0.5)" }}>{teams.length - teams.filter(t => bookingByPhone.has(norm(t.phone))).length} not booked</span>
          </div>
        </div>
        <div className="mx-6 h-px shrink-0" style={{ background: "rgba(124,58,237,0.12)" }} />
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {!data ? (
            <div className="flex justify-center py-8"><div className="h-5 w-5 rounded-full border-2 border-violet-700 border-t-violet-400 animate-spin" /></div>
          ) : teams.length === 0 && unmatchedBookings.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: "rgba(167,139,250,0.3)" }}>No teams registered</p>
          ) : (<>
            {teams.map((t, idx) => {
            const booking = bookingByPhone.get(norm(t.phone));
            const isConfirmed   = booking?.status === "CONFIRMED";
            const isPending     = booking?.status === "PENDING" && !booking?.bookedByAdmin;
            const isAdminBooked = booking?.bookedByAdmin === true && !isConfirmed;
            const hasBooking    = !!booking;
            return (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: isConfirmed ? "rgba(37,211,102,0.06)" : isAdminBooked ? "rgba(124,58,237,0.06)" : isPending ? "rgba(250,204,21,0.04)" : "rgba(255,255,255,0.03)", border: `1px solid ${isConfirmed ? "rgba(37,211,102,0.2)" : isAdminBooked ? "rgba(124,58,237,0.25)" : isPending ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.06)"}` }}>
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black" style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa" }}>{String(idx + 1).padStart(2, "00")}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: isConfirmed ? "#4ade80" : isAdminBooked ? "#c4b5fd" : "white" }}>{t.name}</p>
                  <p className="text-[11px] truncate" style={{ color: "rgba(167,139,250,0.4)" }}>{t.phone ?? "No number"}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {isConfirmed   && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(37,211,102,0.15)", color: "#4ade80" }}>CONFIRMED</span>}

                  {isAdminBooked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>🛡 Admin</span>}
                  {hasBooking && !isConfirmed && (
                    <button
                      onClick={async () => {
                        await fetch(`/api/tournaments/${tournament.id}/bookings/${booking!.id}`, { method: "DELETE" });
                        const d = await fetch(`/api/tournaments/${tournament.id}/bookings`).then(r => r.json());
                        setData(d);
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full press-scale"
                      style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                    >Skip</button>
                  )}
                </div>
              </div>
            );
          })}
          {/* Unmatched bookings — players who booked but aren't in any team row */}
          {unmatchedBookings.length > 0 && (
            <>
              <div className="pt-2 pb-1">
                <p className="text-[10px] font-bold tracking-wider text-center" style={{ color: "rgba(250,204,21,0.5)" }}>BOOKED WITHOUT TEAM MATCH</p>
              </div>
              {unmatchedBookings.map((b) => {
                const isConfirmed = b.status === "CONFIRMED";
                const isPending = b.status === "PENDING" && !b.bookedByAdmin;
                const isAdminBooked = b.bookedByAdmin && !isConfirmed;
                return (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: isPending ? "rgba(250,204,21,0.04)" : isAdminBooked ? "rgba(124,58,237,0.06)" : isConfirmed ? "rgba(37,211,102,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${isPending ? "rgba(250,204,21,0.15)" : isConfirmed ? "rgba(37,211,102,0.2)" : "rgba(124,58,237,0.25)"}` }}>
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-[10px]" style={{ background: "rgba(250,204,21,0.12)", color: "#fbbf24" }}>⚡</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: isConfirmed ? "#4ade80" : "#fbbf24" }}>{b.wallet.playerName}</p>
                      <p className="text-[11px] truncate" style={{ color: "rgba(167,139,250,0.4)" }}>{b.wallet.phone ?? "No number"}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {isConfirmed   && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(37,211,102,0.15)", color: "#4ade80" }}>CONFIRMED</span>}

                      {isAdminBooked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>🛡 Admin</span>}
                      {!isConfirmed && (
                        <button
                          onClick={async () => {
                            await fetch(`/api/tournaments/${tournament.id}/bookings/${b.id}`, { method: "DELETE" });
                            const d = await fetch(`/api/tournaments/${tournament.id}/bookings`).then(r => r.json());
                            setData(d);
                          }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full press-scale"
                          style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                        >Skip</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          </>)}
        </div>
        <div className="px-6 pb-5 pt-3 shrink-0 space-y-2">
          {data && pendingCount > 0 && (tournament.entryFee ?? 0) > 0 && (
            <button onClick={debitAll} disabled={debiting} className="w-full py-3.5 rounded-xl font-bold text-sm text-white press-scale disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
              {debiting ? <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Debiting…</> : `⚡ Debit All ${pendingCount} — ₹${(tournament.entryFee ?? 0) * pendingCount}`}
            </button>
          )}
          <button onClick={onClose} className="w-full py-2 text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Close</button>
        </div>
      </div>
    </div>
  );
}
