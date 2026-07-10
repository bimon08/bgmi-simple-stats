"use client";

import { useState, useEffect, useCallback } from "react";
import { Clipboard, ClipboardPaste, ChevronDown, ChevronUp, Trophy, Crosshair, Target } from "lucide-react";
import { toast } from "sonner";
import { Tournament, GeminiOutput, AssignedGroup } from "@/lib/types";
import { loadTournament, saveTournament } from "@/lib/storage";
import { generatePrompt } from "@/lib/prompt";

export default function StatsPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [matchesDetected, setMatchesDetected] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = loadTournament();
    setTournament(t);
    if (t?.geminiData) {
      setGroups(
        t.geminiData.groups.map((g) => ({
          ...g,
          teamId: t.assignments?.[g.group],
          teamName: t.teams.find((tm) => tm.id === t.assignments?.[g.group])?.name,
        }))
      );
      setAssignments(t.assignments || {});
      setMatchesDetected(t.geminiData.matches_detected);
    }
  }, []);

  const save = useCallback((t: Tournament) => {
    setTournament(t);
    saveTournament(t);
  }, []);

  const copyPrompt = () => {
    if (!tournament) return;
    navigator.clipboard.writeText(generatePrompt(tournament.teams));
    toast.success("Prompt copied! Paste in Gemini → upload screenshots → say \"ok\"");
  };

  const pasteJson = async () => {
    try {
      const text = await navigator.clipboard.readText();
      processJson(text);
    } catch {
      toast.error("Allow clipboard access or use Ctrl+V");
    }
  };

  const processJson = (text: string) => {
    if (!tournament) return;
    try {
      const data = JSON.parse(text) as GeminiOutput;
      if (!data.groups || !Array.isArray(data.groups)) throw new Error("Invalid JSON format");
      const assignedGroups: AssignedGroup[] = data.groups.map((g) => ({
        ...g,
        teamId: assignments[g.group],
        teamName: tournament.teams.find((t) => t.id === assignments[g.group])?.name,
      }));
      setGroups(assignedGroups);
      setMatchesDetected(data.matches_detected || 0);
      save({ ...tournament, geminiData: data });
      toast.success(`${data.groups.length} groups · ${data.matches_detected} matches detected`);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Invalid JSON");
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (text.trim().startsWith("{")) { e.preventDefault(); processJson(text); }
  };

  const assignTeam = (groupLabel: string, teamId: string) => {
    if (!tournament) return;
    const newAssignments = { ...assignments, [groupLabel]: teamId };
    setAssignments(newAssignments);
    const teamName = tournament.teams.find((t) => t.id === teamId)?.name;
    setGroups((prev) => prev.map((g) => g.group === groupLabel ? { ...g, teamId, teamName } : g));
    save({ ...tournament, assignments: newAssignments });
  };

  const getTopKiller = (group: AssignedGroup) => {
    const killsMap = new Map<string, number>();
    group.matches.forEach((m) => {
      Object.entries(m.playerKills).forEach(([name, kills]) => {
        killsMap.set(name, (killsMap.get(name) || 0) + kills);
      });
    });
    let topName = "", topKills = 0;
    killsMap.forEach((kills, name) => { if (kills > topKills) { topName = name; topKills = kills; } });
    return { name: topName, kills: topKills };
  };

  const toggleExpand = (group: string) => {
    setExpandedGroups((prev) => { const next = new Set(prev); next.has(group) ? next.delete(group) : next.add(group); return next; });
  };

  const assignedTeamIds = new Set(Object.values(assignments));
  if (!tournament) return null;

  return (
    <div className="space-y-8" onPaste={handlePaste}>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Match Stats</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {groups.length > 0 ? `${groups.length} groups · ${matchesDetected} matches` : "Copy prompt → Gemini → Paste JSON"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={copyPrompt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all">
            <Clipboard className="h-3 w-3" /> Copy Prompt
          </button>
          <button onClick={pasteJson} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all shadow-lg shadow-amber-500/20">
            <ClipboardPaste className="h-3 w-3" /> Paste JSON
          </button>
        </div>
      </div>

      {/* Empty */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <Target className="h-6 w-6 text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500 font-medium">No match data</p>
          <p className="text-xs text-zinc-600 mt-1">Copy prompt → use in Gemini → paste the JSON result here</p>
          <p className="text-[10px] text-zinc-700 mt-3">Tip: You can also paste directly with Cmd+V</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const topKiller = getTopKiller(group);
            const isAssigned = !!group.teamId;
            const isExpanded = expandedGroups.has(group.group);

            return (
              <div
                key={group.group}
                className={`rounded-xl border transition-all duration-200 ${
                  isAssigned ? "bg-amber-500/[0.03] border-amber-500/15" : "bg-zinc-900/40 border-zinc-800/50"
                }`}
              >
                <div className="flex items-center gap-4 p-3.5">
                  {/* Rank */}
                  <div className="text-center shrink-0 w-10">
                    <div className={`text-lg font-black ${group.rank <= 3 ? "text-amber-400" : "text-zinc-500"}`}>
                      {group.rank}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isAssigned && <span className="text-xs font-semibold text-white">{group.teamName}</span>}
                      <span className="text-[10px] text-zinc-500">
                        <Trophy className="h-2.5 w-2.5 inline mr-0.5 text-amber-500" />
                        {topKiller.name} ({topKiller.kills}k)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-bold text-white">{group.totals.totalPoints} pts</span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-400">{group.totals.totalKills} kills</span>
                      {group.totals.chickenDinners > 0 && (
                        <>
                          <span className="text-zinc-600">·</span>
                          <span className="text-amber-400">🍗 {group.totals.chickenDinners}</span>
                        </>
                      )}
                      <span className="text-zinc-600">·</span>
                      {group.matches.map((m) => (
                        <span key={m.match} className={`${m.position === 1 ? "text-amber-400" : m.position <= 3 ? "text-emerald-400" : "text-zinc-500"}`}>
                          #{m.position}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Assign */}
                  <select
                    value={group.teamId || ""}
                    onChange={(e) => { if (e.target.value) assignTeam(group.group, e.target.value); }}
                    className="shrink-0 w-36 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-xs text-white focus:border-amber-500/50 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Assign team</option>
                    {tournament.teams.filter((t) => !assignedTeamIds.has(t.id) || t.id === group.teamId).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  {/* Expand */}
                  <button onClick={() => toggleExpand(group.group)} className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
                  </button>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-0 space-y-1.5">
                    <div className="h-px bg-zinc-800/50 mb-2" />
                    {group.matches.map((m) => (
                      <div key={m.match} className="bg-zinc-800/30 rounded-lg p-2.5">
                        <div className="flex items-center gap-2 mb-1.5 text-[11px]">
                          <span className="font-semibold text-zinc-300">Match {m.match}</span>
                          <span className={`font-bold ${m.position === 1 ? "text-amber-400" : "text-zinc-400"}`}>#{m.position}</span>
                          <span className="text-zinc-600">{m.matchPoints} pts ({m.placementPoints}pp + {m.teamKills}k)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {Object.entries(m.playerKills).map(([pName, kills]) => (
                            <div key={pName} className="flex items-center justify-between text-[11px] px-2 py-0.5 rounded bg-zinc-900/60">
                              <span className="text-zinc-400 truncate mr-2">{pName}</span>
                              <span className="text-amber-400/80 font-semibold shrink-0">{kills}</span>
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
  );
}
