"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Tournament } from "@/lib/types";

interface BookingRow {
  id: string;
  status: string;
  entryFee: number;
  wallet: { playerName: string; phone: string | null; balance: number };
}
interface BookingsData {
  bookings: BookingRow[];
  pending: number;
  confirmed: number;
  entryFee: number;
}

interface Props {
  tournament: Tournament;
  save: (t: Tournament) => void;
  onClose: () => void;
}

const norm = (p?: string | null) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
};

export default function BookingsModal({ tournament, save, onClose }: Props) {
  const [data, setData] = useState<BookingsData | null>(null);
  const [debiting, setDebiting] = useState(false);

  useEffect(() => {
    fetch(`/api/tournaments/${tournament.id}/bookings`).then(r => r.json()).then(setData);
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
  const teams = tournament.teams;
  const pendingCount   = teams.filter(t => bookingByPhone.get(norm(t.phone))?.status === "PENDING").length;
  const confirmedCount = teams.filter(t => bookingByPhone.get(norm(t.phone))?.status === "CONFIRMED").length;

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
            <button onClick={() => save({ ...tournament, isActive: !(tournament.isActive ?? false) })} className="flex items-center gap-2 px-3 py-2.5 rounded-xl shrink-0 press-scale" style={{ background: tournament.isActive ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${tournament.isActive ? "rgba(37,211,102,0.35)" : "rgba(255,255,255,0.08)"}` }}>
              <div className="h-4 w-4 rounded-full flex items-center justify-center" style={{ background: tournament.isActive ? "#25d366" : "rgba(255,255,255,0.2)" }}>
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
              <span className="text-xs font-bold" style={{ color: tournament.isActive ? "#4ade80" : "rgba(196,181,253,0.4)" }}>{tournament.isActive ? "On" : "Off"}</span>
            </button>
          </div>
          <div className="flex justify-center gap-3 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(250,204,21,0.15)", color: "#fbbf24" }}>{pendingCount} pending</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(37,211,102,0.12)", color: "#4ade80" }}>{confirmedCount} confirmed</span>
            <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(196,181,253,0.5)" }}>{teams.length - pendingCount - confirmedCount} not booked</span>
          </div>
        </div>
        <div className="mx-6 h-px shrink-0" style={{ background: "rgba(124,58,237,0.12)" }} />
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {!data ? (
            <div className="flex justify-center py-8"><div className="h-5 w-5 rounded-full border-2 border-violet-700 border-t-violet-400 animate-spin" /></div>
          ) : teams.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: "rgba(167,139,250,0.3)" }}>No teams registered</p>
          ) : teams.map((t, idx) => {
            const booking = bookingByPhone.get(norm(t.phone));
            const isConfirmed  = booking?.status === "CONFIRMED";
            const isPending    = booking?.status === "PENDING";
            const isManualPaid = t.paid === true && !booking;
            return (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: isConfirmed || isManualPaid ? "rgba(37,211,102,0.06)" : isPending ? "rgba(250,204,21,0.04)" : "rgba(255,255,255,0.03)", border: `1px solid ${isConfirmed || isManualPaid ? "rgba(37,211,102,0.2)" : isPending ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.06)"}` }}>
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black" style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa" }}>{String(idx + 1).padStart(2, "00")}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: isConfirmed || isManualPaid ? "#4ade80" : "white" }}>{t.name}</p>
                  <p className="text-[11px] truncate" style={{ color: "rgba(167,139,250,0.4)" }}>{t.phone ?? "No number"}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {isConfirmed  && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(37,211,102,0.15)", color: "#4ade80" }}>CONFIRMED</span>}
                  {isPending    && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(250,204,21,0.15)", color: "#fbbf24" }}>PENDING</span>}
                  {isManualPaid && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>PAID ✓</span>}
                  {!booking && !isManualPaid && (
                    <button onClick={() => { save({ ...tournament, teams: tournament.teams.map(tm => tm.id === t.id ? { ...tm, paid: true } : tm) }); toast.success(`${t.name} marked as paid`); }} className="text-[10px] font-bold px-2 py-0.5 rounded-full press-scale" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(196,181,253,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>Mark Paid</button>
                  )}
                </div>
              </div>
            );
          })}
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
