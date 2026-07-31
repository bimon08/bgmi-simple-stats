"use client";
import { useState, useEffect } from "react";
import { X, Shuffle, ArrowLeftRight, ChevronDown, ChevronUp, Save, RotateCcw, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Tournament, Team } from "@/lib/types";
import { splitTeamsRandomly } from "@/lib/storage";
import { groupLabels, isGroupLabel } from "@/lib/groups";

interface Props {
  tournament: Tournament;
  save: (t: Tournament) => void;
  onClose: () => void;
}

export default function SplitScreen({ tournament, save, onClose }: Props) {
  const activeTeams = tournament.teams.filter(t => !t.out);

  const [numGroups, setNumGroups] = useState(tournament.groupCount ?? 2);
  const labels = groupLabels(numGroups);

  // Local state mirrors team groups for preview before saving
  const [teamGroups, setTeamGroups] = useState<Record<string, string | undefined>>(() => {
    const map: Record<string, string | undefined> = {};
    activeTeams.forEach(t => { map[t.id] = t.group; });
    return map;
  });

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Teams per group
  const groupTeams = (label: string) => activeTeams.filter(t => teamGroups[t.id] === label);
  const waitingTeams = activeTeams.filter(t => teamGroups[t.id] === "waiting");
  const unassigned = activeTeams.filter(t => !teamGroups[t.id]);
  const hasSplit = labels.some(l => groupTeams(l).length > 0);

  // Detect if anything changed vs saved state
  const hasChanges = activeTeams.some(t => teamGroups[t.id] !== t.group)
    || numGroups !== (tournament.groupCount ?? 2);

  // When numGroups decreases, move excess-group teams to waiting
  useEffect(() => {
    const valid = new Set([...labels, "waiting"]);
    const needs = activeTeams.some(t => teamGroups[t.id] && !valid.has(teamGroups[t.id]!));
    if (needs) {
      setTeamGroups(prev => {
        const next = { ...prev };
        activeTeams.forEach(t => {
          if (next[t.id] && !valid.has(next[t.id]!)) next[t.id] = "waiting";
        });
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numGroups]);

  const handleRandomize = () => {
    const result = splitTeamsRandomly(activeTeams.map(t => ({ ...t, out: false })), numGroups);
    const newGroups: Record<string, string | undefined> = {};
    activeTeams.forEach(t => { newGroups[t.id] = undefined; });
    Object.entries(result.groups).forEach(([label, ids]) => {
      ids.forEach(id => { newGroups[id] = label; });
    });
    result.waiting.forEach(id => { newGroups[id] = "waiting"; });
    setTeamGroups(newGroups);
    toast.success("Teams randomized!");
  };

  const handleClearSplit = () => {
    const newGroups: Record<string, string | undefined> = {};
    activeTeams.forEach(t => { newGroups[t.id] = undefined; });
    setTeamGroups(newGroups);
    toast.success("Split cleared");
  };

  const cycleGroup = (teamId: string) => {
    const current = teamGroups[teamId];
    const all = [...labels, "waiting"];
    const idx = all.indexOf(current ?? "");
    const next = all[(idx + 1) % all.length];
    setTeamGroups(prev => ({ ...prev, [teamId]: next }));
  };

  const handleSave = () => {
    const updatedTeams = tournament.teams.map(t => {
      if (t.out) return t;
      return { ...t, group: teamGroups[t.id] };
    });
    save({
      ...tournament,
      teams: updatedTeams,
      splitEnabled: hasSplit,
      groupCount: numGroups,
    });
    toast.success(hasSplit ? "Split saved!" : "Split cleared!");
    onClose();
  };

  const renderTeamList = (teams: Team[], label: string) => {
    const isWaiting = label === "waiting";
    const displayLabel = isWaiting ? "Waiting" : `Group ${label}`;
    const isExpanded = expandedSection === label;
    return (
      <div key={label} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={() => setExpandedSection(isExpanded ? null : label)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <span className="text-sm font-bold flex-1" style={{ color: "rgba(196,181,253,0.8)" }}>
            {displayLabel} <span style={{ color: "rgba(255,255,255,0.3)" }}>({teams.length})</span>
          </span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} /> : <ChevronDown className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />}
        </button>
        <div style={{
          display: "grid",
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 250ms cubic-bezier(0.4,0,0.2,1)",
        }}>
          <div style={{ overflow: "hidden" }}>
            <div className="px-3 pb-3 space-y-1">
              {teams.map(team => (
                <div key={team.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-sm font-semibold text-white flex-1 truncate">{team.name}</span>
                  <button
                    onClick={() => cycleGroup(team.id)}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold press-scale"
                    style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", color: "#c4b5fd" }}
                  >
                    <ArrowLeftRight className="h-3 w-3" /> Move
                  </button>
                </div>
              ))}
              {teams.length === 0 && (
                <p className="text-center py-4 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>No teams</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Summary text
  const groupSizes = labels.map(l => groupTeams(l).length);
  const summaryParts = groupSizes.join(" + ");

  return (
    <div className="fixed inset-0 z-[56] flex flex-col anim-fade-in" style={{ background: "#0a0614" }}>
      {/* Header */}
      <div className="px-6 pt-12 pb-4 shrink-0 relative">
        <button onClick={onClose} className="absolute right-4 top-12 p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(196,181,253,0.6)" }}>
          <X className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-bold text-white">Split</h1>
        <p className="text-xs mt-1" style={{ color: "rgba(167,139,250,0.5)" }}>
          {tournament.name} · {activeTeams.length} teams
          {hasSplit && ` → ${summaryParts}${waitingTeams.length > 0 ? ` + ${waitingTeams.length} waiting` : ""}`}
        </p>
      </div>

      {/* Group count + actions */}
      <div className="px-6 pb-4 flex items-center gap-2 shrink-0 flex-wrap">
        {/* Group count stepper */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-[10px] font-bold" style={{ color: "rgba(167,139,250,0.5)" }}>Groups</span>
          <button
            onClick={() => setNumGroups(Math.max(2, numGroups - 1))}
            className="h-6 w-6 rounded-md flex items-center justify-center press-scale"
            style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}
          ><Minus className="h-3 w-3" /></button>
          <span className="text-sm font-bold text-white w-4 text-center">{numGroups}</span>
          <button
            onClick={() => setNumGroups(Math.min(8, numGroups + 1))}
            className="h-6 w-6 rounded-md flex items-center justify-center press-scale"
            style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}
          ><Plus className="h-3 w-3" /></button>
        </div>

        <button
          onClick={handleRandomize}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white press-scale"
          style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
        >
          <Shuffle className="h-4 w-4" /> Randomize
        </button>
        {hasSplit && (
          <button
            onClick={handleClearSplit}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium press-scale"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
          >
            <RotateCcw className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Team lists */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {labels.map(l => renderTeamList(groupTeams(l), l))}
        {(waitingTeams.length > 0 || hasSplit) && renderTeamList(waitingTeams, "waiting")}

        {/* Unassigned teams */}
        {unassigned.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="px-4 py-3 flex items-center gap-2">
              <span className="text-sm font-bold flex-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Unassigned <span style={{ color: "rgba(255,255,255,0.2)" }}>({unassigned.length})</span>
              </span>
            </div>
            <div className="px-3 pb-3 space-y-1">
              {unassigned.map(team => (
                <div key={team.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-sm font-semibold text-white flex-1 truncate">{team.name}</span>
                  <div className="flex gap-1 shrink-0">
                    {labels.map(l => (
                      <button
                        key={l}
                        onClick={() => setTeamGroups(prev => ({ ...prev, [team.id]: l }))}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold press-scale"
                        style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", color: "#c4b5fd" }}
                      >→ {l}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


      </div>

      {/* Save CTA */}
      <div className="px-6 pb-8 pt-3 shrink-0" style={{ borderTop: "1px solid rgba(124,58,237,0.1)" }}>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white press-scale disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: hasChanges ? "linear-gradient(135deg,#7c3aed,#9333ea)" : "rgba(124,58,237,0.2)", boxShadow: hasChanges ? "0 4px 24px rgba(124,58,237,0.45)" : "none" }}
        >
          <Save className="h-4 w-4" /> Save Split
        </button>
      </div>
    </div>
  );
}
