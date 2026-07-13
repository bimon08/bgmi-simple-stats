"use client";
import React, { useState } from "react";
import { X, ImageIcon, HelpCircle, UserPlus, Phone, Plus, Clipboard, Users, Trophy, Search } from "lucide-react";
import { toast } from "sonner";
import { Tournament, Team } from "@/lib/types";

interface AddForm { name: string; tags: string; phone: string; }
interface SnapShot { teamCount: number; entryFee: number; isActive: boolean; }

interface Props {
  tournament: Tournament;
  addScreenTab: "add" | "entered";
  setAddScreenTab: (tab: "add" | "entered") => void;
  addScreenMode: "create" | "edit";
  addScreenSnapshot: SnapShot | null;
  addForm: AddForm;
  setAddForm: (fn: (f: AddForm) => AddForm) => void;
  playerInputs: string[];
  setPlayerInputs: (v: string[]) => void;
  playerInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  clonedFromId: string | null;
  setClonedFromId: (v: string | null) => void;
  excludedCloneTeams: Set<string>;
  setExcludedCloneTeams: (fn: (prev: Set<string>) => Set<string>) => void;
  showPasteTip: boolean;
  setShowPasteTip: (fn: (v: boolean) => boolean) => void;
  handleAddTeamToScreen: () => void;
  handleTeamNamePaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  parseTeamPaste: (text: string) => { teamName: string; phone: string; players: string[] } | null;
  handleDeleteTournament: (id: string) => void;
  save: (t: Tournament) => void;
  setShowAddScreen: (v: boolean) => void;
  setShowCreate: (v: boolean) => void;
  setAddScreenSnapshot: (v: SnapShot | null) => void;
  // Clone flow (lazy — draft not saved until confirmed)
  isPendingClone?: boolean;
  onConfirmClone?: (bookedTeamIds: Set<string>) => void;
  onCancelClone?: () => void;
  onEditTeam?: (team: Team) => void;
}

const avatarColors = ["#7c3aed","#9333ea","#6d28d9","#8b5cf6","#a855f7"];
const initials = (name: string) => name.slice(0, 1).toUpperCase();

