"use client";
import { useState, ReactNode } from "react";
import {
  Plus, Trash2, Share2, Users, MoreHorizontal,
  FileDown, Database, Table2, Flame, ImageIcon, Pencil, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Tournament } from "@/lib/types";

/* ── Inline sub-components ── */
function QuickBtn({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <div className="h-14 w-14 rounded-2xl flex items-center justify-center transition-all active:scale-90" style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(139,92,246,0.28)", color: "#c4b5fd" }}>{icon}</div>
      <span className="text-[10px] text-center font-medium leading-tight whitespace-pre-line" style={{ color: "rgba(196,181,253,0.7)" }}>{label}</span>
    </button>
  );
}

function Pill({ label, icon, onPress, active = false, variant = "default" }: {
  label: string; icon?: ReactNode; onPress: () => void; active?: boolean; variant?: "default" | "share" | "edit";
}) {
  const base = "px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 select-none";
  if (variant === "share" || variant === "edit") {
    return <button onClick={onPress} className={base} style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(30,24,48,0.9)", color: "rgba(196,181,253,0.85)" }}>{icon}{label}</button>;
  }
  return <button onClick={onPress} className={base} style={{ border: `1px solid ${active ? "rgba(139,92,246,0.9)" : "rgba(139,92,246,0.35)"}`, background: active ? "rgba(124,58,237,0.3)" : "transparent", color: active ? "#c4b5fd" : "rgba(196,181,253,0.65)" }}>{icon}{label}</button>;
}

/* ── Props ── */
interface Props {
  appName: string;
  tournaments: Tournament[];
  tournament: Tournament | null;
  setTournament: (t: Tournament) => void;
  pageLoaded: boolean;
  syncStatus: string;
  isCollab: (t: Tournament) => boolean;
  onSync: () => void;
  onOpenAction: (t: Tournament, action: string) => void;
  onShare: (t: Tournament) => void;
  onDelete: (id: string) => void;
  onCollabDelete: (id: string) => void;
  onCreateOpen: () => void;
  onImportOpen: () => void;
  save: (t: Tournament) => void;
}

