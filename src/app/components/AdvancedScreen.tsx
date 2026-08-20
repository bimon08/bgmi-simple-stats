"use client";
import { useState } from "react";
import { X, Scissors, ChevronRight, Trophy, ChevronDown, ChevronUp, Check, Settings2, Minus, Plus, Save, AlertTriangle, Trash2 } from "lucide-react";
import { Tournament, StandingRow } from "@/lib/types";
import { groupLabels } from "@/lib/groups";
import { compareTiebreaker } from "@/lib/points";
import { toast } from "sonner";

interface Props {
  tournament: Tournament;
  standings: StandingRow[];
  save: (t: Tournament) => void;
  onClose: () => void;
  onOpenSplit: () => void;
}

export default function AdvancedScreen({ tournament, standings, save, onClose, onOpenSplit }: Props) {
  const activeTeams = tournament.teams.filter(t => !t.out);
  const gc = tournament.groupCount ?? 2;
  const labels = groupLabels(gc);
  const groupCounts = labels.map(l => activeTeams.filter(t => t.group === l).length);
  const waiting = activeTeams.filter(t => t.group === "waiting").length;
  const isSplit = tournament.splitEnabled && groupCounts.some(c => c > 0);

  const advPerGroup = tournament.finalStage?.advancePerGroup ?? (tournament.finalStage as any)?.advanceFromA ?? 0;
  const hasFinalStage = isSplit && tournament.finalStage && advPerGroup > 0;
  const totalSlots = advPerGroup * gc;

  // Compute who would advance from each group
  const advancedTeams = labels.flatMap(label => {
    const groupStandings = standings
      .filter(row => {
        const team = tournament.teams.find(t => t.id === row.teamId);
        return team?.group === label;
      })
      .sort(compareTiebreaker);
    return groupStandings.slice(0, advPerGroup).map((row, i) => ({
      ...row,
      group: label,
      rank: i + 1,
    }));
  });

  const hasStandings = standings.length > 0;
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localAdvance, setLocalAdvance] = useState(advPerGroup);

  // Penalties state
  const [showPenalties, setShowPenalties] = useState(false);
  const [penaltyTeamId, setPenaltyTeamId] = useState("");
  const [penaltyPoints, setPenaltyPoints] = useState(3);
  const [penaltyReason, setPenaltyReason] = useState("");
  const penalties = tournament.penalties ?? {};
  const penaltyEntries = Object.entries(penalties).filter(([, pts]) => pts > 0);
  const maxPerGroup = Math.min(...labels.map(l => activeTeams.filter(t => t.group === l).length).filter(n => n > 0), 99);

  const handleSaveSettings = () => {
    save({
      ...tournament,
      finalStage: { advancePerGroup: localAdvance, totalSlots: localAdvance * gc },
    });
    toast.success("Settings saved!");
  };

  const handleAdvance = () => {
    // Mark advancing teams (could be used for slot assignment, etc.)
    const advancedIds = new Set(advancedTeams.map(t => t.teamId));
    const updatedTeams = tournament.teams.map(t => {
      if (advancedIds.has(t.id)) return { ...t, group: "final" };
      return t;
    });
    save({ ...tournament, teams: updatedTeams });
    toast.success(`${advancedTeams.length} teams advanced to Final!`);
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col anim-fade-in" style={{ background: "#0a0614" }}>
      {/* Header */}
      <div className="px-6 pt-12 pb-6 shrink-0 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-12 p-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(196,181,253,0.6)" }}
        >
          <X className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-bold text-white">Advanced</h1>
        <p className="text-xs mt-1" style={{ color: "rgba(167,139,250,0.5)" }}>
          {tournament.name}
        </p>
      </div>

      {/* Feature cards */}
      <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-3">
        {/* Split Tournament */}
        <button
          onClick={onOpenSplit}
          className="w-full flex items-center gap-4 p-5 rounded-2xl text-left press-scale transition-all"
          style={{
            background: isSplit ? "rgba(74,222,128,0.06)" : "rgba(124,58,237,0.08)",
            border: `1px solid ${isSplit ? "rgba(74,222,128,0.2)" : "rgba(124,58,237,0.18)"}`,
          }}
        >
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isSplit ? "rgba(74,222,128,0.15)" : "rgba(124,58,237,0.2)",
              border: `1px solid ${isSplit ? "rgba(74,222,128,0.3)" : "rgba(124,58,237,0.3)"}`,
            }}
          >
            <Scissors className="h-5 w-5" style={{ color: isSplit ? "#4ade80" : "#a78bfa" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Split Tournament</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(167,139,250,0.5)" }}>
              {isSplit
                ? `✓ ${gc} groups — ${groupCounts.map((c, i) => `${c}${labels[i]}`).join(" · ")}${waiting > 0 ? ` · ${waiting}W` : ""}`
                : `Divide teams into ${gc} groups`}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "rgba(167,139,250,0.3)" }} />
        </button>

        {/* Settings — Final Stage config */}
        {isSplit && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)" }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center gap-4 p-5 text-left press-scale"
            >
              <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }}>
                <Settings2 className="h-5 w-5" style={{ color: "#a78bfa" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Settings</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(167,139,250,0.5)" }}>
                  {advPerGroup > 0 ? `Top ${advPerGroup}/group → ${totalSlots} finals` : "Configure final stage advancement"}
                </p>
              </div>
              {showSettings
                ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "rgba(167,139,250,0.3)" }} />
                : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "rgba(167,139,250,0.3)" }} />}
            </button>

            <div style={{
              display: "grid",
              gridTemplateRows: showSettings ? "1fr" : "0fr",
              transition: "grid-template-rows 250ms cubic-bezier(0.4,0,0.2,1)",
            }}>
              <div style={{ overflow: "hidden" }}>
                <div className="px-5 pb-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: "#e2d9f3" }}>From each group → Final</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setLocalAdvance(Math.max(0, localAdvance - 1))}
                        className="h-7 w-7 rounded-lg flex items-center justify-center press-scale"
                        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}>
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-bold text-white w-6 text-center">{localAdvance}</span>
                      <button onClick={() => setLocalAdvance(Math.min(maxPerGroup, localAdvance + 1))}
                        className="h-7 w-7 rounded-lg flex items-center justify-center press-scale"
                        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}>
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="pt-2" style={{ borderTop: "1px solid rgba(124,58,237,0.12)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: "rgba(167,139,250,0.7)" }}>Total Finals Slots</span>
                      <span className="text-lg font-black" style={{ color: "#a78bfa" }}>{localAdvance * gc}</span>
                    </div>
                  </div>
                  {localAdvance !== advPerGroup && (
                    <button
                      onClick={handleSaveSettings}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white press-scale"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
                      <Save className="h-3.5 w-3.5" /> Save Settings
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Advance to Finals — only when split + finalStage configured */}
        {hasFinalStage && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(250,204,21,0.04)",
              border: "1px solid rgba(250,204,21,0.15)",
            }}
          >
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center gap-4 p-5 text-left press-scale"
            >
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.25)" }}
              >
                <Trophy className="h-5 w-5" style={{ color: "#facc15" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Advance to Finals</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(250,204,21,0.6)" }}>
                  Top {advPerGroup} from each group → {totalSlots} finals
                </p>
              </div>
              {showPreview
                ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "rgba(250,204,21,0.4)" }} />
                : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "rgba(250,204,21,0.4)" }} />}
            </button>

            {/* Preview + action */}
            <div style={{
              display: "grid",
              gridTemplateRows: showPreview ? "1fr" : "0fr",
              transition: "grid-template-rows 250ms cubic-bezier(0.4,0,0.2,1)",
            }}>
              <div style={{ overflow: "hidden" }}>
                <div className="px-5 pb-5 space-y-3">
                  {!hasStandings ? (
                    <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Calculate match data first to see who advances
                    </p>
                  ) : (
                    <>
                      {labels.map(label => {
                        const groupAdv = advancedTeams.filter(t => t.group === label);
                        return (
                          <div key={label}>
                            <p className="text-[10px] font-bold mb-1.5 uppercase" style={{ color: "rgba(250,204,21,0.5)" }}>
                              Group {label} — Top {advPerGroup}
                            </p>
                            <div className="space-y-1">
                              {groupAdv.map(row => (
                                <div key={row.teamId} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.08)" }}>
                                  <span className="text-[10px] font-black w-5 text-center" style={{ color: "rgba(250,204,21,0.5)" }}>#{row.rank}</span>
                                  <span className="text-sm font-semibold text-white flex-1 truncate">{row.teamName}</span>
                                  <span className="text-[10px] font-bold" style={{ color: "rgba(250,204,21,0.6)" }}>{row.totalPoints}pts</span>
                                </div>
                              ))}
                              {groupAdv.length === 0 && (
                                <p className="text-xs text-center py-2" style={{ color: "rgba(255,255,255,0.2)" }}>No standings for Group {label}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <button
                        onClick={handleAdvance}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-black press-scale mt-2"
                        style={{ background: "linear-gradient(135deg,#facc15,#eab308)", boxShadow: "0 4px 20px rgba(250,204,21,0.3)" }}
                      >
                        <Check className="h-4 w-4" /> Advance {advancedTeams.length} Teams
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Penalties Card ─────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <button
            onClick={() => setShowPenalties(!showPenalties)}
            className="w-full flex items-center gap-4 p-5 text-left press-scale"
          >
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <AlertTriangle className="h-5 w-5" style={{ color: "#f87171" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Penalties</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(248,113,113,0.6)" }}>
                {penaltyEntries.length > 0 ? `${penaltyEntries.length} active penalty${penaltyEntries.length !== 1 ? 'ies' : ''}` : 'Deduct points for rule violations'}
              </p>
            </div>
            {showPenalties
              ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "rgba(248,113,113,0.4)" }} />
              : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "rgba(248,113,113,0.4)" }} />}
          </button>

          <div style={{
            display: "grid",
            gridTemplateRows: showPenalties ? "1fr" : "0fr",
            transition: "grid-template-rows 250ms cubic-bezier(0.4,0,0.2,1)",
          }}>
            <div style={{ overflow: "hidden" }}>
              <div className="px-5 pb-5 space-y-4">
                {/* Active penalties */}
                {penaltyEntries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(248,113,113,0.5)" }}>Active Penalties</p>
                    {penaltyEntries.map(([teamId, pts]) => {
                      const team = tournament.teams.find(t => t.id === teamId);
                      return (
                        <div key={teamId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)" }}>
                          <span className="flex-1 text-sm font-semibold text-white truncate">{team?.name || 'Unknown'}</span>
                          <span className="text-xs font-bold" style={{ color: "#f87171" }}>−{pts} pts</span>
                          <button
                            onClick={() => {
                              const updated = { ...penalties };
                              delete updated[teamId];
                              save({ ...tournament, penalties: updated });
                              toast.success(`Penalty removed for ${team?.name || 'team'}`);
                            }}
                            className="h-7 w-7 rounded-lg flex items-center justify-center press-scale"
                            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}
                          >
                            <Trash2 className="h-3 w-3" style={{ color: "#f87171" }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add penalty form */}
                <div className="space-y-3" style={{ borderTop: penaltyEntries.length > 0 ? "1px solid rgba(239,68,68,0.1)" : "none", paddingTop: penaltyEntries.length > 0 ? "12px" : 0 }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(248,113,113,0.5)" }}>Add Penalty</p>
                  
                  {/* Team selector */}
                  <select
                    value={penaltyTeamId}
                    onChange={e => setPenaltyTeamId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none appearance-none"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", caretColor: "#f87171" }}
                  >
                    <option value="" style={{ background: "#1a0e2e" }}>Select team...</option>
                    {activeTeams.map(t => (
                      <option key={t.id} value={t.id} style={{ background: "#1a0e2e" }}>{t.name}</option>
                    ))}
                  </select>

                  {/* Points */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: "#e2d9f3" }}>Points to deduct</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPenaltyPoints(Math.max(1, penaltyPoints - 1))}
                        className="h-7 w-7 rounded-lg flex items-center justify-center press-scale"
                        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-bold text-white w-6 text-center">{penaltyPoints}</span>
                      <button onClick={() => setPenaltyPoints(Math.min(99, penaltyPoints + 1))}
                        className="h-7 w-7 rounded-lg flex items-center justify-center press-scale"
                        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Reason (optional) */}
                  <input
                    value={penaltyReason}
                    onChange={e => setPenaltyReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", caretColor: "#f87171" }}
                  />

                  {/* Apply button */}
                  <button
                    onClick={() => {
                      if (!penaltyTeamId) { toast.error('Select a team'); return; }
                      const team = tournament.teams.find(t => t.id === penaltyTeamId);
                      const existing = penalties[penaltyTeamId] ?? 0;
                      const updated = { ...penalties, [penaltyTeamId]: existing + penaltyPoints };
                      save({ ...tournament, penalties: updated });
                      toast.success(`−${penaltyPoints} pts applied to ${team?.name || 'team'}${penaltyReason ? ` (${penaltyReason})` : ''}`);
                      setPenaltyTeamId('');
                      setPenaltyPoints(3);
                      setPenaltyReason('');
                    }}
                    disabled={!penaltyTeamId}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white press-scale disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 4px 20px rgba(239,68,68,0.3)" }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Apply −{penaltyPoints} Penalty
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder */}
        {!hasFinalStage && (
          <div className="pt-8 text-center">
            <p className="text-[11px]" style={{ color: "rgba(167,139,250,0.2)" }}>
              {isSplit ? "Set up Final Stage in Split settings to advance teams" : "More features coming soon"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