export default function AddTeamsScreen({
  tournament, addScreenTab, setAddScreenTab,
  addScreenMode, addScreenSnapshot,
  addForm, setAddForm,
  playerInputs, setPlayerInputs, playerInputRefs,
  clonedFromId, setClonedFromId,
  excludedCloneTeams, setExcludedCloneTeams,
  showPasteTip, setShowPasteTip,
  handleAddTeamToScreen, handleTeamNamePaste, parseTeamPaste,
  handleDeleteTournament, save,
  setShowAddScreen, setShowCreate, setAddScreenSnapshot,
  isPendingClone = false, onConfirmClone, onCancelClone, onEditTeam,
}: Props) {
  const [hasChanges, setHasChanges] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const teams = tournament.teams;
  const isCloneMode = isPendingClone || clonedFromId === tournament.id;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col anim-fade-in" style={{ background: "#0d0820" }}>
      {/* Title + optional close */}
      <div className="px-6 pt-12 pb-3 shrink-0 relative text-center">
        {addScreenMode === "edit" && (
          <button onClick={() => setShowAddScreen(false)} className="absolute right-4 top-12 p-2 rounded-xl" style={{ background:"rgba(255,255,255,0.07)", color:"rgba(196,181,253,0.6)" }}>
            <X className="h-4 w-4" />
          </button>
        )}
        <h1 className="text-2xl text-white" style={{ fontFamily:"'Dancing Script',cursive", fontWeight:700 }}>
          {tournament.name}
        </h1>
      </div>

      {/* Tabs */}
      <div className="mx-6 mb-4 shrink-0 flex rounded-2xl overflow-hidden" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(124,58,237,0.2)" }}>
        {(["add","entered"] as const).map((tab) => (
          <button key={tab} onClick={() => setAddScreenTab(tab)}
            className="flex-1 py-3 text-sm font-semibold capitalize flex items-center justify-center gap-2 transition-colors"
            style={{ color: addScreenTab === tab ? "#c4b5fd" : "rgba(196,181,253,0.4)", borderBottom: addScreenTab === tab ? "2px solid #8b5cf6" : "2px solid transparent" }}>
            {tab === "entered" ? "Entered" : "Add"}
            {tab === "entered" && teams.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:"#7c3aed", color:"#fff" }}>{teams.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-40">
        {addScreenTab === "add" ? (
          <>
            {/* Logo + Tags */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 overflow-hidden" style={{ background:"rgba(124,58,237,0.12)", border:"2px dashed rgba(124,58,237,0.35)" }}>
                <ImageIcon className="h-3.5 w-3.5" style={{ color:"#8b5cf6" }} />
                <p className="text-[8px] font-semibold text-white text-center leading-tight px-1">Upload Team Logo</p>
                <p className="text-[7px] text-center px-1" style={{ color:"rgba(196,181,253,0.35)" }}>Optional</p>
              </div>
              <div className="h-16 rounded-2xl px-3 flex flex-col justify-center" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold tracking-widest" style={{ color:"rgba(139,92,246,0.7)" }}>TAGS</p>
                  <div className="relative group">
                    <HelpCircle className="h-3.5 w-3.5 cursor-help" style={{ color:"rgba(196,181,253,0.3)" }} />
                    <div className="absolute right-0 bottom-5 w-48 text-[10px] leading-relaxed px-2.5 py-2 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10" style={{ background:"#1e1535", color:"rgba(196,181,253,0.8)", border:"1px solid rgba(124,58,237,0.25)" }}>
                      Tags are searchable aliases — used in addition to the team name to search for a team.
                    </div>
                  </div>
                </div>
                <input value={addForm.tags} onChange={(e) => { setHasChanges(true); setAddForm((f) => ({ ...f, tags: e.target.value })); }} placeholder="e.g. alpha, squad-1" className="w-full bg-transparent text-white text-xs focus:outline-none" style={{ caretColor:"#a78bfa" }} />
              </div>
            </div>

            {/* Team Name */}
            <div className="rounded-2xl px-4 py-3.5 mb-3" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-[10px] font-bold tracking-widest mb-1.5" style={{ color:"rgba(139,92,246,0.7)" }}>TEAM NAME</p>
              <div className="flex items-center gap-3">
                <UserPlus className="h-4 w-4 shrink-0" style={{ color:"rgba(196,181,253,0.4)" }} />
                <input
                  value={addForm.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHasChanges(true);
                    if (v.includes('\n') || v.includes('\r')) {
                      const parsed = parseTeamPaste(v);
                      if (parsed) {
                        if (parsed.teamName) setAddForm((f) => ({ ...f, name: parsed.teamName, phone: parsed.phone || f.phone }));
                        if (parsed.players.length > 0) setPlayerInputs(parsed.players);
                        toast.success('Team pasted!');
                        return;
                      }
                    }
                    setAddForm((f) => ({ ...f, name: v }));
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && addForm.name.trim()) { setHasChanges(true); handleAddTeamToScreen(); }}}
                  onPaste={handleTeamNamePaste}
                  placeholder="Enter team name"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                  style={{ caretColor:"#a78bfa" }}
                />
              </div>
              {/* Paste button row */}
              <div className="relative flex items-center gap-2 mt-2">
                <button
                  onClick={async () => {
                    setHasChanges(true);
                    try {
                      const text = await navigator.clipboard.readText();
                      if (!text.trim()) { toast.error("Clipboard is empty"); return; }
                      const parsed = parseTeamPaste(text);
                      if (parsed) {
                        if (parsed.teamName) setAddForm((f) => ({ ...f, name: parsed.teamName, phone: parsed.phone || f.phone }));
                        if (parsed.players.length > 0) setPlayerInputs(parsed.players);
                        toast.success('Team pasted!');
                      } else {
                        setAddForm((f) => ({ ...f, name: text.trim() }));
                      }
                    } catch {
                      toast.error("Allow clipboard access and try again");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold press-scale"
                  style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.2)" }}
                >
                  <Clipboard className="h-3 w-3" /> Paste team block
                </button>
                <button onClick={() => setShowPasteTip((v) => !v)} className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black press-scale shrink-0" style={{ background: "rgba(124,58,237,0.12)", color: "rgba(167,139,250,0.5)", border: "1px solid rgba(124,58,237,0.15)" }}>?</button>
                {showPasteTip && (
                  <div className="absolute left-0 top-full mt-1.5 z-10 rounded-2xl px-4 py-3 w-64" style={{ background: "#1a0d35", border: "1px solid rgba(124,58,237,0.3)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                    <p className="text-[10px] font-bold mb-1.5" style={{ color: "rgba(167,139,250,0.6)" }}>PASTE FORMAT</p>
                    <pre className="text-[11px] leading-5" style={{ color: "#c4b5fd", fontFamily: "monospace" }}>{`Team Name\nLeader Name\n1234567890\nPlayer 2\nPlayer 3\nPlayer 4`}</pre>
                    <p className="text-[9px] mt-2" style={{ color: "rgba(167,139,250,0.4)" }}>Copy from WhatsApp → tap Paste team block</p>
                    <button onClick={() => { const msg = `Please send me\nTeam Name\nLeader Name\nLeader's phone number\nPlayer 2\nPlayer 3\nPlayer 4`; navigator.clipboard.writeText(msg).then(() => { setShowPasteTip(() => false); toast.success("Request template copied!"); }); }} className="mt-2.5 w-full py-1.5 rounded-lg text-[10px] font-bold press-scale" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", color: "#c4b5fd" }}>
                      📋 Copy &quot;Please send me…&quot;
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="rounded-2xl px-4 py-3.5 mb-3" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold tracking-widest" style={{ color:"rgba(139,92,246,0.7)" }}>LEADER PHONE</p>
                <span className="text-[9px]" style={{ color:"rgba(196,181,253,0.3)" }}>Optional</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0" style={{ color:"rgba(196,181,253,0.4)" }} />
                <input type="tel" value={addForm.phone} onChange={(e) => { setHasChanges(true); setAddForm((f) => ({ ...f, phone: e.target.value })); }} placeholder="e.g. +91 98765 43210" className="flex-1 bg-transparent text-white text-sm focus:outline-none" style={{ caretColor:"#a78bfa" }} />
              </div>
            </div>

            {/* Players */}
            <div className="rounded-2xl px-4 py-3.5 mb-5" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-[10px] font-bold tracking-widest mb-2" style={{ color:"rgba(139,92,246,0.7)" }}>PLAYERS</p>
              <div className="space-y-2">
                {playerInputs.map((val, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      ref={(el) => { playerInputRefs.current[i] = el; }}
                      value={val}
                      onChange={(e) => { setHasChanges(true); const u = [...playerInputs]; u[i] = e.target.value; setPlayerInputs(u); }}
                      placeholder={`Player ${i + 1}`}
                      className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b"
                      style={{ caretColor:"#a78bfa", borderColor:"rgba(124,58,237,0.2)" }}
                    />
                    {playerInputs.length > 1 && (
                      <button onClick={() => { setHasChanges(true); setPlayerInputs(playerInputs.filter((_, pidx) => pidx !== i)); }} className="shrink-0 p-0.5" style={{ color:"rgba(196,181,253,0.35)" }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setHasChanges(true);
                  const newInputs = [...playerInputs, ""];
                  setPlayerInputs(newInputs);
                  requestAnimationFrame(() => { playerInputRefs.current[newInputs.length - 1]?.focus(); });
                }}
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold press-scale"
                style={{ color:"rgba(139,92,246,0.8)" }}
              >
                <Plus className="h-3.5 w-3.5" /> Add player
              </button>
            </div>

            {/* Add Team button */}
            <button onClick={() => { setHasChanges(true); handleAddTeamToScreen(); }} disabled={!addForm.name.trim()} className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 press-scale disabled:opacity-40" style={{ background:"linear-gradient(135deg,#6d28d9,#9333ea)", boxShadow:"0 4px 24px rgba(109,40,217,0.4)" }}>
              <Users className="h-4 w-4" />+ Add Team
            </button>
          </>
        ) : (
          /* Entered tab */
          <div className="space-y-2">
            {/* Search bar */}
            {teams.length > 3 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl mb-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(196,181,253,0.35)" }} />
                <input
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  placeholder="Search by name, phone, player…"
                  className="flex-1 bg-transparent text-sm text-white placeholder-[rgba(196,181,253,0.3)] focus:outline-none"
                  style={{ caretColor: "#a78bfa" }}
                />
                {teamSearch && <button onClick={() => setTeamSearch("")}><X className="h-3.5 w-3.5" style={{ color: "rgba(196,181,253,0.35)" }} /></button>}
              </div>
            )}
            {(() => {
              const q = teamSearch.trim().toLowerCase();
              const qDigits = teamSearch.replace(/\D/g, "");
              const filtered = !q ? teams : teams.filter(t => {
                if (t.name.toLowerCase().includes(q)) return true;
                const ph = (t.phone ?? "").replace(/\D/g, "");
                if (qDigits.length >= 3 && ph && (ph.includes(qDigits) || ph.endsWith(qDigits))) return true;
                if (t.players?.some(p => p.toLowerCase().includes(q))) return true;
                return false;
              });
              if (filtered.length === 0 && !q) return <p className="text-center text-sm mt-10" style={{ color:"rgba(196,181,253,0.35)" }}>No teams added yet</p>;
              if (filtered.length === 0) return <p className="text-center text-sm mt-6" style={{ color: "rgba(196,181,253,0.35)" }}>No teams match &ldquo;{teamSearch}&rdquo;</p>;
              return filtered.map((team, idx) => {
              const isOut = isCloneMode ? excludedCloneTeams.has(team.id) : !!team.out;
              const toggleOut = () => {
                setHasChanges(true);
                if (isCloneMode) {
                  setExcludedCloneTeams(prev => {
                    const n = new Set(prev);
                    n.has(team.id) ? n.delete(team.id) : n.add(team.id);
                    return n;
                  });
                } else {
                  save({ ...tournament, teams: tournament.teams.map(t => t.id === team.id ? { ...t, out: !t.out } : t) });
                }
              };
              return (
                <div key={team.id}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer press-scale"
                  style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}
                  onClick={() => {
                    setHasChanges(true);
                    onEditTeam?.(team);
                  }}
                >
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold"
                    style={{ background: avatarColors[idx % avatarColors.length] }}>
                    {initials(team.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-white">{team.name}</p>
                    {team.players && team.players.length > 0 && (
                      <p className="text-xs truncate" style={{ color:"rgba(196,181,253,0.45)" }}>{team.players.join(", ")}</p>
                    )}
                  </div>
                  {/* IN/OUT toggle switch */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleOut(); }}
                    className="relative shrink-0 press-scale"
                    style={{ width: 44, height: 26 }}
                    aria-label={isOut ? "Mark IN" : "Mark OUT"}
                  >
                    <div className="absolute inset-0 rounded-full transition-colors duration-200"
                      style={{ background: isOut ? "rgba(239,68,68,0.5)" : "rgba(34,197,94,0.5)" }} />
                    <div className="absolute top-1 transition-transform duration-200 h-[18px] w-[18px] rounded-full bg-white shadow"
                      style={{ left: 4, transform: isOut ? "translateX(0)" : "translateX(18px)" }} />
                  </button>
                </div>
              );
            });
            })()}
          </div>
        )}
      </div>

      {/* Sticky bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 shrink-0" style={{ background:"linear-gradient(to top,#0d0820 70%,transparent)" }}>
        {addScreenMode === "create" && teams.length > 0 && (
          <div className="flex items-center gap-2 mb-3 justify-center">
            {teams.slice(0, 3).map((t, i) => (
              <div key={t.id} className="h-8 w-8 rounded-full border-2 border-[#0d0820] flex items-center justify-center text-[10px] font-bold text-white" style={{ background: avatarColors[i % avatarColors.length], marginLeft: i > 0 ? -10 : 0, zIndex: 3 - i }}>
                {initials(t.name)}
              </div>
            ))}
            {teams.length > 3 && (
              <div className="h-8 w-8 rounded-full border-2 border-[#0d0820] flex items-center justify-center text-[10px] font-bold text-white" style={{ background:"#6d28d9", marginLeft:-10 }}>
                +{teams.length - 3}
              </div>
            )}
            <span className="text-sm ml-2" style={{ color:"rgba(196,181,253,0.6)" }}>{teams.length} team{teams.length !== 1 ? "s" : ""} added</span>
          </div>
        )}
        {addScreenMode === "create" && (
          <p className="text-xs text-center mb-3" style={{ color:"rgba(196,181,253,0.35)" }}>Click here to create a tournament with all your teams</p>
        )}
        {isCloneMode ? (
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (isPendingClone && onCancelClone) {
                  onCancelClone();
                } else {
                  handleDeleteTournament(tournament.id); setClonedFromId(null); setShowAddScreen(false); setShowCreate(true);
                }
              }}
              className="flex-1 py-4 rounded-2xl font-bold text-sm press-scale"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(196,181,253,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
            >Cancel</button>
            <button
              onClick={() => {
                if (isPendingClone && onConfirmClone) {
                  // Pass the set of booked IDs — all teams are cloned, this just sets their out status
                  const bookedIds = new Set(teams.filter(t => !excludedCloneTeams.has(t.id)).map(t => t.id));
                  onConfirmClone(bookedIds);
                } else {
                  setClonedFromId(null); setExcludedCloneTeams(() => new Set()); setShowAddScreen(false); toast.success(`"${tournament.name}" created!`); setAddScreenSnapshot(null);
                }
              }}
              className="flex-1 py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 press-scale"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 28px rgba(124,58,237,0.5)" }}
            >
              <Trophy className="h-4 w-4" /> Clone
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setShowAddScreen(false); toast.success(`Tournament "${tournament.name}" ${addScreenMode === "edit" ? "updated" : "ready"}!`); setAddScreenSnapshot(null); }}
            disabled={addScreenMode === "edit" && !hasChanges}
            className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 press-scale disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow:"0 4px 28px rgba(124,58,237,0.5)" }}
          >
            <Trophy className="h-4 w-4" /> {addScreenMode === "edit" ? "UPDATE TOURNEY" : "CREATE TOURNEY"}
          </button>
        )}
      </div>
    </div>
  );
}