export default function MainView({
  appName, tournaments, tournament, setTournament, pageLoaded, syncStatus,
  isCollab, onSync, onOpenAction, onShare, onDelete, onCollabDelete,
  onCreateOpen, onImportOpen, save,
}: Props) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [tournamentTab, setTournamentTab] = useState<'mine' | 'shared'>('mine');

  const toggleCard = (id: string) => setExpandedCards(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const mineCount = tournaments.filter(t => !isCollab(t)).length;
  const sharedCount = tournaments.filter(t => isCollab(t)).length;
  const visible = tournaments.filter(t => tournamentTab === 'shared' ? isCollab(t) : !isCollab(t));

  return (
    <>
      {/* HEADER */}
      <div className="pt-6 pb-6 text-center px-4 anim-slide-up">
        <p className="text-2xl mb-0.5" style={{ fontFamily: "'Dancing Script', cursive", color: "#c4b5fd" }}>Welcome to</p>
        <h1 className="text-4xl font-black text-white tracking-tight" suppressHydrationWarning>{appName}</h1>
      </div>

      <div className="px-4 space-y-6 max-w-md mx-auto">
        {/* QUICK ACTIONS */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "#7c3aed" }} />
            <span className="text-sm font-bold text-white">Quick Actions</span>
          </div>
          <div className="rounded-2xl p-5 anim-slide-up" style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.18)", animationDelay: "60ms" }}>
            <div className="flex justify-around">
              <QuickBtn icon={<Users className="h-5 w-5" />} label={"Create\nTeam card"} onClick={onCreateOpen} />
              <QuickBtn icon={<FileDown className="h-5 w-5" />} label={"Import\nTourney"} onClick={onImportOpen} />
              <QuickBtn icon={<Database className="h-5 w-5" />} label={"Import\nTeam card"} onClick={() => toast("Coming soon")} />
              <QuickBtn icon={<Flame className="h-5 w-5" />} label={"Merge\nTourney"} onClick={() => toast("Coming soon")} />
            </div>
          </div>
        </section>

        {/* ALL TOURNAMENTS */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "#7c3aed" }} />
            <span className="text-sm font-bold text-white flex-1">Tournaments</span>
            <button
              onClick={() => syncStatus === 'unauthed' ? (window.location.href = '/login') : onSync()}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold press-scale disabled:opacity-60 transition-all"
              style={{
                background: syncStatus === 'unauthed' ? "rgba(239,68,68,0.15)" : syncStatus === 'offline' ? "rgba(251,146,60,0.15)" : "rgba(124,58,237,0.15)",
                color: syncStatus === 'unauthed' ? "rgb(248,113,113)" : syncStatus === 'offline' ? "rgb(251,146,60)" : syncStatus === 'synced' ? "rgb(74,222,128)" : "rgba(167,139,250,0.8)",
                border: `1px solid ${syncStatus === 'unauthed' ? 'rgba(239,68,68,0.3)' : syncStatus === 'offline' ? 'rgba(251,146,60,0.3)' : syncStatus === 'synced' ? 'rgba(74,222,128,0.3)' : 'rgba(124,58,237,0.2)'}`,
              }}
            >
              {syncStatus === 'syncing' || syncStatus === 'pending'
                ? <div className={`h-3 w-3 rounded-full border-2 border-current border-t-transparent ${syncStatus === 'syncing' ? 'animate-spin' : 'animate-spin opacity-50'}`} />
                : <RefreshCw className="h-3 w-3" />}
              {syncStatus === 'syncing' ? "Syncing…" : syncStatus === 'pending' ? "Saving…" : syncStatus === 'offline' ? "Offline" : syncStatus === 'unauthed' ? "Session expired" : syncStatus === 'synced' ? "Synced" : "Sync"}
            </button>
          </div>

          {/* Mine / Shared tabs */}
          <div className="flex gap-1 mb-3 p-0.5 rounded-lg" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.14)", display: "inline-flex" }}>
            {([['mine', 'Mine', mineCount], ['shared', 'Shared', sharedCount]] as const).map(([tab, label, count]) => (
              <button key={tab} onClick={() => setTournamentTab(tab)} className="flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold transition-all" style={{ background: tournamentTab === tab ? "rgba(124,58,237,0.35)" : "transparent", color: tournamentTab === tab ? "#c4b5fd" : "rgba(167,139,250,0.4)" }}>
                {label}
                {count > 0 && <span className="px-1 rounded-full text-[9px] font-black" style={{ background: tournamentTab === tab ? "rgba(124,58,237,0.5)" : "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>{count}</span>}
              </button>
            ))}
          </div>

          {/* Empty state */}
          {pageLoaded && visible.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm font-medium" style={{ color: "rgba(167,139,250,0.4)" }}>{tournamentTab === 'shared' ? 'No shared tournaments' : 'No tournaments yet'}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(167,139,250,0.25)" }}>{tournamentTab === 'shared' ? 'Import a tournament using a 6-char code' : 'Tap + Create to get started'}</p>
            </div>
          )}

          {/* Skeleton */}
          {!pageLoaded && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.12)" }}>
                  <div className="h-9 w-9 rounded-xl shrink-0 skeleton-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 rounded-lg skeleton-pulse" style={{ width: `${55 + i * 12}%` }} />
                    <div className="h-2.5 rounded-lg skeleton-pulse" style={{ width: "35%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tournament cards */}
          <div className="space-y-3">
            {visible.map((t, i) => {
              const isOpen = expandedCards.has(t.id);
              return (
                <div key={t.id} className="rounded-2xl overflow-hidden relative" style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.18)", transition: "box-shadow 200ms" }}>
                  <div role="button" tabIndex={0} className="w-full flex items-center gap-3 p-4 pr-12 text-left press-scale cursor-pointer" onClick={() => renamingId !== t.id && toggleCard(t.id)} onKeyDown={(e) => e.key === "Enter" && renamingId !== t.id && toggleCard(t.id)}>
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black" style={{ background: "rgba(124,58,237,0.22)", color: "#a78bfa" }}>{String(i + 1).padStart(2, "0")}</div>
                    <div className="flex-1 min-w-0 text-left">
                      {renamingId === t.id ? (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && renameValue.trim()) { const renamed = { ...t, name: renameValue.trim() }; save(renamed); if (tournament?.id === t.id) setTournament(renamed); setRenamingId(null); } if (e.key === "Escape") setRenamingId(null); }} className="flex-1 min-w-0 bg-transparent text-sm font-bold text-white focus:outline-none border-b border-violet-500/50" />
                          <button onClick={() => { if (renameValue.trim()) { const renamed = { ...t, name: renameValue.trim() }; save(renamed); if (tournament?.id === t.id) setTournament(renamed); } setRenamingId(null); }} className="shrink-0 text-emerald-400 text-xs font-bold px-1">✓</button>
                          <button onClick={() => setRenamingId(null)} className="shrink-0 text-zinc-500 text-xs px-1">✕</button>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-white truncate active:underline" onDoubleClick={e => { e.stopPropagation(); setRenamingId(t.id); setRenameValue(t.name); }}>{t.name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>Teams: {t.teams.filter(tm => !tm.out).length}{t.splitEnabled && ` · ${t.groupCount ?? 2} Groups`}</p>
                        {t.updatedAt && <span className="text-[10px]" style={{ color: "rgba(167,139,250,0.3)" }}>· {new Date(t.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Delete button */}
                  <button onClick={() => isCollab(t) ? onCollabDelete(t.id) : onDelete(t.id)} className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors active:scale-90" style={{ color: "rgba(124,58,237,0.5)" }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {/* Pill section */}
                  <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows 280ms cubic-bezier(0.4,0,0.2,1)" }}>
                    <div style={{ overflow: "hidden" }}>
                      <div className="px-4 pb-4">
                        <div className="h-px mb-3" style={{ background: "rgba(124,58,237,0.12)" }} />
                        <div className="flex flex-wrap gap-1.5">
                          <Pill label="Calculate" onPress={() => onOpenAction(t, "calculate")} active />
                          <Pill label="Tables" onPress={() => onOpenAction(t, "tables")} />
                          <Pill label="Team poster" onPress={() => onOpenAction(t, "poster")} />
                          <Pill label="Slot list" onPress={() => onOpenAction(t, "slots")} />
                          <Pill label="Certificate" onPress={() => onOpenAction(t, "certificate")} />
                          <Pill label="Room Info" icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.859L0 24l6.335-1.518A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.371l-.36-.214-3.722.892.934-3.617-.236-.373A9.818 9.818 0 0112 2.182c5.418 0 9.818 4.4 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818z" /></svg>} onPress={() => onOpenAction(t, "room-info")} />
                          <Pill label="Rules" onPress={() => onOpenAction(t, "rules")} />
                          <Pill label={`Bookings${t.isActive ? " 🟢" : ""}`} onPress={() => onOpenAction(t, "bookings")} />
                          <Pill label="Share" icon={<Share2 className="h-3 w-3" />} onPress={() => onShare(t)} variant="share" />
                          <Pill label="Edit" icon={<Pencil className="h-3 w-3" />} onPress={() => onOpenAction(t, "edit")} variant="edit" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* FABs */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
        {showMore && (
          <div className="rounded-2xl overflow-hidden shadow-2xl mb-1 anim-scale-in" style={{ background: "#1e1630", border: "1px solid rgba(124,58,237,0.25)" }}>
            {[
              { label: "Backup & Restore", icon: <Database className="h-4 w-4" />, action: () => { const d = JSON.stringify(tournaments, null, 2); const a = document.createElement("a"); a.download = "scrimcalc-backup.json"; a.href = URL.createObjectURL(new Blob([d], { type: "application/json" })); a.click(); setShowMore(false); toast.success("Backup downloaded!"); } },
              { label: "Import custom design", icon: <ImageIcon className="h-4 w-4" />, action: () => toast("Coming soon") },
              { label: "Tournament from Excel/CSV", icon: <Table2 className="h-4 w-4" />, action: () => toast("Coming soon") },
            ].map((item, idx, arr) => (
              <button key={idx} onClick={item.action} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-left transition-colors active:bg-purple-900/20" style={{ color: "#c4b5fd", borderBottom: idx < arr.length - 1 ? "1px solid rgba(124,58,237,0.12)" : "none" }}>
                <span style={{ color: "#8b5cf6" }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setShowMore(!showMore)} className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg press-scale" style={{ background: "#2a1f42", color: "#c4b5fd" }}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
        <button onClick={() => { setShowMore(false); onCreateOpen(); }} className="flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg press-scale" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 24px rgba(124,58,237,0.45)" }}>
          <Plus className="h-4 w-4" /> Create
        </button>
      </div>
    </>
  );
}
