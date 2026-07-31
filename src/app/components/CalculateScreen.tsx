"use client";
import { useState } from "react";
import { Trash2, X, ChevronDown, ChevronUp, ClipboardPaste, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Tournament, AssignedGroup, StandingRow, DEFAULT_BGMI_POINTS } from "@/lib/types";
import GroupFilterDropdown from "./GroupFilterDropdown";

interface Props {
  tournament: Tournament;
  groups: AssignedGroup[];
  assignments: Record<string, string>;
  matchesDetected: number;
  standings: StandingRow[];
  groupFilter: string;
  setGroupFilter: (v: string) => void;
  onAssignTeam: (groupLabel: string, teamId: string) => void;
  onUnassignTeam: (groupLabel: string) => void;
  onCopyPrompt: () => void;
  onPasteJson: () => void;
  onClearData: () => void;
  onClose: () => void;
}

export default function CalculateScreen({
  tournament, groups, assignments, matchesDetected, groupFilter, setGroupFilter,
  onAssignTeam, onUnassignTeam, onCopyPrompt, onPasteJson, onClearData, onClose,
}: Props) {
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleExpand = (g: string) => setExpandedGroups(p => { const n = new Set(p); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const assignedTeamIds = new Set(Object.values(assignments));

  const getTopKiller = (group: AssignedGroup) => {
    const m = new Map<string, number>();
    group.matches.forEach((match) => Object.entries(match.playerKills).forEach(([n, k]) => m.set(n, (m.get(n) || 0) + k)));
    let tn = "", tk = 0; m.forEach((k, n) => { if (k > tk) { tn = n; tk = k; } }); return { name: tn, kills: tk };
  };

  const filteredGroups = groups.filter(g => {
    if (!tournament.splitEnabled || groupFilter === "all") return true;
    const teamId = g.teamId || assignments[g.group];
    if (!teamId) return true;
    const team = tournament.teams.find(t => t.id === teamId);
    return team?.group === groupFilter;
  });

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto" style={{ background: "#0c0914" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">Calculate</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>{groups.length > 0 ? `${groups.length} groups · ${matchesDetected} matches` : tournament.name}</p>
              {tournament.splitEnabled && <GroupFilterDropdown value={groupFilter} onChange={setGroupFilter} groupCount={tournament.groupCount ?? 2} showFinal={tournament.teams.some(t => t.group === "final")} />}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 pt-1">
            {groups.length > 0 && (
              <button onClick={onClearData} className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(239,68,68,0.6)" }} title="Reset match data">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "rgba(167,139,250,0.5)" }}><X className="h-5 w-5" /></button>
          </div>
        </div>

        {groups.length === 0 ? (
          /* ── Empty state: AI guide ── */
          <div className="mt-6 px-1">
            <div className="w-full rounded-2xl p-4" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.2)" }}>
                  <svg width="22" height="22" viewBox="0 0 65 65" fill="none" xmlns="http://www.w3.org/2000/svg"><mask id="maskme" style={{maskType:"alpha"}} maskUnits="userSpaceOnUse" x="0" y="0" width="65" height="65"><path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" fill="#000"/><path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" fill="url(#gg1)"/></mask><g mask="url(#maskme)"><g filter="url(#gf0)"><path d="M-5.859 50.734c7.498 2.663 16.116-2.33 19.249-11.152 3.133-8.821-.406-18.131-7.904-20.794-7.498-2.663-16.116 2.33-19.25 11.151-3.132 8.822.407 18.132 7.905 20.795z" fill="#FFE432"/></g><g filter="url(#gf1)"><path d="M27.433 21.649c10.3 0 18.651-8.535 18.651-19.062 0-10.528-8.35-19.062-18.651-19.062S8.78-7.94 8.78 2.587c0 10.527 8.35 19.062 18.652 19.062z" fill="#FC413D"/></g><g filter="url(#gf2)"><path d="M20.184 82.608c10.753-.525 18.918-12.244 18.237-26.174-.68-13.93-9.95-24.797-20.703-24.271C6.965 32.689-1.2 44.407-.519 58.337c.681 13.93 9.95 24.797 20.703 24.271z" fill="#00B95C"/></g><g filter="url(#gf5)"><path d="M67.391 42.993c10.132 0 18.346-7.91 18.346-17.666 0-9.757-8.214-17.667-18.346-17.667s-18.346 7.91-18.346 17.667c0 9.757 8.214 17.666 18.346 17.666z" fill="#3186FF"/></g><g filter="url(#gf7)"><path d="M34.74 51.43c11.135 7.656 25.896 5.524 32.968-4.764 7.073-10.287 3.779-24.832-7.357-32.488C49.215 6.52 34.455 8.654 27.382 18.94c-7.072 10.288-3.779 24.833 7.357 32.49z" fill="#3186FF"/></g></g><defs><filter id="gf0" x="-19.824" y="13.152" width="39.274" height="43.217" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="2.46" result="effect1_foregroundBlur"/></filter><filter id="gf1" x="-15.001" y="-40.257" width="84.868" height="85.688" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="11.891" result="effect1_foregroundBlur"/></filter><filter id="gf2" x="-20.776" y="11.927" width="79.454" height="90.916" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="10.109" result="effect1_foregroundBlur"/></filter><filter id="gf5" x="29.832" y="-11.552" width="75.117" height="73.758" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="9.606" result="effect1_foregroundBlur"/></filter><filter id="gf7" x="8.107" y="-5.966" width="78.877" height="77.539" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="7.775" result="effect1_foregroundBlur"/></filter><linearGradient id="gg1" x1="18.447" y1="43.42" x2="52.153" y2="15.004" gradientUnits="userSpaceOnUse"><stop stopColor="#4893FC"/><stop offset=".27" stopColor="#4893FC"/><stop offset=".777" stopColor="#969DFF"/><stop offset="1" stopColor="#BD99FE"/></linearGradient></defs></svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Calculate with AI — free</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(167,139,250,0.55)" }}>How to use Gemini</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { step: "1", title: "Copy the prompt below", desc: "Tap Copy Prompt, then open Gemini and paste it" },
                  { step: "2", title: "Send & upload screenshots", desc: "Reply with your match result screenshots in the next message" },
                  { step: "3", title: "Copy the JSON reply", desc: "Gemini responds with a JSON block — select and copy it" },
                  { step: "4", title: "Paste it here", desc: "Come back and tap the purple 'Paste' button below" },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-black" style={{ background: "rgba(124,58,237,0.3)", color: "#c4b5fd" }}>{s.step}</div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">{s.title}</p>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "rgba(167,139,250,0.6)" }}>{s.desc}</p>
                    </div>
                  </div>
                ))}

                <div className="pt-2 space-y-2">
                  <button onClick={onCopyPrompt} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white press-scale" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>Copy Prompt</button>
                  <button onClick={onPasteJson} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold press-scale" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}><ClipboardPaste className="h-4 w-4" /> Paste JSON from Gemini</button>
                  <p className="text-[10px] text-center pt-0.5" style={{ color: "rgba(167,139,250,0.35)" }}>Prompt copied to clipboard · paste in Gemini</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Groups list ── */
          <div className="space-y-3">
            {/* Match selector pills */}
            {matchesDetected > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                <button onClick={() => setSelectedMatch(null)} className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all" style={selectedMatch === null ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff" } : { background: "rgba(124,58,237,0.12)", color: "rgba(167,139,250,0.7)", border: "1px solid rgba(124,58,237,0.2)" }}>All</button>
                {Array.from({ length: matchesDetected }, (_, i) => i + 1).map((mn) => (
                  <button key={mn} onClick={() => setSelectedMatch(mn)} className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all" style={selectedMatch === mn ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff" } : { background: "rgba(124,58,237,0.12)", color: "rgba(167,139,250,0.7)", border: "1px solid rgba(124,58,237,0.2)" }}>M{mn}</button>
                ))}
              </div>
            )}

            {filteredGroups.map((group) => {
              const topKiller = getTopKiller(group);
              const isAssigned = !!group.teamId;
              const isExpanded = expandedGroups.has(group.group);
              const isDropdownOpen = openDropdown === group.group;
              return (
                <div key={group.group} className={`rounded-xl border transition-all ${isAssigned ? "bg-violet-500/[0.03] border-violet-500/20" : "bg-zinc-900/50 border-zinc-800/60"}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex items-center justify-center h-8 w-8 rounded-lg text-sm font-black shrink-0 ${group.rank === 1 ? "bg-gradient-to-br from-yellow-500 to-amber-600 text-black" : group.rank === 2 ? "bg-gradient-to-br from-gray-300 to-gray-500 text-black" : group.rank === 3 ? "bg-gradient-to-br from-orange-500 to-orange-700 text-white" : "bg-zinc-800 text-zinc-400 border border-zinc-700"}`}>{group.rank}</div>
                    <div className="flex-1 relative">
                      <button onClick={() => setOpenDropdown(isDropdownOpen ? null : group.group)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${isAssigned ? "bg-violet-500/10 border border-violet-500/30 text-white" : "bg-zinc-800 border border-zinc-700/60 text-zinc-400"}`}>
                        <span className="truncate">{isAssigned ? <>{(() => { const tm = tournament.teams.find(t => t.id === group.teamId); const g = tm?.group; return g && g !== "waiting" ? <span className="mr-1 text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>{g === "final" ? "F" : g}</span> : null; })()}{group.teamName}</> : "Assign team..."}</span>
                        <ChevronDown className={`h-3 w-3 shrink-0 ml-2 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl max-h-48 overflow-y-auto">
                          {isAssigned && <button onClick={() => { onUnassignTeam(group.group); setOpenDropdown(null); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-b border-zinc-700/50">✕ Unassign</button>}
                          {tournament.teams.filter((t) => !t.out && !assignedTeamIds.has(t.id)).map((t) => (
                            <button key={t.id} onClick={() => { onAssignTeam(group.group, t.id); setOpenDropdown(null); }} className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-zinc-700 ${t.id === group.teamId ? "text-violet-400 font-semibold" : "text-zinc-300"}`}>
                              {tournament.splitEnabled && t.group && t.group !== "waiting" && <span className="mr-1 text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}>{t.group === "final" ? "F" : t.group}</span>}
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
                  <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                    {(() => {
                      const ps = tournament.pointSystem ?? DEFAULT_BGMI_POINTS;
                      if (selectedMatch !== null) {
                        const m = group.matches.find((m) => m.match === selectedMatch);
                        if (!m) return <span className="text-[10px] text-zinc-500">Did not play M{selectedMatch}</span>;
                        const kills = m.teamKills ?? Object.values(m.playerKills ?? {}).reduce((a, b) => a + b, 0);
                        const pp = m.placementPoints ?? (ps.positionPoints[m.position - 1] ?? 0);
                        const pts = pp + kills * ps.killPoints;
                        return (<>
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"><span className="text-white/40">PTS</span><span className="font-bold text-violet-400">{pts}</span></span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"><span className="text-white/40">K</span><span className="font-medium text-white">{kills}</span></span>
                          {m.position === 1 && <span className="text-[10px] text-yellow-400 font-semibold">🍗 Chicken!</span>}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto ${m.position === 1 ? "bg-violet-500/15 text-violet-400" : m.position <= 3 ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>#{m.position}</span>
                        </>);
                      }
                      return (<>
                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"><span className="text-white/40">PTS</span><span className="font-bold text-violet-400">{group.totals.totalPoints}</span></span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"><span className="text-white/40">K</span><span className="font-medium text-white">{group.totals.totalKills}</span></span>
                        {group.totals.chickenDinners > 0 && <span className="text-[10px] text-yellow-400 font-semibold">🍗 {group.totals.chickenDinners}</span>}
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><Trophy className="h-2.5 w-2.5 text-violet-400" />{topKiller.name} ({topKiller.kills}k)</span>
                        <div className="flex items-center gap-1 ml-auto">
                          {group.matches.map((m) => <span key={m.match} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.position === 1 ? "bg-violet-500/15 text-violet-400" : m.position <= 3 ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>#{m.position}</span>)}
                        </div>
                      </>);
                    })()}
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-2 border-t border-zinc-800/40 space-y-2">
                      {group.matches.map((m) => (
                        <div key={m.match} className="pl-3 border-l-2" style={{ borderColor: m.position === 1 ? "#7c3aed" : "rgba(63,63,70,0.6)" }}>
                          <div className="flex items-center gap-2 mb-1 text-[11px]">
                            <span className="font-bold text-zinc-400">M{m.match}</span>
                            <span className={`font-bold ${m.position === 1 ? "text-violet-400" : m.position <= 3 ? "text-emerald-400" : "text-zinc-500"}`}>#{m.position}</span>
                            <span className="text-zinc-600">{m.matchPoints}pts</span>
                            <span className="text-zinc-700 text-[10px]">({m.placementPoints}pp + {m.teamKills}k)</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {Object.entries(m.playerKills).map(([pn, k]) => (
                              <span key={pn} className="text-[10px] text-zinc-400">{pn} <span className="text-violet-400 font-semibold">{k}k</span></span>
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
  );
}
