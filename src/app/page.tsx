"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Team, Tournament, StandingRow, GeminiOutput, AssignedGroup, PointSystem, DEFAULT_BGMI_POINTS } from "@/lib/types";
import {
  CreateScreen, BookingsModal, ShareCodeModal, ImportCodeModal,
  CollabDeleteConfirm, TeamEditScreen, PointSystemModal, EditSheet,
  AddTeamsScreen, AdvancedScreen, SplitScreen, StandingsModal,
  SlotsModal, RoomInfoModal, CalculateScreen, MainView, RulesModal,
} from "./components";
import { useCloudSync } from "./hooks/useCloudSync";
import { loadTournaments, saveTournaments, createTournament, deleteTournamentById } from "@/lib/storage";
import { computeStandings as computeStandingsFromTournament, normalizeAndAssign } from "@/lib/standings";
import { parseTeamPaste } from "@/lib/parseTeam";
import { generatePrompt } from "@/lib/prompt";
import { authFetch } from "@/lib/authFetch";
import { normalizeGeminiData, uniquePlayers, autoAssignAndEnrich } from "@/lib/gemini";

const APP_NAME = "ScrimCalc";

export default function TeamsPage() {
  const {
    tournaments, setTournaments, tournament, setTournament,
    pastTeams, setPastTeams, pageLoaded, syncStatus,
    save, handleSync, scheduleSyncDebounce,
  } = useCloudSync();
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [roundRobin, setRoundRobin] = useState(false);
  const [clonedFromId, setClonedFromId] = useState<string | null>(null);
  const [excludedCloneTeams, setExcludedCloneTeams] = useState<Set<string>>(new Set());
  const [pendingCloneDraft, setPendingCloneDraft] = useState<import("@/lib/types").Tournament | null>(null);

  const [showAddScreen, setShowAddScreen] = useState(false);
  const [addScreenTab, setAddScreenTab] = useState<"add" | "entered" | "past">("add");

  const [addScreenMode, setAddScreenMode] = useState<"create" | "edit">("create");
  const [addForm, setAddForm] = useState({ name: "", tags: "", phone: "" });
  const [playerInputs, setPlayerInputs] = useState<string[]>([""]);  
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamForm, setEditTeamForm] = useState({ name: "", tags: "", players: "", phone: "" });

  const [addScreenSnapshot, setAddScreenSnapshot] = useState<{ teamCount: number; entryFee: number; isActive: boolean } | null>(null);
  const [showSlots, setShowSlots] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [showPointSystem, setShowPointSystem] = useState(false);
  const [editingPoints, setEditingPoints] = useState<PointSystem>(DEFAULT_BGMI_POINTS);
  const [showMorePositions, setShowMorePositions] = useState(false);
  const [standingsTab, setStandingsTab] = useState<"table" | "warhead" | "fraggers">("table");
  const [showStats, setShowStats] = useState(false);

  const playerInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [matchesDetected, setMatchesDetected] = useState(0);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareInfo, setShareInfo] = useState<{ code: string; url: string; name: string } | null>(null);
  const [showImportCode, setShowImportCode] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  const [editingPlayerIdx, setEditingPlayerIdx] = useState<number | null>(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [showPasteTip, setShowPasteTip] = useState(false);

  const [collabDeleteId, setCollabDeleteId] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>("all");

  // Native back-button: push a history entry whenever any overlay opens, pop to close the top-most one
  useEffect(() => {
    const anyOpen =
      showCreate || showAddScreen || !!editingTeam ||
      showStats || showStandings || showSlots ||
      showPointSystem || showEdit ||
      showAdvanced || showSplit;

    if (anyOpen) {
      history.pushState({ overlay: true }, '');
    }

    const onPop = () => {
      // Close in reverse-depth order (deepest first)
      if (showSplit)     { setShowSplit(false); return; }
      if (showAdvanced)  { setShowAdvanced(false); return; }
      if (editingTeam)    { setEditingTeam(null); return; }
      if (showStats)      { setShowStats(false); return; }
      if (showStandings)  { setShowStandings(false); return; }
      if (showSlots)      { setShowSlots(false); return; }
      if (showPointSystem){ setShowPointSystem(false); return; }
      if (showAddScreen)  { setShowAddScreen(false); return; }
      if (showEdit)       { setShowEdit(false); return; }

      if (showCreate)     { setShowCreate(false); setCreateName(''); setRoundRobin(false); return; }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [showCreate, showAddScreen, editingTeam, showStats, showStandings,
      showSlots, showPointSystem, showEdit, showAdvanced, showSplit]);

  const recomputeStandings = (t: Tournament) => setStandings(computeStandingsFromTournament(t));

  const openAction = (t: Tournament, action: string) => {
    setTournament(t);
    const { groups: g, assignments: a, matchesDetected: md } = normalizeAndAssign(t);
    setGroups(g); setAssignments(a); setMatchesDetected(md);
    setStandings(computeStandingsFromTournament(t));
    switch (action) {
      case "calculate": setShowStats(true); break;
      case "tables": setStandingsTab("table"); setShowStandings(true); break;
      case "warheads": setStandingsTab("warhead"); setShowStandings(true); break;
      case "fraggers": setStandingsTab("fraggers"); setShowStandings(true); break;
      case "slots": setShowSlots(true); break;
      case "edit": setShowEdit(true); break;
      case "bookings": setShowBookings(true); break;
      case "room-info": setShowRoomInfo(true); break;
      case "rules": setShowRulesModal(true); break;
      default: toast("Coming soon 🚀");
    }
  };

  const handleCreate = () => {
    if (!createName.trim()) return;
    const t = createTournament(createName.trim());
    setTournaments((prev) => { const u = [...prev, t]; saveTournaments(u); return u; });
    setTournament(t);
    scheduleSyncDebounce();
    setCreateName(""); setRoundRobin(false); setShowCreate(false);
    setAddForm({ name: "", tags: "", phone: "" });
    setAddScreenTab("add"); setAddScreenMode("create"); setShowAddScreen(true);
    setAddScreenSnapshot({ teamCount: t.teams.length, entryFee: t.entryFee ?? 0, isActive: t.isActive ?? false });
  };

  const handleCloneCreate = (source: Tournament) => {
    // Build a unique name but do NOT save anything yet — draft lives in memory only
    const existingNames = new Set(tournaments.map(t => t.name));
    const baseName = source.name.replace(/ \(Copy(?:-\d+)?\)$/, "");
    let copyName = `${baseName} (Copy)`;
    let n = 2;
    while (existingNames.has(copyName)) { copyName = `${baseName} (Copy-${n++})`; }

    const draft: Tournament = {
      ...createTournament(copyName),
      teams: source.teams.filter((tm) => !tm.out).map((tm) => ({ ...tm, id: crypto.randomUUID(), out: true })),
      pointSystem: source.pointSystem,
      isActive: false, // copies always start with booking Off
    };

    // Store draft in memory — will only be saved if user confirms
    setPendingCloneDraft(draft);
    // Start ALL teams as OUT (not booked) — user marks each one IN before cloning
    setExcludedCloneTeams(new Set(draft.teams.map(t => t.id)));
    setShowCreate(false);
    setAddForm({ name: "", tags: "", phone: "" });
    setAddScreenTab("entered"); setAddScreenMode("create"); setShowAddScreen(true);
    setAddScreenSnapshot({ teamCount: draft.teams.length, entryFee: draft.entryFee ?? 0, isActive: draft.isActive ?? false });
  };

  const handleAddTeamToScreen = () => {
    if (!tournament || !addForm.name.trim()) return;

    // Phone is required for wallet auto-creation
    const phoneDigits = addForm.phone.trim().replace(/\D/g, "");
    if (!phoneDigits) {
      toast.error("Leader phone is required");
      return;
    }

    // Duplicate phone check
    const dup = tournament.teams.find(
      (t) => t.phone && t.phone.replace(/\D/g, "") === phoneDigits
    );
    if (dup) {
      toast.error(`📵 ${phoneDigits} already registered under "${dup.name}"`);
      return;
    }

    const players = playerInputs.map((p) => p.trim()).filter(Boolean);
    const newTeam: Team = {
      id: crypto.randomUUID(),
      name: addForm.name.trim(),
      players: players.length > 0 ? uniquePlayers(players) : undefined,
      phone: phoneDigits,
      out: false, // always IN when manually added
    };
    const updated = { ...tournament, teams: [...tournament.teams, newTeam] };
    save(updated);
    // Auto-create leader wallet (captain name or team name)
    const captainName = players[0] || newTeam.name;
    upsertLeaderWallet(captainName, phoneDigits);
    setAddForm({ name: "", tags: "", phone: "" });
    setPlayerInputs([""]);
    toast.success(`"${newTeam.name}" added!`);
  };

  const handleTeamNamePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const parsed = parseTeamPaste(text);
    if (!parsed) return;
    e.preventDefault();
    if (parsed.teamName) setAddForm((f) => ({ ...f, name: parsed.teamName, phone: parsed.phone || f.phone }));
    if (parsed.players.length > 0) setPlayerInputs(parsed.players);
    toast.success('Team pasted!');
  };

  const saveEditTeam = () => {
    if (!tournament || !editingTeam) return;
    const liveTeam = tournament.teams.find(t => t.id === editingTeam.id) || editingTeam;
    const updatedTeam = {
      ...liveTeam,
      name: editTeamForm.name.trim() || liveTeam.name,
      tags: editTeamForm.tags.split(",").map(t=>t.trim()).filter(Boolean),
      phone: editTeamForm.phone.trim() || liveTeam.phone,
    };
    const updated = tournament.teams.map((t) => t.id === editingTeam.id ? updatedTeam : t);
    save({ ...tournament, teams: updated });
    // Auto-upsert wallet when phone is present
    if (updatedTeam.phone) {
      const captainName = updatedTeam.players?.[0] || updatedTeam.name;
      upsertLeaderWallet(captainName, updatedTeam.phone);
    }
    setEditingTeam(null);
    toast.success('Team updated!');
  };

  const handleDeleteTournament = async (id: string) => {
    setTournaments((prev) => deleteTournamentById(id, prev));
    toast.success("Deleted");
    // Delete from server — await so sync doesn't race and re-create it
    try {
      const res = await authFetch(`/api/tournaments/${id}`, { method: "DELETE" });
      if (!res.ok) toast.error("Server delete failed");
    } catch { /* offline — deleted ID is tracked so sync won't re-add */ }
    scheduleSyncDebounce();
  };

  const handleShare = async (t: Tournament) => {
    // If tokens already cached locally → open instantly, no network call
    if (t.shareToken && t.shortCode) {
      const url = `${window.location.origin}/t/${t.shareToken}`;
      setShareInfo({ code: t.shortCode, url, name: t.name });
      setShowShareModal(true);
      return;
    }
    // First time — fetch/generate tokens from server
    try {
      const res = await authFetch(`/api/tournaments/${t.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: t }),
      });
      if (!res.ok) { toast.error(res.status === 401 ? "Sign in to share" : "Share failed"); return; }
      const { token, shortCode } = await res.json();
      const url = `${window.location.origin}/t/${token}`;
      // Cache tokens in local tournament data so next open is instant
      const updated = { ...t, shareToken: token, shortCode };
      save(updated);
      setShareInfo({ code: shortCode, url, name: t.name });
      setShowShareModal(true);
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") toast.error("Share failed");
    }
  };

  const handleImportByCode = async () => {
    const code = importCode.trim().toUpperCase();
    if (code.length !== 6) { toast.error("Enter a valid 6-character code"); return; }
    setImportLoading(true);
    try {
      const res = await fetch(`/api/share/${code}`);
      if (!res.ok) { toast.error("Code not found — check and try again"); return; }
      const { tournament: t } = await res.json();
      if (!t) { toast.error("Invalid code"); return; }

      const existing = loadTournaments();

      // Block self-import: user is trying to import their own tournament
      const ownedIds = new Set(existing.filter(e => !e.sharedFrom).map(e => e.id));
      if (ownedIds.has(t.id)) {
        toast.error("That\'s your own tournament — you can\'t import it");
        setImportCode(""); setShowImportCode(false);
        return;
      }

      // Store sharedFrom so changes sync back to the owner's DB via the share code
      const alreadyImported = existing.find(e => e.sharedFrom === code);
      if (alreadyImported) {
        toast.info(`Already have "${t.name}" — it will sync automatically`);
        setImportCode(""); setShowImportCode(false);
        return;
      }
      const cloned: Tournament = { ...t, id: t.id ?? crypto.randomUUID(), sharedFrom: code, updatedAt: new Date().toISOString() };
      const updated = [cloned, ...existing];
      saveTournaments(updated);
      setTournaments(updated);
      scheduleSyncDebounce();
      setImportCode(""); setShowImportCode(false);
      toast.success(`"${t.name}" imported! Changes will sync back to the owner.`);
    } catch { toast.error("Import failed"); }
    finally { setImportLoading(false); }
  };

  /** True when this tournament was imported via share code and cannot be deleted */
  const isCollab = (t: Tournament) => !!(t.sharedFrom || t.name?.endsWith('(imported)'));

  /** Auto-create a leader wallet if one doesn't exist yet for that phone */
  const upsertLeaderWallet = (playerName: string, phone: string) => {
    fetch("/api/wallets/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName, phone }),
    }).catch(() => {}); // fire-and-forget, silently ignore errors
  };

  const copyPrompt = () => { if (!tournament) return; navigator.clipboard.writeText(generatePrompt(tournament.teams.filter(t => !t.out))); toast.success("Prompt copied!"); };

  const pasteJson = async () => { try { processJson(await navigator.clipboard.readText()); } catch { toast.error("Allow clipboard access"); } };

  /** Extract JSON from raw text — handles markdown code fences, leading text, etc. */
  const extractJson = (text: string): string => {
    // Try to extract from ```json ... ``` or ``` ... ``` fences
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    // Try to find the first { ... } block
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) return text.slice(braceStart, braceEnd + 1);
    return text.trim();
  };

  const processJson = (text: string) => {
    if (!tournament) return;
    try {
      const jsonStr = extractJson(text);
      const raw = JSON.parse(jsonStr) as GeminiOutput;
      if (!raw.groups || !Array.isArray(raw.groups)) throw new Error("Invalid JSON");
      const data = normalizeGeminiData(raw, tournament);
      const { assigned, autoAssignments, enrichedTeams } = autoAssignAndEnrich(tournament, data, assignments);
      setGroups(assigned);
      setAssignments(autoAssignments);
      setMatchesDetected(data.matches_detected || 0);
      const updated = { ...tournament, teams: enrichedTeams, geminiData: data, assignments: autoAssignments };
      save(updated);
      recomputeStandings(updated);
      const autoCount = Object.keys(autoAssignments).length;
      const enriched = enrichedTeams.filter((t, i) => t !== tournament.teams[i]).length;
      toast.success(`${data.groups.length} groups · ${data.matches_detected} matches · ${autoCount} assigned${enriched ? ` · ${enriched} rosters updated` : ""}`);
    } catch (err: unknown) { toast.error((err as Error).message || "Invalid JSON"); }
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("```")) { e.preventDefault(); processJson(text); }
  };
  const assignTeam = (groupLabel: string, teamId: string) => {
    if (!tournament) return;
    const na = { ...assignments, [groupLabel]: teamId }; setAssignments(na);
    setGroups((prev) => prev.map((g) => g.group === groupLabel ? { ...g, teamId, teamName: tournament.teams.find((t) => t.id === teamId)?.name } : g));
    const updated = { ...tournament, assignments: na }; save(updated); recomputeStandings(updated);
  };
  const unassignTeam = (groupLabel: string) => {
    if (!tournament) return;
    const na = { ...assignments }; delete na[groupLabel]; setAssignments(na);
    setGroups((prev) => prev.map((g) => g.group === groupLabel ? { ...g, teamId: undefined, teamName: undefined } : g));
    const updated = { ...tournament, assignments: na }; save(updated); recomputeStandings(updated);
  };

  // Hide bottom nav when any sheet/modal is open
  const anyModalOpen = showCreate || showAddScreen || showEdit || showStats || showStandings || showSlots || showPointSystem || showAdvanced || showSplit;
  // Lock body scroll when any modal/overlay is open
  useEffect(() => {
    document.body.dataset.modal = anyModalOpen ? "open" : "";
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => { document.body.dataset.modal = ""; document.body.style.overflow = ""; };
  }, [anyModalOpen]);

  return (
    <div className="min-h-screen pb-36" style={{ background: "#0c0914" }} onPaste={handlePaste}>

      <MainView
        appName={APP_NAME}
        tournaments={tournaments}
        tournament={tournament}
        setTournament={setTournament}
        pageLoaded={pageLoaded}
        syncStatus={syncStatus}
        isCollab={isCollab}
        onSync={handleSync}
        onOpenAction={openAction}
        onShare={handleShare}
        onDelete={handleDeleteTournament}
        onCollabDelete={setCollabDeleteId}
        onCreateOpen={() => setShowCreate(true)}
        onImportOpen={() => setShowImportCode(true)}
        save={save}
      />

      {/* CREATE SCREEN */}
      {showCreate && (
        <CreateScreen
          tournaments={tournaments}
          createName={createName}
          setCreateName={setCreateName}
          roundRobin={roundRobin}
          setRoundRobin={setRoundRobin}
          onClose={() => { setShowCreate(false); setCreateName(""); setRoundRobin(false); }}
          onCreate={handleCreate}
          onClone={handleCloneCreate}
        />
      )}
      {/* ADD TEAMS SCREEN */}
      {showAddScreen && (tournament || pendingCloneDraft) && (
        <AddTeamsScreen
          tournament={pendingCloneDraft ?? tournament!}
          addScreenTab={addScreenTab}
          setAddScreenTab={setAddScreenTab}
          addScreenMode={addScreenMode}
          addScreenSnapshot={addScreenSnapshot}
          addForm={addForm}
          setAddForm={setAddForm}
          playerInputs={playerInputs}
          setPlayerInputs={setPlayerInputs}
          playerInputRefs={playerInputRefs}
          clonedFromId={clonedFromId}
          setClonedFromId={setClonedFromId}
          excludedCloneTeams={excludedCloneTeams}
          setExcludedCloneTeams={setExcludedCloneTeams}
          showPasteTip={showPasteTip}
          setShowPasteTip={setShowPasteTip}
          handleAddTeamToScreen={handleAddTeamToScreen}
          handleTeamNamePaste={handleTeamNamePaste}
          parseTeamPaste={parseTeamPaste}
          handleDeleteTournament={handleDeleteTournament}
          save={save}
          setShowAddScreen={setShowAddScreen}
          setShowCreate={setShowCreate}
          setAddScreenSnapshot={setAddScreenSnapshot}
          isPendingClone={pendingCloneDraft !== null}
          onConfirmClone={(bookedTeamIds) => {
            // Clone ALL teams — set out:true for those not booked, out:false for booked ones
            const final = {
              ...pendingCloneDraft!,
              teams: pendingCloneDraft!.teams.map(t => ({ ...t, out: !bookedTeamIds.has(t.id) }))
            };
            setTournaments((prev) => { const u = [...prev, final]; saveTournaments(u); return u; });
            setTournament(final);
            scheduleSyncDebounce();
            setPendingCloneDraft(null);
            setExcludedCloneTeams(new Set());
            setShowAddScreen(false);
            setAddScreenSnapshot(null);
            toast.success(`"${final.name}" created!`);
          }}
          onCancelClone={() => {
            setPendingCloneDraft(null);
            setExcludedCloneTeams(new Set());
            setShowAddScreen(false);
            setShowCreate(true);
          }}
          onEditTeam={(team) => {
            setEditingTeam(team);
            setEditTeamForm({
              name: team.name,
              tags: "",
              players: (team.players ?? []).join(", "),
              phone: team.phone ?? "",
            });
          }}
          pastTeams={pastTeams}
          onAddPastTeam={(pt) => {
            const t = pendingCloneDraft ?? tournament!;
            const newTeam: Team = {
              id: crypto.randomUUID(),
              name: pt.name,
              phone: pt.phone,
              players: pt.players,
              out: false,
            };
            const updated = { ...t, teams: [...t.teams, newTeam] };
            if (pendingCloneDraft) {
              setPendingCloneDraft(updated);
            } else {
              save(updated);
            }
          }}
          onDeletePastTeam={(pt) => {
            const updated = pastTeams.filter(p => p.name.toLowerCase().trim() !== pt.name.toLowerCase().trim());
            setPastTeams(updated);
            import("@/lib/storage").then(({ savePastTeams }) => savePastTeams(updated));
          }}
          onUpdatePastTeam={(pt) => {
            const updated = pastTeams.map(p => p.name.toLowerCase().trim() === pt.name.toLowerCase().trim() ? pt : p);
            setPastTeams(updated);
            import("@/lib/storage").then(({ savePastTeams }) => savePastTeams(updated));
          }}
        />
      )}

      {/* TEAM EDIT SCREEN */}
      {editingTeam && tournament && (
        <TeamEditScreen
          team={editingTeam}
          tournament={tournament}
          editTeamForm={editTeamForm}
          setEditTeamForm={setEditTeamForm}
          showTeamDetails={showTeamDetails}
          setShowTeamDetails={setShowTeamDetails}
          editingPlayerIdx={editingPlayerIdx}
          setEditingPlayerIdx={setEditingPlayerIdx}
          save={save}
          onSave={saveEditTeam}
          onClose={() => { setEditingTeam(null); setShowTeamDetails(false); }}
        />
      )}

      {/* ADD TEAMS MODAL */}

      {/* POINT SYSTEM MODAL */}
      {showPointSystem && tournament && (
        <PointSystemModal
          tournament={tournament}
          editingPoints={editingPoints}
          setEditingPoints={setEditingPoints}
          showMorePositions={showMorePositions}
          setShowMorePositions={setShowMorePositions}
          save={save}
          onClose={() => setShowPointSystem(false)}
        />
      )}

      {/* EDIT SHEET */}
      {showEdit && tournament && (
        <EditSheet
          tournament={tournament}
          save={save}
          onClose={() => { setShowEdit(false); }}
          onEditTeams={() => {
            setAddForm({ name: "", tags: "", phone: "" });
            setPlayerInputs([""]);
            setAddScreenTab("entered"); // open on Entered so user sees all teams + can toggle booked/not
            setAddScreenMode("edit");

            setAddScreenSnapshot({ teamCount: tournament?.teams.length ?? 0, entryFee: tournament?.entryFee ?? 0, isActive: tournament?.isActive ?? false });
            setShowAddScreen(true);
          }}
          onOpenPointSystem={() => {
            setEditingPoints(tournament.pointSystem ?? DEFAULT_BGMI_POINTS);
            setShowPointSystem(true);
          }}
          onOpenAdvanced={() => { setShowAdvanced(true); }}
          onDelete={handleDeleteTournament}
        />
      )}

      {/* ADVANCED SCREEN */}
      {showAdvanced && tournament && (
        <AdvancedScreen
          tournament={tournament}
          standings={standings}
          save={save}
          onClose={() => setShowAdvanced(false)}
          onOpenSplit={() => { setShowAdvanced(false); setShowSplit(true); }}
        />
      )}

      {/* SPLIT SCREEN */}
      {showSplit && tournament && (
        <SplitScreen
          tournament={tournament}
          save={save}
          onClose={() => setShowSplit(false)}
        />
      )}

      {/* STATS / CALCULATE MODAL */}
      {showStats && tournament && (
        <CalculateScreen
          tournament={tournament}
          groups={groups}
          assignments={assignments}
          matchesDetected={matchesDetected}
          standings={standings}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
          onAssignTeam={assignTeam}
          onUnassignTeam={unassignTeam}
          onCopyPrompt={copyPrompt}
          onPasteJson={pasteJson}
          onClearData={() => {
            if (!tournament) return;
            const updated = { ...tournament, geminiData: undefined, assignments: {} };
            save(updated); setGroups([]); setAssignments({}); setMatchesDetected(0); setStandings([]);
            toast.success("Match data cleared");
          }}
          onClose={() => setShowStats(false)}
        />
      )}

      {/* SLOTS MODAL */}
      {showSlots && tournament && (
        <SlotsModal tournament={tournament} groupFilter={groupFilter} setGroupFilter={setGroupFilter} onClose={() => setShowSlots(false)} />
      )}

      {/* STANDINGS MODAL */}
      {showStandings && tournament && (
        <StandingsModal tournament={tournament} standings={standings} standingsTab={standingsTab} groupFilter={groupFilter} setGroupFilter={setGroupFilter} onClose={() => setShowStandings(false)} />
      )}

      {/* SHARE CODE MODAL */}
      {showShareModal && shareInfo && tournament && (
        <ShareCodeModal tournament={tournament} save={save} shareInfo={shareInfo} onClose={() => setShowShareModal(false)} />
      )}

      {/* IMPORT BY CODE MODAL */}
      {showImportCode && (
        <ImportCodeModal
          importCode={importCode}
          setImportCode={setImportCode}
          importLoading={importLoading}
          onImport={handleImportByCode}
          onClose={() => setShowImportCode(false)}
        />
      )}

      {/* COLLAB LOCAL DELETE CONFIRM */}
      {collabDeleteId && (
        <CollabDeleteConfirm
          tournamentId={collabDeleteId}
          onConfirm={handleDeleteTournament}
          onCancel={() => setCollabDeleteId(null)}
        />
      )}

      {/* ROOM INFO */}
      {showRoomInfo && tournament && (
        <RoomInfoModal tournament={tournament} save={save} onClose={() => setShowRoomInfo(false)} />
      )}

      {/* BOOKINGS MODAL */}
      {showBookings && tournament && (
        <BookingsModal tournament={tournament} save={save} onClose={() => setShowBookings(false)} onSyncNow={handleSync} />
      )}

      {/* RULES MODAL */}
      {showRulesModal && tournament && (
        <RulesModal tournament={tournament} save={save} onClose={() => setShowRulesModal(false)} />
      )}

    </div>
  );
}
