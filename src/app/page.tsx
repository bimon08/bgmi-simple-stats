"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, Users, X, Minus, Hash, Download, Share2, Trophy,
  Clipboard, ClipboardPaste, ChevronDown, ChevronUp, Target, Pencil,
} from "lucide-react";
import { toJpeg } from "html-to-image";
import { toast } from "sonner";
import { Team, Tournament, StandingRow, GeminiOutput, AssignedGroup } from "@/lib/types";
import { loadTournament, saveTournament, createTournament } from "@/lib/storage";
import { compareTiebreaker } from "@/lib/points";
import { generatePrompt } from "@/lib/prompt";

export default function TeamsPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSlots, setShowSlots] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [inputs, setInputs] = useState<string[]>([""]);
  const [startSlot, setStartSlot] = useState(3);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const slotsRef = useRef<HTMLDivElement>(null);
  const standingsRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [standings, setStandings] = useState<StandingRow[]>([]);

  // Stats state
  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [matchesDetected, setMatchesDetected] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const t = loadTournament();
    if (!t) { setTournament(createTournament("My Tournament")); return; }
    setTournament(t);
    if (t.geminiData) {
      setGroups(t.geminiData.groups.map((g) => ({
        ...g, teamId: t.assignments?.[g.group], teamName: t.teams.find((tm) => tm.id === t.assignments?.[g.group])?.name,
      })));
      setAssignments(t.assignments || {});
      setMatchesDetected(t.geminiData.matches_detected);
    }
    if (t.geminiData && t.assignments) computeStandings(t);
  }, []);

  const save = useCallback((t: Tournament) => { setTournament(t); saveTournament(t); }, []);

  const computeStandings = (t: Tournament) => {
    if (!t.geminiData || !t.assignments) return;
    const rows: StandingRow[] = t.geminiData.groups.map((group) => {
      const teamId = t.assignments![group.group];
      const team = t.teams.find((tm) => tm.id === teamId);
      return {
        teamId: teamId || group.group, teamName: team?.name || `Group ${group.group}`, group: group.group, players: group.players,
        totalPoints: group.totals.totalPoints, chickenDinners: group.totals.chickenDinners, placementPoints: group.totals.totalPlacementPoints,
        totalKills: group.totals.totalKills, lastMatchPosition: group.totals.lastMatchPosition,
        positions: group.matches.map((m) => m.position), matchCount: group.matches.length,
      };
    });
    rows.sort(compareTiebreaker);
    setStandings(rows);
  };

  // ── Team CRUD ──
  const handleDelete = (id: string) => {
    if (!tournament) return;
    save({ ...tournament, teams: tournament.teams.filter((t) => t.id !== id) });
    toast.success("Removed");
  };
  const addRow = () => setInputs([...inputs, ""]);
  const removeRow = (i: number) => { if (inputs.length > 1) setInputs(inputs.filter((_, idx) => idx !== i)); };
  const updateRow = (i: number, val: string) => { const u = [...inputs]; u[i] = val; setInputs(u); };
  const handleSave = () => {
    if (!tournament) return;
    const names = inputs.map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    const newTeams: Team[] = names.map((n) => ({ id: crypto.randomUUID(), name: n }));
    save({ ...tournament, teams: [...tournament.teams, ...newTeams] });
    setInputs([""]); setShowAdd(false);
    toast.success(`${newTeams.length} team${newTeams.length > 1 ? "s" : ""} added`);
  };

  // ── Stats / Parse ──
  const copyPrompt = () => {
    if (!tournament) return;
    navigator.clipboard.writeText(generatePrompt(tournament.teams));
    toast.success("Prompt copied! Paste in Gemini → upload screenshots → say \"ok\"");
  };
  const pasteJson = async () => {
    try { processJson(await navigator.clipboard.readText()); } catch { toast.error("Allow clipboard access"); }
  };
  const processJson = (text: string) => {
    if (!tournament) return;
    try {
      const data = JSON.parse(text) as GeminiOutput;
      if (!data.groups || !Array.isArray(data.groups)) throw new Error("Invalid JSON");
      const assigned: AssignedGroup[] = data.groups.map((g) => ({
        ...g, teamId: assignments[g.group], teamName: tournament.teams.find((t) => t.id === assignments[g.group])?.name,
      }));
      setGroups(assigned); setMatchesDetected(data.matches_detected || 0);
      const updated = { ...tournament, geminiData: data };
      save(updated);
      if (updated.assignments) computeStandings(updated);
      toast.success(`${data.groups.length} groups · ${data.matches_detected} matches`);
    } catch (err: unknown) { toast.error((err as Error).message || "Invalid JSON"); }
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (text.trim().startsWith("{")) { e.preventDefault(); processJson(text); }
  };
  const assignTeam = (groupLabel: string, teamId: string) => {
    if (!tournament) return;
    const na = { ...assignments, [groupLabel]: teamId };
    setAssignments(na);
    setGroups((prev) => prev.map((g) => g.group === groupLabel ? { ...g, teamId, teamName: tournament.teams.find((t) => t.id === teamId)?.name } : g));
    const updated = { ...tournament, assignments: na };
    save(updated);
    computeStandings(updated);
  };
  const unassignTeam = (groupLabel: string) => {
    if (!tournament) return;
    const na = { ...assignments };
    delete na[groupLabel];
    setAssignments(na);
    setGroups((prev) => prev.map((g) => g.group === groupLabel ? { ...g, teamId: undefined, teamName: undefined } : g));
    const updated = { ...tournament, assignments: na };
    save(updated);
    computeStandings(updated);
  };
  const getTopKiller = (group: AssignedGroup) => {
    const m = new Map<string, number>();
    group.matches.forEach((match) => Object.entries(match.playerKills).forEach(([n, k]) => m.set(n, (m.get(n) || 0) + k)));
    let tn = "", tk = 0; m.forEach((k, n) => { if (k > tk) { tn = n; tk = k; } }); return { name: tn, kills: tk };
  };
  const toggleExpand = (g: string) => setExpandedGroups((p) => { const n = new Set(p); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const assignedTeamIds = new Set(Object.values(assignments));

  // ── Slots ──
  const slotAssignments = tournament?.teams.map((t, i) => ({ ...t, slot: startSlot + i })) || [];

  // ── Capture helper ──
  const captureRef = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, download = false, filename = "image") => {
    const el = ref.current; if (!el) return;
    setIsCapturing(true);
    try {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.width = "700px"; clone.style.height = "auto"; clone.style.overflow = "visible";
      clone.querySelectorAll(".floating-controls").forEach((e) => e.remove());
      const temp = document.createElement("div");
      temp.style.cssText = "position:absolute;left:-9999px;top:0;";
      temp.appendChild(clone); document.body.appendChild(temp);
      await new Promise((r) => setTimeout(r, 300));
      const h = clone.scrollHeight || clone.offsetHeight;
      const dataUrl = await toJpeg(clone, { width: 700, height: h, pixelRatio: 3, quality: 0.92 });
      document.body.removeChild(temp);
      if (download) { const a = document.createElement("a"); a.download = `${filename}.jpg`; a.href = dataUrl; a.click(); toast.success("Downloaded!"); return; }
      const res = await fetch(dataUrl); const blob = await res.blob();
      const file = new File([blob], `${filename}.jpg`, { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ "image/jpeg": blob })]); toast.success("Copied!"); }
      else { const a = document.createElement("a"); a.download = `${filename}.jpg`; a.href = dataUrl; a.click(); }
    } catch (err: unknown) { if ((err as Error).name !== "AbortError") toast.error("Failed"); }
    finally { setIsCapturing(false); }
  }, []);

  if (!tournament) return null;
  const validCount = inputs.filter((s) => s.trim()).length;

  return (
    <div className="pb-24" onPaste={handlePaste}>
      {/* Sticky Nav */}
      <nav className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-zinc-800/50 mb-8" style={{ background: "rgba(9,9,11,0.85)", backdropFilter: "blur(20px) saturate(180%)" }}>
        <div className="h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <svg className="h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">BGMI Stats</span>
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-zinc-900/80 border border-zinc-800/50">
            <button onClick={() => setShowSlots(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-all">
              <Hash className="h-3.5 w-3.5" /><span className="hidden sm:inline">Slots</span>
            </button>
            <button onClick={() => setShowStats(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-all">
              <Target className="h-3.5 w-3.5" /><span className="hidden sm:inline">Stats</span>
            </button>
            {standings.length > 0 && (
              <button onClick={() => setShowStandings(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-all">
                <Trophy className="h-3.5 w-3.5" /><span className="hidden sm:inline">Standings</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Tournament Name + Teams Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => { if (nameInput.trim()) save({ ...tournament, name: nameInput.trim() }); setEditingName(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { if (nameInput.trim()) save({ ...tournament, name: nameInput.trim() }); setEditingName(false); } if (e.key === "Escape") setEditingName(false); }}
              className="text-xl font-bold text-white bg-transparent border-b border-amber-500/50 focus:border-amber-400 focus:outline-none px-0 py-0.5 w-full max-w-xs"
            />
          ) : (
            <h1
              onClick={() => { setNameInput(tournament.name || ""); setEditingName(true); }}
              className="text-xl font-bold text-white cursor-pointer hover:text-amber-400 transition-colors"
              title="Click to edit"
            >
              {tournament.name || "My Tournament"} <Pencil className="h-3.5 w-3.5 text-zinc-600 inline ml-1" />
            </h1>
          )}
        </div>
        <p className="text-xs text-zinc-500">{tournament.teams.length} teams registered</p>
      </div>

      {/* Team List */}
      <div className="space-y-1.5">
        {tournament.teams.map((team, i) => (
          <div key={team.id} className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/40 hover:border-zinc-700/60 transition-all">
            <span className="text-xs font-bold text-zinc-600 w-5 text-right">{i + 1}</span>
            <span className="text-sm font-medium text-white flex-1">{team.name}</span>
            <button onClick={() => handleDelete(team.id)} className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all">
              <Trash2 className="h-3 w-3 text-red-400/60" />
            </button>
          </div>
        ))}
        {/* Add Team Row */}
        <button
          onClick={() => { setInputs([""]); setShowAdd(true); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-dashed border-zinc-700/60 hover:border-amber-500/40 hover:bg-amber-500/[0.03] text-zinc-500 hover:text-amber-400 transition-all"
        >
          <span className="w-5 flex justify-center"><Plus className="h-3.5 w-3.5" /></span>
          <span className="text-sm font-medium">Add team</span>
        </button>
      </div>

      {/* ════════ ADD TEAMS MODAL ════════ */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md mx-0 sm:mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Add Teams</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-zinc-800"><X className="h-4 w-4 text-zinc-500" /></button>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {inputs.map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-600 w-4 text-right shrink-0">{i + 1}</span>
                  <input value={val} onChange={(e) => updateRow(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRow(); setTimeout(() => { document.querySelectorAll<HTMLInputElement>("[data-team-input]")[inputs.length]?.focus(); }, 50); } }}
                    data-team-input autoFocus={i === inputs.length - 1} placeholder={`Team ${i + 1}`} maxLength={9}
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder-zinc-600 focus:border-amber-500/40 focus:outline-none transition-all" />
                  {inputs.length > 1 && <button onClick={() => removeRow(i)} className="p-1 rounded-md hover:bg-zinc-800 shrink-0"><Minus className="h-3.5 w-3.5 text-zinc-500" /></button>}
                </div>
              ))}
            </div>
            <button onClick={addRow} className="mt-3 w-full py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all">+ Add another</button>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-all">Cancel</button>
              <button onClick={handleSave} disabled={validCount === 0} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-black bg-gradient-to-r from-amber-400 to-orange-400 disabled:opacity-30 transition-all shadow-lg shadow-amber-500/20">Add {validCount > 0 ? validCount : ""} Team{validCount !== 1 ? "s" : ""}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ STATS MODAL ════════ */}
      {showStats && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-white">Match Stats</h1>
                <p className="text-xs text-zinc-500 mt-0.5">{groups.length > 0 ? `${groups.length} groups · ${matchesDetected} matches` : "Copy prompt → Gemini → Paste JSON"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={copyPrompt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all">
                  <Clipboard className="h-3 w-3" /> Prompt
                </button>
                <button onClick={pasteJson} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all shadow-lg shadow-amber-500/20">
                  <ClipboardPaste className="h-3 w-3" /> Paste
                </button>
                <button onClick={() => setShowStats(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                  <X className="h-5 w-5 text-zinc-400" />
                </button>
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4"><Target className="h-6 w-6 text-zinc-600" /></div>
                <p className="text-sm text-zinc-500 font-medium">No match data</p>
                <p className="text-xs text-zinc-600 mt-1">Copy prompt → Gemini → paste JSON</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => {
                  const topKiller = getTopKiller(group);
                  const isAssigned = !!group.teamId;
                  const isExpanded = expandedGroups.has(group.group);
                  const isDropdownOpen = openDropdown === group.group;

                  return (
                    <div key={group.group} className={`rounded-xl border transition-all ${isAssigned ? "bg-amber-500/[0.03] border-amber-500/20" : "bg-zinc-900/50 border-zinc-800/60"}`}>
                      {/* Top Row: Rank + Team assign */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className={`flex items-center justify-center h-8 w-8 rounded-lg text-sm font-black shrink-0 ${
                          group.rank === 1 ? "bg-gradient-to-br from-yellow-500 to-amber-600 text-black" :
                          group.rank === 2 ? "bg-gradient-to-br from-gray-300 to-gray-500 text-black" :
                          group.rank === 3 ? "bg-gradient-to-br from-orange-500 to-orange-700 text-white" :
                          "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}>{group.rank}</div>

                        {/* Custom Dropdown */}
                        <div className="flex-1 relative">
                          <button
                            onClick={() => setOpenDropdown(isDropdownOpen ? null : group.group)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              isAssigned ? "bg-amber-500/10 border border-amber-500/30 text-white" : "bg-zinc-800 border border-zinc-700/60 text-zinc-400"
                            }`}
                          >
                            <span className="truncate">{isAssigned ? group.teamName : "Assign team..."}</span>
                            <ChevronDown className={`h-3 w-3 shrink-0 ml-2 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                          </button>
                          {isDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl shadow-black/50 max-h-48 overflow-y-auto">
                              {isAssigned && (
                                <button onClick={() => { unassignTeam(group.group); setOpenDropdown(null); }}
                                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-b border-zinc-700/50">
                                  ✕ Unassign
                                </button>
                              )}
                              {tournament.teams.filter((t) => !assignedTeamIds.has(t.id)).map((t) => (
                                <button key={t.id} onClick={() => { assignTeam(group.group, t.id); setOpenDropdown(null); }}
                                  className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-zinc-700 ${t.id === group.teamId ? "text-amber-400 font-semibold" : "text-zinc-300"}`}>
                                  {t.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <button onClick={() => toggleExpand(group.group)} className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
                        </button>
                      </div>

                      {/* Stats Row */}
                      <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                          <span className="text-white/40">PTS</span>
                          <span className="font-bold text-orange-400">{group.totals.totalPoints}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                          <span className="text-white/40">K</span>
                          <span className="font-medium text-white">{group.totals.totalKills}</span>
                        </span>
                        {group.totals.chickenDinners > 0 && (
                          <span className="text-[10px] text-yellow-400 font-semibold">🍗 {group.totals.chickenDinners}</span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                          <Trophy className="h-2.5 w-2.5 text-amber-500" />{topKiller.name} ({topKiller.kills}k)
                        </span>
                        <div className="flex items-center gap-1 ml-auto">
                          {group.matches.map((m) => (
                            <span key={m.match} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              m.position === 1 ? "bg-amber-500/15 text-amber-400" : m.position <= 3 ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                            }`}>#{m.position}</span>
                          ))}
                        </div>
                      </div>

                      {/* Expanded Match Details */}
                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-1.5 border-t border-zinc-800/50 pt-3">
                          {group.matches.map((m) => (
                            <div key={m.match} className="bg-zinc-800/30 rounded-lg p-2.5">
                              <div className="flex items-center gap-2 mb-1.5 text-[11px]">
                                <span className="font-semibold text-zinc-300">Match {m.match}</span>
                                <span className={`font-bold ${m.position === 1 ? "text-amber-400" : "text-zinc-400"}`}>#{m.position}</span>
                                <span className="text-zinc-600">{m.matchPoints} pts ({m.placementPoints}pp + {m.teamKills}k)</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1">
                                {Object.entries(m.playerKills).map(([pn, k]) => (
                                  <div key={pn} className="flex items-center justify-between text-[11px] px-2 py-0.5 rounded bg-zinc-900/60">
                                    <span className="text-zinc-400 truncate mr-2">{pn}</span>
                                    <span className="text-amber-400/80 font-semibold shrink-0">{k}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ SLOTS MODAL ════════ */}
      {showSlots && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="floating-controls absolute top-4 right-4 z-30 flex gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-xl">
              <span className="text-[11px] text-white/60">Start</span>
              <input type="number" value={startSlot} onChange={(e) => setStartSlot(Math.max(1, parseInt(e.target.value) || 1))} className="w-10 bg-transparent text-sm text-white text-center focus:outline-none" min={1} />
            </div>
            <button onClick={() => captureRef(slotsRef, false, tournament.name || "slots")} disabled={isCapturing} className="text-white hover:text-orange-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-orange-500/50 p-2.5 rounded-xl transition-all disabled:opacity-50"><Share2 className="h-5 w-5" /></button>
            <button onClick={() => captureRef(slotsRef, true, tournament.name || "slots")} disabled={isCapturing} className="text-white hover:text-blue-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-blue-500/50 p-2.5 rounded-xl transition-all disabled:opacity-50"><Download className="h-5 w-5" /></button>
            <button onClick={() => setShowSlots(false)} className="text-white hover:text-red-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-red-500/50 p-2.5 rounded-xl transition-all"><X className="h-5 w-5" /></button>
          </div>
          <div ref={slotsRef} className="relative w-full min-h-dvh flex items-center justify-center bg-cover bg-center py-14" style={{ backgroundImage: "url(/images/image.webp)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.4), rgba(0,0,0,0.5))" }} />
            <div className="relative z-10 w-full max-w-lg mx-auto px-4">
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-4xl font-bold tracking-wide text-orange-500" style={{ textShadow: "0 0 30px rgba(249,115,22,0.6), 0 0 60px rgba(249,115,22,0.3), 0 2px 4px rgba(0,0,0,0.5)" }}>{tournament.name || "Tournament"}</h1>
                <p className="text-xs text-white/40 mt-2">Slot Assignments</p>
              </div>
              <div className="rounded-2xl border border-white/[0.15] shadow-2xl shadow-black/50 overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                <table className="w-full">
                  <thead><tr className="bg-white/[0.06] border-b border-white/10"><th className="px-4 py-2.5 text-center text-sm font-semibold text-white w-16">Slot</th><th className="px-4 py-2.5 text-center text-sm font-semibold text-white">Team</th></tr></thead>
                  <tbody>
                    {slotAssignments.map((s, i) => {
                      const c = i % 3; const tc = c === 0 ? "text-white" : c === 1 ? "text-sky-100" : "text-amber-100"; const bg = c === 0 ? "bg-white/[0.08]" : c === 1 ? "bg-sky-400/[0.10]" : "bg-amber-400/[0.10]";
                      return (<tr key={s.id} className={`border-b border-white/5 last:border-b-0 ${bg}`} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}><td className={`px-4 py-2 text-center text-sm font-bold ${tc}`}>{s.slot}</td><td className={`px-4 py-2 text-center text-sm font-bold ${tc}`}>{s.name}</td></tr>);
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2 bg-white/[0.04] border-t border-white/10 text-center"><span className="text-xs font-semibold text-white/60">Total Teams: {slotAssignments.length}</span></div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-white/40 text-[10px]"><div className="h-px w-8 bg-gradient-to-r from-transparent to-orange-500/50" /><span className="font-medium text-white/50">BGMI × Simple Stats</span><div className="h-px w-8 bg-gradient-to-l from-transparent to-orange-500/50" /></div>
            </div>
          </div>
        </div>
      )}

      {/* ════════ STANDINGS MODAL ════════ */}
      {showStandings && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="floating-controls absolute top-4 right-4 z-30 flex gap-2">
            <button onClick={() => captureRef(standingsRef, false, tournament.name || "standings")} disabled={isCapturing} className="text-white hover:text-orange-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-orange-500/50 p-2.5 rounded-xl transition-all disabled:opacity-50"><Share2 className="h-5 w-5" /></button>
            <button onClick={() => captureRef(standingsRef, true, tournament.name || "standings")} disabled={isCapturing} className="text-white hover:text-blue-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-blue-500/50 p-2.5 rounded-xl transition-all disabled:opacity-50"><Download className="h-5 w-5" /></button>
            <button onClick={() => setShowStandings(false)} className="text-white hover:text-red-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-red-500/50 p-2.5 rounded-xl transition-all"><X className="h-5 w-5" /></button>
          </div>
          <div ref={standingsRef} className="relative w-full min-h-dvh flex items-center justify-center bg-cover bg-center py-14" style={{ backgroundImage: "url(/images/image.webp)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.4), rgba(0,0,0,0.5))" }} />
            <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6">
              {/* Title */}
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-4xl font-bold tracking-wide text-orange-500" style={{ textShadow: "0 0 30px rgba(249,115,22,0.6), 0 0 60px rgba(249,115,22,0.3), 0 2px 4px rgba(0,0,0,0.5)" }}>{tournament.name || "Tournament"}</h1>
                <div className="mt-3 flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20">
                    <Trophy className="h-3.5 w-3.5 text-orange-400" />
                    <span className="text-xs font-medium text-white">Overall Rankings</span>
                  </div>
                </div>
              </div>

              {/* Two-column Table */}
              {(() => {
                const half = Math.ceil(standings.length / 2);
                const leftCol = standings.slice(0, half);
                const rightCol = standings.slice(half);

                const thStyle = (align: string) => ({ padding: "7px 2px", fontSize: "9px", fontWeight: 800 as const, textTransform: "uppercase" as const, letterSpacing: "0.08em", textAlign: align as "center" | "left", color: "rgba(255,255,255,0.7)" });

                const getBadge = (rank: number) =>
                  rank === 1 ? "bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-500 text-black shadow-[0_0_12px_rgba(234,179,8,0.6)] border border-yellow-300/50 font-black"
                  : rank === 2 ? "bg-gradient-to-r from-gray-400 via-gray-200 to-gray-300 text-black shadow-[0_0_10px_rgba(156,163,175,0.5)] border border-gray-200/50 font-black"
                  : rank === 3 ? "bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 text-white shadow-[0_0_10px_rgba(234,88,12,0.5)] border border-orange-400/50 font-black"
                  : "bg-zinc-800/80 text-zinc-300 border border-zinc-700/50";

                const renderTable = (slice: StandingRow[], startIdx: number) => (
                  <div className="overflow-hidden rounded-xl" style={{ backgroundColor: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <table className="w-full border-collapse" style={{ fontSize: "14px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "rgba(0,0,0,0.4)", borderBottom: "2px solid rgba(251,146,60,0.3)" }}>
                          <th style={{ ...thStyle("center"), padding: "7px 4px" }}>#</th>
                          <th style={{ ...thStyle("left"), padding: "7px 4px" }}>Team</th>
                          <th style={thStyle("center")}>🍗</th>
                          <th style={thStyle("center")}>M</th>
                          <th style={thStyle("center")}>P</th>
                          <th style={thStyle("center")}>E</th>
                          <th style={{ ...thStyle("center"), fontWeight: 900, color: "#fb923c", padding: "7px 4px" }}>T</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slice.map((row, idx) => {
                          const rank = startIdx + idx + 1;
                          const isEven = idx % 2 === 0;
                          return (
                            <tr key={row.teamId} style={{ backgroundColor: isEven ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                              <td style={{ padding: "6px 4px", textAlign: "center", verticalAlign: "middle", width: "32px" }}>
                                <span className={`inline-flex items-center justify-center rounded-md ${getBadge(rank)}`} style={{ width: "24px", height: "24px", fontSize: "12px", fontWeight: 900, lineHeight: 1 }}>{rank}</span>
                              </td>
                              <td style={{ padding: "6px 4px", textAlign: "left", verticalAlign: "middle" }}>
                                <span className="text-white" style={{ fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap" }}>{row.teamName}</span>
                              </td>
                              <td style={{ padding: "6px 2px", textAlign: "center", verticalAlign: "middle", fontSize: "13px", fontWeight: 700, fontFamily: "monospace", fontVariantNumeric: "tabular-nums", color: row.chickenDinners > 0 ? "#facc15" : "rgba(255,255,255,0.3)" }}>{row.chickenDinners}</td>
                              <td style={{ padding: "6px 2px", textAlign: "center", verticalAlign: "middle", color: "rgba(255,255,255,0.85)", fontSize: "13px", fontWeight: 700, fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>{row.matchCount}</td>
                              <td style={{ padding: "6px 2px", textAlign: "center", verticalAlign: "middle", color: "white", fontSize: "13px", fontWeight: 700, fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>{row.placementPoints}</td>
                              <td style={{ padding: "6px 2px", textAlign: "center", verticalAlign: "middle", color: "white", fontSize: "13px", fontWeight: 700, fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>{row.totalKills}</td>
                              <td style={{ padding: "6px 4px", textAlign: "center", verticalAlign: "middle" }}>
                                <span style={{ color: "#fb923c", fontSize: "15px", fontWeight: 900, fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>{row.totalPoints}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );

                return (
                  <div className="flex gap-3 justify-center">
                    <div className="flex-1">{renderTable(leftCol, 0)}</div>
                    {rightCol.length > 0 && <div className="flex-1">{renderTable(rightCol, half)}</div>}
                  </div>
                );
              })()}

              {/* Legend */}
              <div style={{ textAlign: "center", marginTop: "6px", fontSize: "9px", color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.02em" }}>
                🍗 = Chicken Dinners · M = Matches · P = Placement Points · E = Eliminations · T = P + E
              </div>

              {/* Branding */}
              <div className="mt-6 flex items-center justify-center gap-2 text-white/40 text-[10px]">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-orange-500/50" />
                <span className="font-medium text-white/50">BGMI × Simple Stats</span>
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-orange-500/50" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
