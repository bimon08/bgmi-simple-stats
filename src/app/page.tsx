"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, X, Minus, Download, Share2, Trophy,
  Clipboard, ClipboardPaste, ChevronDown, ChevronUp, Target,
  Users, MoreHorizontal, FileDown, Database, Table2, Flame,
  ImageIcon, Pencil, UserPlus, ListX, Pen, Star, HelpCircle,
  Flag, ArrowRight, Save, Search, Tag, BarChart2, Hash,
  ListOrdered, TrendingUp, MoreVertical, Phone, RefreshCw,
} from "lucide-react";
import { toJpeg } from "html-to-image";
import { toast } from "sonner";
import { Team, Tournament, StandingRow, GeminiOutput, AssignedGroup, PointSystem, DEFAULT_BGMI_POINTS } from "@/lib/types";
import CreateScreen from "./components/CreateScreen";
import BookingsModal from "./components/BookingsModal";
import TeamEditScreen from "./components/TeamEditScreen";
import PointSystemModal from "./components/PointSystemModal";
import EditSheet from "./components/EditSheet";
import AddTeamsScreen from "./components/AddTeamsScreen";
import SYNCED_PLAYERS from "@/data/players.json";

import {
  loadTournaments, saveTournaments, createTournament,
  upsertTournament, deleteTournamentById, mergeTournaments,
} from "@/lib/storage";
import { compareTiebreaker } from "@/lib/points";
import { generatePrompt } from "@/lib/prompt";
import { formatIndianPhone } from "@/lib/phone";

const APP_NAME = "ScoreCalc";

function Pill({ label, icon, onPress, active = false, variant = "default" }: {
  label: string; icon?: React.ReactNode; onPress: () => void; active?: boolean; variant?: "default" | "share" | "edit";
}) {
  const base = "px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 select-none";
  if (variant === "share" || variant === "edit") {
    return <button onClick={onPress} className={base} style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(30,24,48,0.9)", color: "rgba(196,181,253,0.85)" }}>{icon}{label}</button>;
  }
  return <button onClick={onPress} className={base} style={{ border: `1px solid ${active ? "rgba(139,92,246,0.9)" : "rgba(139,92,246,0.35)"}`, background: active ? "rgba(124,58,237,0.3)" : "transparent", color: active ? "#c4b5fd" : "rgba(196,181,253,0.65)" }}>{icon}{label}</button>;
}

/** Merge two team arrays by ID with field-level conflict resolution.
 *  When the same team exists on both sides, the non-empty value wins for
 *  optional fields (phone, players) so collaborator additions are preserved. */
function mergeTeams(local: Team[], remote: Team[]): Team[] {
  const localMap  = new Map(local.map(t => [t.id, t]));
  const remoteMap = new Map(remote.map(t => [t.id, t]));
  const allIds    = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const result: Team[] = [];
  allIds.forEach(id => {
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    if (!l) { result.push(r!); return; }
    if (!r) { result.push(l);  return; }
    // Both sides have the team — merge at field level
    result.push({
      ...r,             // remote as base (DB ground truth)
      ...l,             // local scalar fields override
      // Optional fields: take whichever side is non-empty
      phone: l.phone || r.phone || undefined,
      // Players: take whichever side has more (or local if equal)
      players: (l.players?.length ?? 0) >= (r.players?.length ?? 0)
        ? (l.players ?? [])
        : (r.players ?? []),
    });
  });
  return result;
}

function QuickBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <div className="h-14 w-14 rounded-2xl flex items-center justify-center transition-all active:scale-90" style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(139,92,246,0.28)", color: "#c4b5fd" }}>{icon}</div>
      <span className="text-[10px] text-center font-medium leading-tight whitespace-pre-line" style={{ color: "rgba(196,181,253,0.7)" }}>{label}</span>
    </button>
  );
}

export default function TeamsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [roundRobin, setRoundRobin] = useState(false);
  const [clonedFromId, setClonedFromId] = useState<string | null>(null);
  const [excludedCloneTeams, setExcludedCloneTeams] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const toggleCard = (id: string) => setExpandedCards((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [showAddScreen, setShowAddScreen] = useState(false);
  const [addScreenTab, setAddScreenTab] = useState<"add" | "entered">("add");
  const [addScreenMode, setAddScreenMode] = useState<"create" | "edit">("create");
  const [addForm, setAddForm] = useState({ name: "", slot: "", tags: "", phone: "" });
  const [playerInputs, setPlayerInputs] = useState<string[]>([""]);  
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamForm, setEditTeamForm] = useState({ name: "", slot: "", tags: "", players: "", phone: "" });
  const [initialTeamCount, setInitialTeamCount] = useState(0);
  const [addScreenSnapshot, setAddScreenSnapshot] = useState<{ teamCount: number; entryFee: number; isActive: boolean } | null>(null);
  const [showSlots, setShowSlots] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showPointSystem, setShowPointSystem] = useState(false);
  const [editingPoints, setEditingPoints] = useState<PointSystem>(DEFAULT_BGMI_POINTS);
  const [showMorePositions, setShowMorePositions] = useState(false);
  const [standingsTab, setStandingsTab] = useState<"table" | "warhead" | "fraggers">("table");
  const [showStats, setShowStats] = useState(false);
  const [syncedPlayers, setSyncedPlayers] = useState<{ playerName: string; phone: string | null }[]>([]);
  type SyncStatus = 'idle' | 'pending' | 'syncing' | 'offline' | 'synced' | 'unauthed';
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSyncPicker, setShowSyncPicker] = useState(false);
  const [syncPickerTarget, setSyncPickerTarget] = useState<number>(0); // which row we're picking for
  const [startSlot, setStartSlot] = useState(3);
  const slotsRef = useRef<HTMLDivElement>(null);
  const playerInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const standingsRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [matchesDetected, setMatchesDetected] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareInfo, setShareInfo] = useState<{ code: string; url: string; name: string } | null>(null);
  const [showImportCode, setShowImportCode] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [editingPlayerIdx, setEditingPlayerIdx] = useState<number | null>(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [showPasteTip, setShowPasteTip] = useState(false);
  const [waGroupLink, setWaGroupLink] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [tournamentTab, setTournamentTab] = useState<'mine' | 'shared'>('mine');
  const [collabDeleteId, setCollabDeleteId] = useState<string | null>(null);
  const [pageLoaded, setPageLoaded] = useState(false);

  // Load local immediately, then silently pull + merge from DB on mount
  useEffect(() => {
    const local = loadTournaments();
    setTournaments(local);
    setPageLoaded(true);
    fetch("/api/tournaments")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!json?.tournaments) return;
        const remote: Tournament[] = json.tournaments;
        const localMap  = new Map(local.map((t) => [t.id, t]));
        const remoteMap = new Map(remote.map((t) => [t.id, t]));
        const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
        const merged: Tournament[] = [];
        allIds.forEach((id) => {
          const l = localMap.get(id);
          const r = remoteMap.get(id);
          if (!l) { merged.push(r!); return; }
          if (!r) { merged.push(l);  return; }
          const lTs = l.updatedAt ?? l.createdAt ?? "";
          const rTs = r.updatedAt ?? r.createdAt ?? "";
          const base  = lTs >= rTs ? l : r;
          const other = lTs >= rTs ? r : l;
          merged.push({ ...base, teams: mergeTeams(base.teams ?? [], other.teams ?? []) });
        });
        saveTournaments(merged);
        setTournaments(merged);
        setSyncStatus('synced');
      })
      .catch(() => {}); // fail silently if offline on load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retry auto-sync when network comes back
  useEffect(() => {
    const onOnline = () => { if (syncStatus === 'offline') scheduleSyncDebounce(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);

  // Sync when tab comes back into focus (catches collaborator changes at no extra cost)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine &&
          (syncStatus === 'synced' || syncStatus === 'idle')) {
        doSync(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);


  // Native back-button: push a history entry whenever any overlay opens, pop to close the top-most one
  useEffect(() => {
    const anyOpen =
      showCreate || showAddScreen || !!editingTeam ||
      showStats || showStandings || showSlots ||
      showPointSystem || showEdit ||
      showMore || showRename;

    if (anyOpen) {
      history.pushState({ overlay: true }, '');
    }

    const onPop = () => {
      // Close in reverse-depth order (deepest first)
      if (editingTeam)    { setEditingTeam(null); return; }
      if (showStats)      { setShowStats(false); return; }
      if (showStandings)  { setShowStandings(false); return; }
      if (showSlots)      { setShowSlots(false); return; }
      if (showPointSystem){ setShowPointSystem(false); return; }
      if (showAddScreen)  { setShowAddScreen(false); return; }
      if (showEdit)       { setShowEdit(false); return; }
      if (showMore)       { setShowMore(false); return; }
      if (showRename)     { setShowRename(false); return; }
      if (showCreate)     { setShowCreate(false); setCreateName(''); setRoundRobin(false); return; }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate, showAddScreen, editingTeam, showStats, showStandings,
      showSlots, showPointSystem, showEdit, showMore, showRename]);

  const computeStandings = (t: Tournament) => {
    if (!t.geminiData) { setStandings([]); return; }
    const assignMap = t.assignments ?? {};
    // Normalize in case stored data pre-dates the totals computation
    const ps = t.pointSystem ?? DEFAULT_BGMI_POINTS;
    const groups = t.geminiData.groups.map((group) => {
      if (group.totals) return group; // already normalized
      const matches = group.matches.map((m) => {
        const teamKills = Object.values(m.playerKills ?? {}).reduce((a, b) => a + b, 0);
        const placementPoints = ps.positionPoints[m.position - 1] ?? 0;
        const matchPoints = placementPoints + teamKills * ps.killPoints;
        return { ...m, teamKills, placementPoints, matchPoints };
      });
      const totals = {
        totalPoints: matches.reduce((a, m) => a + m.matchPoints, 0),
        chickenDinners: matches.filter((m) => m.position === 1).length,
        totalPlacementPoints: matches.reduce((a, m) => a + m.placementPoints, 0),
        totalKills: matches.reduce((a, m) => a + m.teamKills, 0),
        lastMatchPosition: matches[matches.length - 1]?.position ?? 0,
      };
      return { ...group, matches, totals };
    });
    const rows: StandingRow[] = groups.map((group) => {
      const teamId = assignMap[group.group];
      const team = t.teams.find((tm) => tm.id === teamId);
      return {
        teamId: teamId || group.group,
        teamName: team?.name || group.group,
        group: group.group,
        players: group.players,
        totalPoints: group.totals.totalPoints,
        chickenDinners: group.totals.chickenDinners,
        placementPoints: group.totals.totalPlacementPoints,
        totalKills: group.totals.totalKills,
        lastMatchPosition: group.totals.lastMatchPosition,
        positions: group.matches.map((m) => m.position),
        matchCount: group.matches.length,
      };
    });

    // Add 0-stat rows for registered teams that didn't appear in any group
    const assignedTeamIds = new Set(Object.values(assignMap));
    t.teams.forEach((team) => {
      if (assignedTeamIds.has(team.id)) return; // already in standings
      rows.push({
        teamId: team.id,
        teamName: team.name,
        group: "—",
        players: team.players ?? [],
        totalPoints: 0,
        chickenDinners: 0,
        placementPoints: 0,
        totalKills: 0,
        lastMatchPosition: 0,
        positions: [],
        matchCount: 0,
      });
    });

    rows.sort(compareTiebreaker);
    setStandings(rows);
  };

  const save = useCallback((t: Tournament) => {
    const updated = { ...t, updatedAt: new Date().toISOString() };
    setTournament(updated);
    setTournaments((prev) => upsertTournament(updated, prev));
    scheduleSyncDebounce(); // auto-push after 2.5s idle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSync = async (showToast = false) => {
    if (!navigator.onLine) { setSyncStatus('offline'); return; }
    setSyncStatus('syncing');
    try {
      const local = loadTournaments();
      const ownedLocal  = local.filter(t => !t.sharedFrom);
      const sharedLocal = local.filter(t =>  t.sharedFrom);

      // ── Pull + push owned tournaments (requires session) ──────────────────
      // Skip entirely if there are no owned tournaments (pure collaborator)
      let ownedMerged: Tournament[] = ownedLocal;
      if (ownedLocal.length > 0) {
        const pullRes = await fetch("/api/tournaments");
        if (pullRes.status === 401) { setSyncStatus('unauthed'); }
        else if (pullRes.ok) {
          const { tournaments: remote } = await pullRes.json() as { tournaments: Tournament[] };
          const remoteMap = new Map(remote.map((t: Tournament) => [t.id, t]));
          const localMap  = new Map(ownedLocal.map(t => [t.id, t]));
          const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
          ownedMerged = [];
          allIds.forEach(id => {
            const l = localMap.get(id);
            const r = remoteMap.get(id);
            if (!l) { ownedMerged.push(r!); return; }
            if (!r) { ownedMerged.push(l);  return; }
            const localNewer = (l.updatedAt ?? "") >= (r.updatedAt ?? "");
            const base = localNewer ? l : r;
            const other = localNewer ? r : l;
            ownedMerged.push({
              ...base,
              teams: mergeTeams(base.teams ?? [], other.teams ?? []),
              // For every admin-set field: local value wins over remote.
              // Remote only fills in if local is completely absent (undefined).
              // This ensures any intentional change on this device survives sync
              // regardless of timestamp comparison edge-cases.
              isActive:    l.isActive    ?? r.isActive,
              entryFee:    l.entryFee    ?? r.entryFee,
              rules:       l.rules       ?? r.rules,
              roomInfo:    l.roomInfo    ?? r.roomInfo,
              waGroup:     l.waGroup     ?? r.waGroup,
              waMessage:   l.waMessage   ?? r.waMessage,
              waGroupSent: l.waGroupSent ?? r.waGroupSent,
              pointSystem: l.pointSystem ?? r.pointSystem,
              geminiData:  l.geminiData  ?? r.geminiData,
              assignments: l.assignments ?? r.assignments,
            });
          });
          if (ownedMerged.length > 0) {
            const pushRes = await fetch("/api/tournaments", {
              method: "PUT", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tournaments: ownedMerged }),
            });
            if (pushRes.status === 401) setSyncStatus('unauthed');
            else if (!pushRes.ok) throw new Error("Sync failed");
          }
        }
      }

      // ── Pull + push shared tournaments (no auth needed) ──────────────────
      const sharedMerged: Tournament[] = [];
      for (const st of sharedLocal) {
        const code = st.sharedFrom!;
        try {
          // Pull latest from owner's DB
          const sRes = await fetch(`/api/share/${code}`);
          if (!sRes.ok) { sharedMerged.push(st); continue; } // code gone? keep local
          const { tournament: remote } = await sRes.json() as { tournament: Tournament };
          // Merge teams (incoming local wins for its teams, remote fills gaps)
          const merged: Tournament = { ...remote, sharedFrom: code, teams: mergeTeams(st.teams ?? [], remote.teams ?? []) };
          // Push merged back to owner's DB
          await fetch(`/api/share/${code}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tournament: merged }),
          });
          sharedMerged.push(merged);
        } catch { sharedMerged.push(st); }
      }

      // Combine owned + shared, deduplicating by ID.
      // If the same ID appears in both (owner imported their own tournament),
      // prefer the sharedFrom version so the collaborator view is consistent.
      const seenIds = new Set<string>();
      // Process sharedMerged first so they win on conflict
      const combined: Tournament[] = [];
      for (const t of [...sharedMerged, ...ownedMerged]) {
        if (!seenIds.has(t.id)) { seenIds.add(t.id); combined.push(t); }
      }
      // Restore original display order (owned first, shared second)
      const finalMerged = [
        ...combined.filter(t => !t.sharedFrom),
        ...combined.filter(t =>  t.sharedFrom),
      ];

      // Re-read localStorage NOW — user may have saved data (e.g. geminiData) while
      // the network calls above were in flight. Merge sync results INTO fresh local,
      // not over it, so mid-sync saves are never overwritten.
      const freshLocal = loadTournaments();
      const freshMap   = new Map(freshLocal.map(t => [t.id, t]));
      const syncMap    = new Map(finalMerged.map(t => [t.id, t]));
      const allFinalIds = new Set([...freshMap.keys(), ...syncMap.keys()]);
      const ultimateMerged: Tournament[] = [];
      allFinalIds.forEach(id => {
        const f = freshMap.get(id);
        const s = syncMap.get(id);
        if (!f) { ultimateMerged.push(s!); return; }
        if (!s) { ultimateMerged.push(f);  return; }
        // Fresh local wins (has any mid-sync saves); merge teams from both
        const freshNewer = (f.updatedAt ?? "") >= (s.updatedAt ?? "");
        const base  = freshNewer ? f : s;
        const other = freshNewer ? s : f;
        ultimateMerged.push({ ...base, teams: mergeTeams(base.teams ?? [], other.teams ?? []) });
      });
      saveTournaments(ultimateMerged);
      setTournaments(ultimateMerged);
      // Also refresh the active tournament if it's currently open,
      // so isActive / other fields don't appear stale in open screens
      setTournament(prev => {
        if (!prev) return prev;
        return ultimateMerged.find(t => t.id === prev.id) ?? prev;
      });

      if (syncStatus !== 'unauthed') setSyncStatus('synced');
      if (showToast) toast.success(`Synced ☁️`);
    } catch {
      setSyncStatus('offline');
      if (showToast) toast.error("Sync failed — will retry when online");
    }
  };

  const scheduleSyncDebounce = () => {
    setSyncStatus('pending');
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => doSync(false), 2500);
  };

  const handleSync = () => {
    if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; }
    doSync(true);
  };

  const openAction = (t: Tournament, action: string) => {
    setTournament(t); setOpenDropdown(null); setExpandedGroups(new Set());
    if (t.geminiData) {
      const ps = t.pointSystem ?? DEFAULT_BGMI_POINTS;
      const normalizedGroups = t.geminiData.groups.map((g) => {
        if (g.totals) return g;
        const matches = g.matches.map((m) => {
          const teamKills = Object.values(m.playerKills ?? {}).reduce((a, b) => a + b, 0);
          const placementPoints = ps.positionPoints[m.position - 1] ?? 0;
          const matchPoints = placementPoints + teamKills * ps.killPoints;
          return { ...m, teamKills, placementPoints, matchPoints };
        });
        const totals = {
          totalPoints: matches.reduce((a, m) => a + m.matchPoints, 0),
          chickenDinners: matches.filter((m) => m.position === 1).length,
          totalPlacementPoints: matches.reduce((a, m) => a + m.placementPoints, 0),
          totalKills: matches.reduce((a, m) => a + m.teamKills, 0),
          lastMatchPosition: matches[matches.length - 1]?.position ?? 0,
        };
        return { ...g, matches, totals };
      });
      setGroups(normalizedGroups.map((g) => ({ ...g, teamId: t.assignments?.[g.group], teamName: t.teams.find((tm) => tm.id === t.assignments?.[g.group])?.name })));
      setAssignments(t.assignments || {}); setMatchesDetected(t.geminiData.matches_detected); computeStandings(t);
    } else { setGroups([]); setAssignments(t.assignments || {}); setMatchesDetected(0); setStandings([]); }
    switch (action) {
      case "calculate": setShowStats(true); break;
      case "tables": setStandingsTab("table"); setShowStandings(true); break;
      case "warheads": setStandingsTab("warhead"); setShowStandings(true); break;
      case "fraggers": setStandingsTab("fraggers"); setShowStandings(true); break;
      case "slots": setShowSlots(true); break;
      case "edit": setShowEdit(true); break;
      case "bookings": setShowBookings(true); break;
      case "room-info": {
        const defaultMsg = `Hi *{team}*! 🎮\nPlease join this group to get ID and Password for *${t.name}*:\n{link}`;
        const savedMsg = (t.waMessage ?? "")
          .replace(/\*the tournament\*/g, `*${t.name}*`)
          .replace(/for the tournament/g, `for *${t.name}*`)
          .replace(/\bjilr\b|\bjillr\b/g, "join");
        setWaGroupLink(t.waGroup ?? "");
        setWaMessage(savedMsg || defaultMsg);
        setShowRoomInfo(true);
        break;
      }
      case "rules":
        setRulesText((t.rules ?? []).join("\n"));
        setShowRulesModal(true); break;
      default: toast("Coming soon 🚀");
    }
  };

  const handleCreate = () => {
    if (!createName.trim()) return;
    const t = createTournament(createName.trim());
    setTournaments((prev) => { const u = [...prev, t]; saveTournaments(u); return u; });
    setTournament(t);
    setCreateName(""); setRoundRobin(false); setShowCreate(false);
    setAddForm({ name: "", slot: String(t.teams.length + 1), tags: "", phone: "" });
    setAddScreenTab("add"); setAddScreenMode("create"); setShowAddScreen(true);
    setAddScreenSnapshot({ teamCount: t.teams.length, entryFee: t.entryFee ?? 0, isActive: t.isActive ?? false });
  };

  const handleCloneCreate = (source: Tournament) => {
    // Generate unique name: "Name (Copy)" → "Name (Copy-2)" → "Name (Copy-3)"
    const existingNames = new Set(tournaments.map(t => t.name));
    const baseName = source.name.replace(/ \(Copy(?:-\d+)?\)$/, ""); // strip any existing (Copy-N)
    let copyName = `${baseName} (Copy)`;
    let n = 2;
    while (existingNames.has(copyName)) { copyName = `${baseName} (Copy-${n++})`; }

    const t: Tournament = {
      ...createTournament(copyName),
      teams: source.teams.map((tm) => ({ ...tm, id: crypto.randomUUID() })),
      pointSystem: source.pointSystem,
    };
    setTournaments((prev) => { const u = [...prev, t]; saveTournaments(u); return u; });
    setTournament(t);
    setShowCreate(false);
    setAddForm({ name: "", slot: String(t.teams.length + 1), tags: "", phone: "" });
    setAddScreenTab("entered"); setAddScreenMode("create"); setShowAddScreen(true);
    setClonedFromId(t.id);
    setAddScreenSnapshot({ teamCount: t.teams.length, entryFee: t.entryFee ?? 0, isActive: t.isActive ?? false });
    toast.success(`Cloned "${source.name}" — review below`);
  };

  // Deduplicate player names case-insensitively, preserving first occurrence
  const uniquePlayers = (players: string[]): string[] => {
    const seen = new Set<string>();
    return players.filter((p) => { const k = p.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
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
      slot: addForm.slot ? Number(addForm.slot) : undefined,
      players: players.length > 0 ? uniquePlayers(players) : undefined,
      phone: phoneDigits,
      paid: true,
    };
    const updated = { ...tournament, teams: [...tournament.teams, newTeam] };
    save(updated);
    // Auto-create leader wallet (captain name or team name)
    const captainName = players[0] || newTeam.name;
    upsertLeaderWallet(captainName, phoneDigits);
    setAddForm({ name: "", slot: String(updated.teams.length + 1), tags: "", phone: "" });
    setPlayerInputs([""]);
    toast.success(`"${newTeam.name}" added!`);
  };

  const parseTeamPaste = (text: string): { teamName: string; phone: string; captain: string; players: string[] } | null => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return null;

    // Strip leading separator chars (-, –, :, ：) from captured values
    const stripSep = (s: string) => s.replace(/^[\-–:：]\s*/, '').trim();

    // Normalize phone to last 10 digits (handles +91, 0-prefix, any country code)
    const normalizePhone = (s: string) => {
      const d = s.replace(/\D/g, '');
      return d.length > 10 ? d.slice(-10) : d;
    };

    const isPhone = (s: string) => {
      const d = s.replace(/\D/g, '');
      return d.length >= 7 && d.length <= 15 && /^\d+$/.test(d);
    };

    // Split on " or " → treat each part as a separate player slot
    const splitOrAlts = (s: string) =>
      s.split(/\s+or\s+/i).map(p => p.trim()).filter(Boolean);

    // ── PASS 1: Look for explicitly labelled lines ──────────────────────────
    // Handles formats like:
    //   Team - Maram / Team Name TSMent / Team name - KOLIS ESPORT
    //   Leader - KW・Mait / Leader Name SUGARXDADDYz / Leader Egocapt
    //   Phn - 9233805660 / Leader's phone number 8729811863 / Phone number 6009543515
    //   Player 2. 乡TBP乡KD / Player 3 TSMxSORRYbro / Player choke|god
    //   Player Name - TKLxChilly → continuation lines: "  - KolisTheOGzV", "  RRxVenom"
    let teamName = '';
    let phone = '';
    let captain = '';
    const players: string[] = [];
    let labeledHits = 0;
    let hasStructuredLabel = false;
    let afterPlayerNameLabel = false; // tracks "Player Name -" continuation mode

    for (const line of lines) {
      // ── Team label ──────────────────────────────────────────────────────────
      const mTeam = line.match(/^(?:[Tt]eam\s+[Nn]ame|[Tt]eam|[Ss]quad|[Cc]lan)\s*[-–:：]?\s+(.+)$/u);
      if (mTeam) {
        teamName = stripSep(mTeam[1].trim());
        labeledHits++; afterPlayerNameLabel = false; continue;
      }

      // ── Leader / Captain label ───────────────────────────────────────────────
      // Handles: "Leader - KW", "Leader Name X", "Leader's Name X", "Captain X"
      const mLeader = line.match(/^(?:[Ll]eader['s\u2019]*|[Cc]aptain)\s+(?:[Nn]ame\s+)?(.+)$/u);
      if (mLeader) {
        const raw = stripSep(mLeader[1].trim());
        // Skip bare "Leader Name" / "Leader:" header-only lines
        if (/^[Nn]ame\s*$/.test(raw) || raw === '') { continue; }
        const alts = splitOrAlts(raw);
        captain = alts[0];
        alts.slice(1).forEach(p => { if (!isPhone(p)) players.push(p); });
        labeledHits++; hasStructuredLabel = true; afterPlayerNameLabel = false; continue;
      }

      // ── Phone label ─────────────────────────────────────────────────────────
      // Handles: "Phone number", "Phn -", "Ph -", "Leader's phone number"
      const mPhone = line.match(
        /^(?:[Ll]er(?:[''\u2019]s?|s)?\s+)?[Pp]h(?:one?|n)\s*(?:[Nn]umber\s*)?[-–:：]?\s+(.+)$/u
      );
      if (mPhone) {
        const raw = stripSep(mPhone[1].trim());
        if (isPhone(raw)) {
          phone = normalizePhone(raw);
          labeledHits++; hasStructuredLabel = true; afterPlayerNameLabel = false; continue;
        }
      }

      // ── "Player Name - X" (single-label, multiple players follow) ─────────
      const mPlayerName = line.match(/^[Pp]layer\s+[Nn]ame\s*[-–:：]\s+(.+)$/u);
      if (mPlayerName) {
        const first = mPlayerName[1].trim();
        if (first && !isPhone(first)) {
          splitOrAlts(first).forEach(p => { players.push(p); });
        }
        labeledHits++; hasStructuredLabel = true; afterPlayerNameLabel = true; continue;
      }

      // ── Player N <value> / Player <value> ────────────────────────────────────
      // Handles: "Player 2 X", "Player 2. X", "Player 2- X", "Player X"
      const mPlayer = line.match(/^[Pp]layers?\s+(?:\d+[.\-\s]+)?(.+)$/u);
      if (mPlayer) {
        const raw = stripSep(mPlayer[1].trim());
        splitOrAlts(raw)
          .filter(p => !isPhone(p))
          .forEach(p => { players.push(p); labeledHits++; hasStructuredLabel = true; });
        afterPlayerNameLabel = true; continue;
      }

      // ── Continuation lines after "Player Name -" block ──────────────────────
      // Handles: "  - KolisTheOGzV", "  -No1xahhh", "  RRxVenom" (indented bare)
      if (afterPlayerNameLabel) {
        const stripped = line.replace(/^[-–]\s*/, '').trim();
        if (stripped && !isPhone(stripped) && !/^[Tt]eam|^[Ll]eader|^[Cc]aptain|^[Pp]h/u.test(line)) {
          splitOrAlts(stripped).forEach(p => { players.push(p); labeledHits++; });
          continue;
        }
      }

      // ── Bare phone line ───────────────────────────────────────────────────────
      if (!phone && isPhone(line)) {
        phone = normalizePhone(line); labeledHits++; afterPlayerNameLabel = false;
      }
    }

    // Only use labeled mode when we found at least one explicit structural keyword
    if (labeledHits >= 2 && hasStructuredLabel) {
      // Combine captain + players (captain first, deduplicated)
      const allPlayers = captain
        ? [captain, ...players.filter(p => p !== captain)]
        : players;
      return { teamName, phone, captain: captain || allPlayers[0] || '', players: allPlayers };
    }

    // ── PASS 2: Fallback heuristic (plain list format) ──────────────────────
    // First non-header line = team name; remaining lines = players/phone
    const stripBullet = (s: string) => s.replace(/^(?:\(?#?\d+[\.\)\-]?\)?\s*)/u, '').trim();
    const isHeader = (s: string) =>
      /^(?:[Pp]layers?|[Rr]oster|[Mm]embers?|[Ss]quad|[Ll]eader|[Cc]aptain)\s*[:：\-]?\s*$/.test(s);

    let fbTeamName = ''; let fbPhone = ''; let fbCaptain = '';
    const fbPlayers: string[] = [];

    for (const line of lines) {
      if (isHeader(line)) continue;
      if (!fbTeamName && fbPlayers.length === 0 && fbCaptain === '') { fbTeamName = line; continue; }
      if (!fbPhone && isPhone(line)) {
        fbPhone = normalizePhone(line); continue;
      }
      const name = stripBullet(line) || line;
      if (!fbCaptain) { fbCaptain = name; fbPlayers.push(name); }
      else { fbPlayers.push(name); }
    }

    const fbFinalPlayers = [...new Set(fbPlayers)];
    if (!fbTeamName && !fbFinalPlayers.length) return null;
    return { teamName: fbTeamName, phone: fbPhone, captain: fbCaptain, players: fbFinalPlayers };
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
    const updatedTeam = {
      ...editingTeam,
      name: editTeamForm.name.trim() || editingTeam.name,
      tags: editTeamForm.tags || undefined,
      phone: editTeamForm.phone.trim() || editingTeam.phone,
      players: editTeamForm.players.trim()
        ? uniquePlayers(editTeamForm.players.split(/[,\n]+/).map((p) => p.trim()).filter(Boolean))
        : editingTeam.players,
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

  const handleDeleteTournament = (id: string) => {
    setTournaments((prev) => deleteTournamentById(id, prev));
    toast.success("Deleted");
    // Also delete from server so it doesn't come back on refresh
    fetch(`/api/tournaments/${id}`, { method: "DELETE" }).catch(() => {});
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
      const res = await fetch(`/api/tournaments/${t.id}/share`, {
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
      // Store sharedFrom so changes sync back to the owner's DB via the share code
      const existing = loadTournaments();
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
      setImportCode(""); setShowImportCode(false);
      toast.success(`"${t.name}" imported! Changes will sync back to the owner.`);
    } catch { toast.error("Import failed"); }
    finally { setImportLoading(false); }
  };



  /** True when this tournament was imported via share code and cannot be deleted */
  const isCollab = (t: Tournament) => !!(t.sharedFrom || t.name?.endsWith('(imported)'));

  const handleDelete = (id: string) => { if (!tournament) return; save({ ...tournament, teams: tournament.teams.filter((t) => t.id !== id) }); toast.success("Removed"); };
  /** Auto-create a leader wallet if one doesn't exist yet for that phone */
  const upsertLeaderWallet = (playerName: string, phone: string) => {
    fetch("/api/wallets/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName, phone }),
    }).catch(() => {}); // fire-and-forget, silently ignore errors
  };


  const copyPrompt = () => { if (!tournament) return; navigator.clipboard.writeText(generatePrompt(tournament.teams)); toast.success("Prompt copied!"); };
  const openGemini = () => {
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      // Intent URL: opens Gemini app if installed, falls back to Play Store
      window.location.href = "intent://gemini.google.com/app#Intent;scheme=https;package=com.google.android.apps.bard;S.browser_fallback_url=https%3A%2F%2Fgemini.google.com%2Fapp;end";
    } else {
      window.open("https://gemini.google.com/app", "_blank", "noopener,noreferrer");
    }
  };
  const pasteJson = async () => { try { processJson(await navigator.clipboard.readText()); } catch { toast.error("Allow clipboard access"); } };

  /** Normalize raw Gemini output to match our GeminiOutput type */
  const normalizeGeminiData = (raw: GeminiOutput): GeminiOutput => {
    const ps = tournament?.pointSystem ?? DEFAULT_BGMI_POINTS;
    const groups = raw.groups.map((g) => {
      // Normalize matches: fill in missing placementPoints, teamKills, matchPoints
      const matches = g.matches.map((m) => {
        const teamKills = Object.values(m.playerKills ?? {}).reduce((a, b) => a + b, 0);
        const placementPoints = ps.positionPoints[m.position - 1] ?? 0;
        const matchPoints = placementPoints + teamKills * ps.killPoints;
        return { ...m, teamKills, placementPoints, matchPoints };
      });
      // Normalize players: accept array or object → always string[]
      const players: string[] = Array.isArray(g.players)
        ? g.players
        : Object.keys(g.players as unknown as Record<string, number>);
      // Compute totals from matches
      const totals = {
        totalPoints: matches.reduce((a, m) => a + m.matchPoints, 0),
        chickenDinners: matches.filter((m) => m.position === 1).length,
        totalPlacementPoints: matches.reduce((a, m) => a + m.placementPoints, 0),
        totalKills: matches.reduce((a, m) => a + m.teamKills, 0),
        lastMatchPosition: matches[matches.length - 1]?.position ?? 0,
      };
      return { ...g, players, matches, totals };
    });
    return { ...raw, groups };
  };

  const processJson = (text: string) => {
    if (!tournament) return;
    try {
      const raw = JSON.parse(text) as GeminiOutput;
      if (!raw.groups || !Array.isArray(raw.groups)) throw new Error("Invalid JSON");
      const data = normalizeGeminiData(raw);

      // Auto-assign: match group name → registered team name
      // Track which teamIds are already taken so one team can't be assigned twice
      const autoAssignments: Record<string, string> = { ...assignments };
      const usedTeamIds = new Set(Object.values(autoAssignments));

      data.groups.forEach((g) => {
        if (autoAssignments[g.group]) return; // already assigned
        const gLower = g.group.toLowerCase().trim();

        const available = (t: { id: string }) => !usedTeamIds.has(t.id);

        // 1. Exact name match
        let match = tournament.teams.find((t) => available(t) && t.name.toLowerCase().trim() === gLower);

        // 2. Contains match — only if both sides are ≥4 chars to avoid false positives
        if (!match && gLower.length >= 4) {
          match = tournament.teams.find((t) => {
            if (!available(t)) return false;
            const tLower = t.name.toLowerCase().trim();
            return (tLower.length >= 4 && tLower.includes(gLower)) ||
                   (tLower.length >= 4 && gLower.includes(tLower));
          });
        }

        // 3. Player-name fallback: if any player in this group is registered on a team
        if (!match) {
          const registeredMap = new Map<string, string>(); // lowercase player name → teamId
          tournament.teams.forEach((t) => (t.players ?? []).forEach((p) => registeredMap.set(p.toLowerCase().trim(), t.id)));
          for (const player of g.players) {
            const tid = registeredMap.get(player.toLowerCase().trim());
            if (tid) {
              const found = tournament.teams.find((t) => t.id === tid && available(t));
              if (found) { match = found; break; }
            }
          }
        }

        if (match) { autoAssignments[g.group] = match.id; usedTeamIds.add(match.id); }
      });

      const assigned: AssignedGroup[] = data.groups.map((g) => ({
        ...g,
        teamId: autoAssignments[g.group],
        teamName: tournament.teams.find((t) => t.id === autoAssignments[g.group])?.name,
      }));
      setGroups(assigned);
      setAssignments(autoAssignments);
      setMatchesDetected(data.matches_detected || 0);

      // Enrich team rosters with players Gemini discovered
      // Build a set of all players already registered in OTHER teams (cross-team dedup)
      const allRegistered = new Map<string, string>(); // lowercase name → teamId
      tournament.teams.forEach((team) =>
        (team.players ?? []).forEach((p) => allRegistered.set(p.toLowerCase(), team.id))
      );

      const enrichedTeams = tournament.teams.map((team) => {
        const matchedGroup = data.groups.find((g) => autoAssignments[g.group] === team.id);
        if (!matchedGroup) return team;
        const discovered = matchedGroup.players; // already string[]
        const existing = team.players ?? [];
        const existingLower = new Set(existing.map((p) => p.toLowerCase()));
        const newPlayers = discovered.filter((p) => {
          const k = p.toLowerCase();
          if (existingLower.has(k)) return false; // already on this team
          const owner = allRegistered.get(k);
          return !owner || owner === team.id; // skip if owned by a different team
        });
        if (newPlayers.length === 0) return team;
        return { ...team, players: uniquePlayers([...existing, ...newPlayers]) };
      });

      const updated = { ...tournament, teams: enrichedTeams, geminiData: data, assignments: autoAssignments };
      save(updated);
      computeStandings(updated);
      const autoCount = Object.keys(autoAssignments).length;
      const enriched = enrichedTeams.filter((t, i) => t !== tournament.teams[i]).length;
      toast.success(`${data.groups.length} groups · ${data.matches_detected} matches · ${autoCount} assigned${enriched ? ` · ${enriched} rosters updated` : ""}`);
    } catch (err: unknown) { toast.error((err as Error).message || "Invalid JSON"); }
  };
  const handlePaste = (e: React.ClipboardEvent) => { const text = e.clipboardData.getData("text"); if (text.trim().startsWith("{")) { e.preventDefault(); processJson(text); } };
  const assignTeam = (groupLabel: string, teamId: string) => {
    if (!tournament) return;
    const na = { ...assignments, [groupLabel]: teamId }; setAssignments(na);
    setGroups((prev) => prev.map((g) => g.group === groupLabel ? { ...g, teamId, teamName: tournament.teams.find((t) => t.id === teamId)?.name } : g));
    const updated = { ...tournament, assignments: na }; save(updated); computeStandings(updated);
  };
  const unassignTeam = (groupLabel: string) => {
    if (!tournament) return;
    const na = { ...assignments }; delete na[groupLabel]; setAssignments(na);
    setGroups((prev) => prev.map((g) => g.group === groupLabel ? { ...g, teamId: undefined, teamName: undefined } : g));
    const updated = { ...tournament, assignments: na }; save(updated); computeStandings(updated);
  };
  const getTopKiller = (group: AssignedGroup) => {
    const m = new Map<string, number>();
    group.matches.forEach((match) => Object.entries(match.playerKills).forEach(([n, k]) => m.set(n, (m.get(n) || 0) + k)));
    let tn = "", tk = 0; m.forEach((k, n) => { if (k > tk) { tn = n; tk = k; } }); return { name: tn, kills: tk };
  };
  const toggleExpand = (g: string) => setExpandedGroups((p) => { const n = new Set(p); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const assignedTeamIds = new Set(Object.values(assignments));
  const slotAssignments = tournament?.teams.map((t, i) => ({ ...t, slot: startSlot + i })) || [];


  const captureRef = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, download = false, filename = "image") => {
    const el = ref.current; if (!el) return; setIsCapturing(true);
    try {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.width = "700px"; clone.style.height = "auto"; clone.style.overflow = "visible";
      clone.querySelectorAll(".floating-controls").forEach((e) => e.remove());
      const temp = document.createElement("div"); temp.style.cssText = "position:absolute;left:-9999px;top:0;"; temp.appendChild(clone); document.body.appendChild(temp);
      await new Promise((r) => setTimeout(r, 300));
      const h = clone.scrollHeight || clone.offsetHeight;
      const dataUrl = await toJpeg(clone, { width: 700, height: h, pixelRatio: 3, quality: 0.92, skipFonts: true });
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

  // Hide bottom nav when any sheet/modal is open
  const anyModalOpen = showCreate || showAddScreen || showEdit || showStats || showStandings || showSlots || showPointSystem;
  // Lock body scroll when any modal/overlay is open
  useEffect(() => {
    document.body.dataset.modal = anyModalOpen ? "open" : "";
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => { document.body.dataset.modal = ""; document.body.style.overflow = ""; };
  }, [anyModalOpen]);

  return (
    <div className="min-h-screen pb-36" style={{ background: "#0c0914" }} onPaste={handlePaste}>

      {/* HEADER */}
      <div className="pt-6 pb-6 text-center px-4 anim-slide-up">
        <p className="text-2xl mb-0.5" style={{ fontFamily: "'Dancing Script', cursive", color: "#c4b5fd" }}>Welcome to</p>
        <h1 className="text-4xl font-black text-white tracking-tight">{APP_NAME}</h1>
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
              <QuickBtn icon={<Users className="h-5 w-5" />} label={"Create\nTeam card"} onClick={() => setShowCreate(true)} />
              <QuickBtn icon={<FileDown className="h-5 w-5" />} label={"Import\nTourney"} onClick={() => setShowImportCode(true)} />
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
              onClick={() => syncStatus === 'unauthed' ? (window.location.href = '/login') : handleSync()}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold press-scale disabled:opacity-60 transition-all"
              style={{
                background: syncStatus === 'unauthed' ? "rgba(239,68,68,0.15)" : syncStatus === 'offline' ? "rgba(251,146,60,0.15)" : "rgba(124,58,237,0.15)",
                color: syncStatus === 'unauthed' ? "rgb(248,113,113)" : syncStatus === 'offline' ? "rgb(251,146,60)" : syncStatus === 'synced' ? "rgb(74,222,128)" : "rgba(167,139,250,0.8)",
                border: `1px solid ${ syncStatus === 'unauthed' ? 'rgba(239,68,68,0.3)' : syncStatus === 'offline' ? 'rgba(251,146,60,0.3)' : syncStatus === 'synced' ? 'rgba(74,222,128,0.3)' : 'rgba(124,58,237,0.2)'}`,
              }}
            >
              {syncStatus === 'syncing' || syncStatus === 'pending'
                ? <div className={`h-3 w-3 rounded-full border-2 border-current border-t-transparent ${syncStatus === 'syncing' ? 'animate-spin' : 'animate-spin opacity-50'}`} />
                : <RefreshCw className="h-3 w-3" />}
              {syncStatus === 'syncing' ? "Syncing…" : syncStatus === 'pending' ? "Saving…" : syncStatus === 'offline' ? "Offline" : syncStatus === 'unauthed' ? "Session expired" : syncStatus === 'synced' ? "Synced" : "Sync"}
            </button>
          </div>

          {/* Mine / Shared tabs */}
          {(() => {
            const mineCount   = tournaments.filter(t => !isCollab(t)).length;
            const sharedCount = tournaments.filter(t =>  isCollab(t)).length;
            return (
              <div className="flex gap-1 mb-3 p-0.5 rounded-lg" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.14)", display: "inline-flex" }}>
                {([['mine', 'Mine', mineCount], ['shared', 'Shared', sharedCount]] as const).map(([tab, label, count]) => (
                  <button
                    key={tab}
                    onClick={() => setTournamentTab(tab)}
                    className="flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold transition-all"
                    style={{
                      background: tournamentTab === tab ? "rgba(124,58,237,0.35)" : "transparent",
                      color: tournamentTab === tab ? "#c4b5fd" : "rgba(167,139,250,0.4)",
                    }}
                  >
                    {label}
                    {count > 0 && (
                      <span className="px-1 rounded-full text-[9px] font-black"
                        style={{ background: tournamentTab === tab ? "rgba(124,58,237,0.5)" : "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })()}

          {(() => {
            const visible = tournaments.filter(t => tournamentTab === 'shared' ? isCollab(t) : !isCollab(t));
            if (visible.length === 0) return (
              <div className="text-center py-16">
                <p className="text-sm font-medium" style={{ color: "rgba(167,139,250,0.4)" }}>
                  {tournamentTab === 'shared' ? 'No shared tournaments' : 'No tournaments yet'}
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(167,139,250,0.25)" }}>
                  {tournamentTab === 'shared' ? 'Import a tournament using a 6-char code' : 'Tap + Create to get started'}
                </p>
              </div>
            );
            return null;
          })()}
          {/* Skeleton — shown until local storage is read */}
          {!pageLoaded && (
            <div className="space-y-3">
              {[1,2,3].map(i => (
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


          <div className="space-y-3">
            {tournaments.filter(t => tournamentTab === 'shared' ? isCollab(t) : !isCollab(t)).map((t, i) => {
              const isOpen = expandedCards.has(t.id);
              return (
                <div key={t.id} className="rounded-2xl overflow-hidden relative"
                  style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.18)", transition: "box-shadow 200ms" }}>
                  {/* Header row — div not button to avoid nested button error */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full flex items-center gap-3 p-4 pr-12 text-left press-scale cursor-pointer"
                    onClick={() => toggleCard(t.id)}
                    onKeyDown={(e) => e.key === "Enter" && toggleCard(t.id)}
                  >
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black" style={{ background: "rgba(124,58,237,0.22)", color: "#a78bfa" }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-white truncate">{t.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>Teams: {t.teams.length}</p>
                        {t.updatedAt && (
                          <span className="text-[10px]" style={{ color: "rgba(167,139,250,0.3)" }}>
                            · {new Date(t.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Delete button — outside the header div, no bubbling risk */}
                  {isCollab(t) ? (
                    <button
                      onClick={() => setCollabDeleteId(t.id)}
                      className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors active:scale-90"
                      style={{ color: "rgba(124,58,237,0.5)" }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeleteTournament(t.id)}
                      className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors active:scale-90"
                      style={{ color: "rgba(124,58,237,0.5)" }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  {/* Pill section — smoothly animated via CSS grid rows */}
                  <div style={{
                    display: "grid",
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                    transition: "grid-template-rows 280ms cubic-bezier(0.4,0,0.2,1)",
                  }}>
                    <div style={{ overflow: "hidden" }}>
                      <div className="px-4 pb-4">
                        <div className="h-px mb-3" style={{ background: "rgba(124,58,237,0.12)" }} />
                        <div className="flex flex-wrap gap-1.5">
                          <Pill label="Calculate" onPress={() => openAction(t, "calculate")} active />
                          <Pill label="Tables" onPress={() => openAction(t, "tables")} />
                          <Pill label="Team poster" onPress={() => openAction(t, "poster")} />
                          <Pill label="Slot list" onPress={() => openAction(t, "slots")} />
                          <Pill label="Certificate" onPress={() => openAction(t, "certificate")} />
                          <Pill label="Room Info" icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.859L0 24l6.335-1.518A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.371l-.36-.214-3.722.892.934-3.617-.236-.373A9.818 9.818 0 0112 2.182c5.418 0 9.818 4.4 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818z"/></svg>} onPress={() => openAction(t, "room-info")} />
                          <Pill label="Rules" onPress={() => openAction(t, "rules")} />
                         <Pill label={`Bookings${(t.isActive) ? " 🟢" : ""}`} onPress={() => openAction(t, "bookings")} />
                          <Pill label="Share" icon={<Share2 className="h-3 w-3" />} onPress={() => handleShare(t)} variant="share" />
                          <Pill label="Edit" icon={<Pencil className="h-3 w-3" />} onPress={() => openAction(t, "edit")} variant="edit" />
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
              { label: "Backup & Restore", icon: <Database className="h-4 w-4" />, action: () => { const d = JSON.stringify(tournaments, null, 2); const a = document.createElement("a"); a.download = "scorecalc-backup.json"; a.href = URL.createObjectURL(new Blob([d], { type: "application/json" })); a.click(); setShowMore(false); toast.success("Backup downloaded!"); } },
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
        <button onClick={() => { setShowMore(false); setShowCreate(true); }} className="flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg press-scale" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 24px rgba(124,58,237,0.45)" }}>
          <Plus className="h-4 w-4" /> Create
        </button>
      </div>

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
      {showAddScreen && tournament && (
        <AddTeamsScreen
          tournament={tournament}
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
            setAddForm({ name: "", slot: String((tournament?.teams.length ?? 0) + 1), tags: "", phone: "" });
            setPlayerInputs([""]);
            setAddScreenTab("add");
            setAddScreenMode("edit");
            setInitialTeamCount(tournament?.teams.length ?? 0);
            setAddScreenSnapshot({ teamCount: tournament?.teams.length ?? 0, entryFee: tournament?.entryFee ?? 0, isActive: tournament?.isActive ?? false });
            setShowAddScreen(true);
          }}
          onOpenPointSystem={() => {
            setEditingPoints(tournament.pointSystem ?? DEFAULT_BGMI_POINTS);
            setShowPointSystem(true);
          }}
          onDelete={handleDeleteTournament}
        />
      )}

      {/* STATS / CALCULATE MODAL */}
      {showStats && tournament && (
        <div className="fixed inset-0 z-[55] overflow-y-auto" style={{ background: "#0c0914" }}>
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-white">Calculate — {tournament.name}</h1>
                <p className="text-xs mt-0.5" style={{ color: "rgba(167,139,250,0.5)" }}>{groups.length > 0 ? `${groups.length} groups · ${matchesDetected} matches` : "Follow the guide below to get started"}</p>
              </div>
              <div className="flex items-center gap-2">
                {groups.length > 0 && (
                  <button
                    onClick={() => {
                      if (!tournament) return;
                      const updated = { ...tournament, geminiData: undefined, assignments: {} };
                      save(updated); setGroups([]); setAssignments({}); setMatchesDetected(0); setStandings([]); setSelectedMatch(null);
                      toast.success("Match data cleared");
                    }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "rgba(239,68,68,0.6)" }}
                    title="Reset match data"
                  ><Trash2 className="h-4 w-4" /></button>
                )}
                <button onClick={() => setShowStats(false)} className="p-1.5 rounded-lg" style={{ color: "rgba(167,139,250,0.5)" }}><X className="h-5 w-5" /></button>
              </div>
            </div>
            {groups.length === 0 ? (
              <div className="mt-6 px-1">
                <div
                  className="w-full rounded-2xl p-4"
                  style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(124,58,237,0.2)" }}>
                      <svg width="22" height="22" viewBox="0 0 65 65" fill="none" xmlns="http://www.w3.org/2000/svg"><mask id="maskme" style={{maskType:"alpha"}} maskUnits="userSpaceOnUse" x="0" y="0" width="65" height="65"><path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" fill="#000"/><path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" fill="url(#gg1)"/></mask><g mask="url(#maskme)"><g filter="url(#gf0)"><path d="M-5.859 50.734c7.498 2.663 16.116-2.33 19.249-11.152 3.133-8.821-.406-18.131-7.904-20.794-7.498-2.663-16.116 2.33-19.25 11.151-3.132 8.822.407 18.132 7.905 20.795z" fill="#FFE432"/></g><g filter="url(#gf1)"><path d="M27.433 21.649c10.3 0 18.651-8.535 18.651-19.062 0-10.528-8.35-19.062-18.651-19.062S8.78-7.94 8.78 2.587c0 10.527 8.35 19.062 18.652 19.062z" fill="#FC413D"/></g><g filter="url(#gf2)"><path d="M20.184 82.608c10.753-.525 18.918-12.244 18.237-26.174-.68-13.93-9.95-24.797-20.703-24.271C6.965 32.689-1.2 44.407-.519 58.337c.681 13.93 9.95 24.797 20.703 24.271z" fill="#00B95C"/></g><g filter="url(#gf5)"><path d="M67.391 42.993c10.132 0 18.346-7.91 18.346-17.666 0-9.757-8.214-17.667-18.346-17.667s-18.346 7.91-18.346 17.667c0 9.757 8.214 17.666 18.346 17.666z" fill="#3186FF"/></g><g filter="url(#gf7)"><path d="M34.74 51.43c11.135 7.656 25.896 5.524 32.968-4.764 7.073-10.287 3.779-24.832-7.357-32.488C49.215 6.52 34.455 8.654 27.382 18.94c-7.072 10.288-3.779 24.833 7.357 32.49z" fill="#3186FF"/></g></g><defs><filter id="gf0" x="-19.824" y="13.152" width="39.274" height="43.217" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="2.46" result="effect1_foregroundBlur"/></filter><filter id="gf1" x="-15.001" y="-40.257" width="84.868" height="85.688" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="11.891" result="effect1_foregroundBlur"/></filter><filter id="gf2" x="-20.776" y="11.927" width="79.454" height="90.916" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="10.109" result="effect1_foregroundBlur"/></filter><filter id="gf5" x="29.832" y="-11.552" width="75.117" height="73.758" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="9.606" result="effect1_foregroundBlur"/></filter><filter id="gf7" x="8.107" y="-5.966" width="78.877" height="77.539" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="7.775" result="effect1_foregroundBlur"/></filter><linearGradient id="gg1" x1="18.447" y1="43.42" x2="52.153" y2="15.004" gradientUnits="userSpaceOnUse"><stop stopColor="#4893FC"/><stop offset=".27" stopColor="#4893FC"/><stop offset=".777" stopColor="#969DFF"/><stop offset="1" stopColor="#BD99FE"/></linearGradient></defs></svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">Calculate with AI — free</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(167,139,250,0.55)" }}>
                        How to use Gemini
                      </p>
                    </div>
                  </div>

                  {/* Steps — always visible */}
                  <div className="space-y-3">
                    {[
                      { step: "1", title: "Copy the prompt below", desc: "Tap Copy Prompt, then open Gemini and paste it" },
                      { step: "2", title: "Send & upload screenshots", desc: "Reply with your match result screenshots in the next message" },
                      { step: "3", title: "Copy the JSON reply", desc: "Gemini responds with a JSON block — select and copy it" },
                      { step: "4", title: "Paste it here", desc: "Come back and tap the purple 'Paste' button below" },
                    ].map((s) => (
                      <div key={s.step} className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-black"
                          style={{ background: "rgba(124,58,237,0.3)", color: "#c4b5fd" }}>
                          {s.step}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white">{s.title}</p>
                          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "rgba(167,139,250,0.6)" }}>{s.desc}</p>
                        </div>
                      </div>
                    ))}

                    {/* Actions */}
                    <div className="pt-2 space-y-2">
                      <button
                        onClick={copyPrompt}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white press-scale"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
                        Copy Prompt
                      </button>
                      <button
                        onClick={pasteJson}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold press-scale"
                        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}>
                        <ClipboardPaste className="h-4 w-4" /> Paste JSON from Gemini
                      </button>
                      <p className="text-[10px] text-center pt-0.5" style={{ color: "rgba(167,139,250,0.35)" }}>
                        Prompt copied to clipboard · paste in Gemini
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            ) : (
              <div className="space-y-3">
                {/* Match selector pills */}
                {matchesDetected > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                    <button
                      onClick={() => setSelectedMatch(null)}
                      className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={selectedMatch === null
                        ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff" }
                        : { background: "rgba(124,58,237,0.12)", color: "rgba(167,139,250,0.7)", border: "1px solid rgba(124,58,237,0.2)" }}
                    >All</button>
                    {Array.from({ length: matchesDetected }, (_, i) => i + 1).map((mn) => (
                      <button
                        key={mn}
                        onClick={() => setSelectedMatch(mn)}
                        className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                        style={selectedMatch === mn
                          ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff" }
                          : { background: "rgba(124,58,237,0.12)", color: "rgba(167,139,250,0.7)", border: "1px solid rgba(124,58,237,0.2)" }}
                      >M{mn}</button>
                    ))}
                  </div>
                )}
                {groups.map((group) => {
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
                            <span className="truncate">{isAssigned ? group.teamName : "Assign team..."}</span>
                            <ChevronDown className={`h-3 w-3 shrink-0 ml-2 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                          </button>
                          {isDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl max-h-48 overflow-y-auto">
                              {isAssigned && <button onClick={() => { unassignTeam(group.group); setOpenDropdown(null); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-b border-zinc-700/50">✕ Unassign</button>}
                              {tournament.teams.filter((t) => !assignedTeamIds.has(t.id)).map((t) => (
                                <button key={t.id} onClick={() => { assignTeam(group.group, t.id); setOpenDropdown(null); }} className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-zinc-700 ${t.id === group.teamId ? "text-violet-400 font-semibold" : "text-zinc-300"}`}>{t.name}</button>
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
      )}

      {/* SLOTS MODAL */}
      {showSlots && tournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="floating-controls absolute top-4 right-4 z-30 flex gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-xl"><span className="text-[11px] text-white/60">Start</span><input type="number" value={startSlot} onChange={(e) => setStartSlot(Math.max(1, parseInt(e.target.value) || 1))} className="w-10 bg-transparent text-sm text-white text-center focus:outline-none" min={1} /></div>
            <button onClick={() => captureRef(slotsRef, false, tournament.name || "slots")} disabled={isCapturing} className="text-white hover:text-orange-400 bg-black/60 backdrop-blur-md border border-white/20 p-2.5 rounded-xl transition-all disabled:opacity-50"><Share2 className="h-5 w-5" /></button>
            <button onClick={() => captureRef(slotsRef, true, tournament.name || "slots")} disabled={isCapturing} className="text-white hover:text-blue-400 bg-black/60 backdrop-blur-md border border-white/20 p-2.5 rounded-xl transition-all disabled:opacity-50"><Download className="h-5 w-5" /></button>
            <button onClick={() => setShowSlots(false)} className="text-white hover:text-red-400 bg-black/60 backdrop-blur-md border border-white/20 p-2.5 rounded-xl transition-all"><X className="h-5 w-5" /></button>
          </div>
          <div ref={slotsRef} className="relative w-full min-h-dvh flex items-center justify-center bg-cover bg-center py-14" style={{ backgroundImage: "url(/images/image.webp)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom,rgba(0,0,0,0.5),rgba(0,0,0,0.4),rgba(0,0,0,0.5))" }} />
            <div className="relative z-10 w-full max-w-lg mx-auto px-4">
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-4xl font-bold tracking-wide text-orange-500" style={{ textShadow: "0 0 30px rgba(249,115,22,0.6)" }}>{tournament.name}</h1>
                <p className="text-xs text-white/40 mt-2">Slot Assignments</p>
              </div>
              <div className="rounded-2xl border border-white/[0.15] shadow-2xl overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                <table className="w-full">
                  <thead><tr className="bg-white/[0.06] border-b border-white/10"><th className="px-4 py-2.5 text-center text-sm font-semibold text-white w-16">Slot</th><th className="px-4 py-2.5 text-center text-sm font-semibold text-white">Team</th></tr></thead>
                  <tbody>
                    {slotAssignments.map((s, i) => {
                      const c = i % 3; const tc = c === 0 ? "text-white" : c === 1 ? "text-sky-100" : "text-amber-100"; const bg = c === 0 ? "bg-white/[0.08]" : c === 1 ? "bg-sky-400/[0.10]" : "bg-amber-400/[0.10]";
                      return <tr key={s.id} className={`border-b border-white/5 last:border-b-0 ${bg}`}><td className={`px-4 py-2 text-center text-sm font-bold ${tc}`}>{s.slot}</td><td className={`px-4 py-2 text-center text-sm font-bold ${tc}`}>{s.name}</td></tr>;
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2 bg-white/[0.04] border-t border-white/10 text-center"><span className="text-xs font-semibold text-white/60">Total Teams: {slotAssignments.length}</span></div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-white/40 text-[10px]"><div className="h-px w-8 bg-gradient-to-r from-transparent to-violet-500/50" /><span className="font-medium text-white/50">{APP_NAME}</span><div className="h-px w-8 bg-gradient-to-l from-transparent to-violet-500/50" /></div>
            </div>
          </div>
        </div>
      )}

      {/* STANDINGS MODAL */}
      {showStandings && tournament && (() => {
        const warheadData = [...standings].sort((a, b) => b.totalKills - a.totalKills);
        const killMap = new Map<string, number>();
        tournament.geminiData?.groups.forEach((group) => group.matches.forEach((match) => Object.entries(match.playerKills).forEach(([p, k]) => killMap.set(p, (killMap.get(p) || 0) + k))));
        const topFraggers = [...killMap.entries()].map(([name, kills]) => ({ name, kills })).sort((a, b) => b.kills - a.kills).slice(0, 20);
        const medalStyle = (rank: number) => rank === 1 ? { bg: "linear-gradient(135deg,#facc15,#f59e0b)", color: "#000" } : rank === 2 ? { bg: "linear-gradient(135deg,#e2e8f0,#94a3b8)", color: "#000" } : rank === 3 ? { bg: "linear-gradient(135deg,#f97316,#b45309)", color: "#fff" } : { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" };
        return (
          <div className="fixed inset-0 z-[55] overflow-y-auto">
            <div className="floating-controls absolute top-4 right-4 z-30 flex gap-2">
              <button onClick={() => captureRef(standingsRef, false, `${tournament.name}-${standingsTab}`)} disabled={isCapturing} className="text-white hover:text-orange-400 bg-black/60 backdrop-blur-md border border-white/20 p-2.5 rounded-xl transition-all disabled:opacity-50"><Share2 className="h-5 w-5" /></button>
              <button onClick={() => captureRef(standingsRef, true, `${tournament.name}-${standingsTab}`)} disabled={isCapturing} className="text-white hover:text-blue-400 bg-black/60 backdrop-blur-md border border-white/20 p-2.5 rounded-xl transition-all disabled:opacity-50"><Download className="h-5 w-5" /></button>
              <button onClick={() => setShowStandings(false)} className="text-white hover:text-red-400 bg-black/60 backdrop-blur-md border border-white/20 p-2.5 rounded-xl transition-all"><X className="h-5 w-5" /></button>
            </div>

            <div ref={standingsRef} className="relative w-full min-h-dvh flex items-center justify-center bg-cover bg-center py-20" style={{ backgroundImage: "url(/images/image.webp)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom,rgba(0,0,0,0.6),rgba(0,0,0,0.45),rgba(0,0,0,0.6))" }} />
              <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-6">
                  <h1 className="text-2xl sm:text-4xl font-bold tracking-wide text-orange-500" style={{ textShadow: "0 0 30px rgba(249,115,22,0.6)" }}>{tournament.name}</h1>
                  <div className="mt-2 flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20">
                      <span className="text-xs font-semibold text-white">{standingsTab === "table" ? "🏆 Overall Rankings" : standingsTab === "warhead" ? "💀 Warhead — Team Kills" : "🔫 Top Fraggers"}</span>
                    </div>
                  </div>
                </div>
                {standingsTab === "table" && (() => {
                  const half = Math.ceil(standings.length / 2); const leftCol = standings.slice(0, half); const rightCol = standings.slice(half);
                  const thStyle = (align: string) => ({ padding: "7px 2px", fontSize: "9px", fontWeight: 800 as const, textTransform: "uppercase" as const, letterSpacing: "0.08em", textAlign: align as "center" | "left", color: "rgba(255,255,255,0.7)" });
                  const getBadge = (rank: number) => rank === 1 ? "bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-500 text-black font-black" : rank === 2 ? "bg-gradient-to-r from-gray-400 via-gray-200 to-gray-300 text-black font-black" : rank === 3 ? "bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 text-white font-black" : "bg-zinc-800/80 text-zinc-300 border border-zinc-700/50";
                  const renderTable = (slice: StandingRow[], startIdx: number) => (
                    <div className="overflow-hidden rounded-xl" style={{ backgroundColor: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <table className="w-full border-collapse" style={{ fontSize: "14px" }}>
                        <thead><tr style={{ backgroundColor: "rgba(0,0,0,0.4)", borderBottom: "2px solid rgba(124,58,237,0.4)" }}><th style={{ ...thStyle("center"), padding: "7px 4px" }}>#</th><th style={{ ...thStyle("left"), padding: "7px 4px" }}>Team</th><th style={thStyle("center")}>🍗</th><th style={thStyle("center")}>M</th><th style={thStyle("center")}>P</th><th style={thStyle("center")}>E</th><th style={{ ...thStyle("center"), fontWeight: 900, color: "#a78bfa", padding: "7px 4px" }}>T</th></tr></thead>
                        <tbody>
                          {slice.map((row, idx) => {
                            const rank = startIdx + idx + 1;
                            return (
                              <tr key={row.teamId} style={{ backgroundColor: idx % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                <td style={{ padding: "6px 4px", textAlign: "center", width: "32px" }}><span className={`inline-flex items-center justify-center rounded-md ${getBadge(rank)}`} style={{ width: "24px", height: "24px", fontSize: "12px", lineHeight: 1 }}>{rank}</span></td>
                                <td style={{ padding: "6px 4px", textAlign: "left" }}><span className="text-white" style={{ fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap" }}>{row.teamName}</span></td>
                                <td style={{ padding: "6px 2px", textAlign: "center", fontSize: "13px", fontWeight: 700, fontFamily: "monospace", color: row.chickenDinners > 0 ? "#facc15" : "rgba(255,255,255,0.3)" }}>{row.chickenDinners}</td>
                                <td style={{ padding: "6px 2px", textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: "13px", fontWeight: 700, fontFamily: "monospace" }}>{row.matchCount}</td>
                                <td style={{ padding: "6px 2px", textAlign: "center", color: "white", fontSize: "13px", fontWeight: 700, fontFamily: "monospace" }}>{row.placementPoints}</td>
                                <td style={{ padding: "6px 2px", textAlign: "center", color: "white", fontSize: "13px", fontWeight: 700, fontFamily: "monospace" }}>{row.totalKills}</td>
                                <td style={{ padding: "6px 4px", textAlign: "center" }}><span style={{ color: "#a78bfa", fontSize: "15px", fontWeight: 900, fontFamily: "monospace" }}>{row.totalPoints}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                  if (standings.length === 0) return (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <span style={{ fontSize: "48px" }}>📊</span>
                      <p className="text-white font-bold text-lg">No standings yet</p>
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Use <strong>Calculate</strong> to paste Gemini data first</p>
                    </div>
                  );
                  return <div className="flex gap-3 justify-center"><div className="flex-1">{renderTable(leftCol, 0)}</div>{rightCol.length > 0 && <div className="flex-1">{renderTable(rightCol, half)}</div>}</div>;
                })()}
                {standingsTab === "warhead" && (
                  <div className="max-w-lg mx-auto">
                    <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(0,0,0,0.65)", border: "1px solid rgba(239,68,68,0.3)" }}>
                      <div style={{ background: "linear-gradient(90deg,rgba(239,68,68,0.2),transparent)", padding: "10px 16px", borderBottom: "1px solid rgba(239,68,68,0.2)" }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)" }}><span>Rank · Team</span><span>Kills</span></div></div>
                      {warheadData.map((row, idx) => { const m = medalStyle(idx + 1); return <div key={row.teamId} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: idx % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent" }}><span style={{ background: m.bg, color: m.color, borderRadius: "8px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 900, flexShrink: 0 }}>{idx + 1}</span><span style={{ flex: 1, color: "white", fontSize: "14px", fontWeight: 700 }}>{row.teamName}</span><span style={{ color: idx === 0 ? "#ef4444" : "rgba(255,255,255,0.85)", fontSize: "18px", fontWeight: 900, fontFamily: "monospace" }}>{row.totalKills}</span><span style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>💀</span></div>; })}
                    </div>
                  </div>
                )}
                {standingsTab === "fraggers" && (
                  <div className="max-w-lg mx-auto">
                    <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(0,0,0,0.65)", border: "1px solid rgba(234,179,8,0.3)" }}>
                      <div style={{ background: "linear-gradient(90deg,rgba(234,179,8,0.2),transparent)", padding: "10px 16px", borderBottom: "1px solid rgba(234,179,8,0.2)" }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)" }}><span>Rank · Player</span><span>Kills</span></div></div>
                      {topFraggers.map((p, idx) => { const m = medalStyle(idx + 1); return <div key={p.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: idx % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent" }}><span style={{ background: m.bg, color: m.color, borderRadius: "8px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 900, flexShrink: 0 }}>{idx + 1}</span><span style={{ flex: 1, color: "white", fontSize: "14px", fontWeight: 700 }}>{p.name}</span><span style={{ color: idx === 0 ? "#facc15" : "rgba(255,255,255,0.85)", fontSize: "18px", fontWeight: 900, fontFamily: "monospace" }}>{p.kills}</span><span style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>🔫</span></div>; })}
                    </div>
                  </div>
                )}
                {standingsTab === "table" && <div style={{ textAlign: "center", marginTop: "6px", fontSize: "9px", color: "rgba(255,255,255,0.4)" }}>🍗 Chicken Dinners · M Matches · P Placement Pts · E Eliminations · T Total</div>}
                <div className="mt-6 flex items-center justify-center gap-2 text-white/40 text-[10px]"><div className="h-px w-8 bg-gradient-to-r from-transparent to-violet-500/50" /><span className="font-medium text-white/50">{APP_NAME}</span><div className="h-px w-8 bg-gradient-to-l from-transparent to-violet-500/50" /></div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* SHARE CODE MODAL */}
      {showShareModal && shareInfo && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowShareModal(false)}>
          <div className="w-full max-w-sm rounded-3xl p-6 anim-slide-up" style={{ background: "#13092b", border: "1px solid rgba(124,58,237,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold tracking-widest text-center mb-1" style={{ color: "rgba(167,139,250,0.6)" }}>SHARE TOURNAMENT</p>
            <p className="text-white font-bold text-center mb-5 truncate">{shareInfo.name}</p>

            {/* Big code display */}
            <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)" }}>
              <p className="text-xs mb-2" style={{ color: "rgba(196,181,253,0.5)" }}>Share code</p>
              <p className="text-4xl font-black tracking-[0.25em] text-white" style={{ fontFamily: "monospace" }}>{shareInfo.code}</p>
              <p className="text-[10px] mt-2" style={{ color: "rgba(196,181,253,0.4)" }}>Others can enter this code to import</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(shareInfo.code); toast.success("Code copied!"); }}
                className="flex-1 py-3 rounded-xl font-bold text-sm press-scale"
                style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.3)" }}
              >
                Copy code
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: shareInfo.name, text: `Use code ${shareInfo.code} to import my tournament!`, url: shareInfo.url }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(shareInfo.url);
                    toast.success("Link copied!");
                  }
                }}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white press-scale"
                style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}
              >
                Share link
              </button>
            </div>
            <button onClick={() => setShowShareModal(false)} className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Close</button>
          </div>
        </div>
      )}

      {/* IMPORT BY CODE MODAL */}
      {showImportCode && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowImportCode(false)}>
          <div className="w-full max-w-sm rounded-3xl p-6 anim-slide-up" style={{ background: "#13092b", border: "1px solid rgba(124,58,237,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold tracking-widest text-center mb-1" style={{ color: "rgba(167,139,250,0.6)" }}>IMPORT TOURNAMENT</p>
            <p className="text-sm text-center mb-5" style={{ color: "rgba(196,181,253,0.5)" }}>Enter the 6-character code</p>

            <input
              type="text"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
              autoFocus
              className="w-full text-center text-3xl font-black tracking-[0.3em] py-4 rounded-2xl mb-4 bg-transparent focus:outline-none"
              style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", color: "white", caretColor: "#a78bfa", fontFamily: "monospace" }}
              onKeyDown={(e) => { if (e.key === "Enter" && importCode.length === 6) handleImportByCode(); }}
            />

            <button
              onClick={handleImportByCode}
              disabled={importCode.length !== 6 || importLoading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white press-scale disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}
            >
              {importLoading ? "Importing…" : "Import"}
            </button>
            <button onClick={() => { setShowImportCode(false); setImportCode(""); }} className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* COLLAB LOCAL DELETE CONFIRM */}
      {collabDeleteId && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setCollabDeleteId(null)}>
          <div className="w-full max-w-sm rounded-3xl p-6 anim-slide-up" style={{ background: "#13092b", border: "1px solid rgba(239,68,68,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-2 mb-4">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)" }}>
                <Trash2 className="h-5 w-5" style={{ color: "#f87171" }} />
              </div>
              <p className="text-base font-bold text-white">Remove shared tournament?</p>
            </div>
            <p className="text-sm text-center mb-5" style={{ color: "rgba(196,181,253,0.5)" }}>
              This will only delete it <span className="text-white font-semibold">for you</span>. The original tournament won&apos;t be affected.
            </p>
            <button
              onClick={() => {
                handleDeleteTournament(collabDeleteId);
                setCollabDeleteId(null);
              }}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white press-scale mb-2"
              style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
            >
              Delete for me
            </button>
            <button onClick={() => setCollabDeleteId(null)} className="w-full py-2.5 rounded-xl text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Keep it</button>
          </div>
        </div>
      )}

      {/* ROOM INFO — WhatsApp group invite */}
      {showRoomInfo && tournament && (() => {
        const wasvg = <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.859L0 24l6.335-1.518A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.371l-.36-.214-3.722.892.934-3.617-.236-.373A9.818 9.818 0 0112 2.182c5.418 0 9.818 4.4 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818z"/></svg>;
        const sentIds = new Set(tournament.waGroupSent ?? []);
        const buildMsg = (teamName: string) =>
          waMessage.replace(/\{team\}/g, teamName).replace(/\{link\}/g, waGroupLink.trim() || "—");
        const sendToLeader = (team: typeof tournament.teams[number]) => {
          const clean = (team.phone ?? "").replace(/\D/g, "");
          if (!clean) return;
          // WhatsApp requires full international number (no +). Prepend 91 for 10-digit Indian numbers.
          const waPhone = clean.length === 10 ? `91${clean}` : clean;
          window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(buildMsg(team.name))}`, "_blank", "noopener,noreferrer");
          // Mark as sent
          const newSent = [...new Set([...sentIds, team.id])];
          const updated = { ...tournament, waGroup: waGroupLink.trim(), waMessage, waGroupSent: newSent };
          save(updated as Tournament & { waGroup: string; waMessage: string; waGroupSent: string[] });
          sentIds.add(team.id);
        };
        return (
          <div className="fixed inset-0 z-[90] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setShowRoomInfo(false)}>
            <div className="w-full max-w-sm rounded-3xl anim-slide-up flex flex-col" style={{ background: "#13092b", border: "1px solid rgba(124,58,237,0.3)", maxHeight: "88dvh" }} onClick={(e) => e.stopPropagation()}>
              {/* Fixed top */}
              <div className="px-6 pt-5 pb-4 shrink-0 space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.859L0 24l6.335-1.518A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.371l-.36-.214-3.722.892.934-3.617-.236-.373A9.818 9.818 0 0112 2.182c5.418 0 9.818 4.4 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818z"/></svg>
                  <p className="text-xs font-bold tracking-widest" style={{ color: "rgba(167,139,250,0.6)" }}>WHATSAPP GROUP</p>
                </div>
                {/* Group link */}
                <div>
                  <p className="text-[10px] font-bold mb-1 uppercase" style={{ color: "rgba(167,139,250,0.45)" }}>Group Invite Link</p>
                  <input value={waGroupLink} onChange={(e) => {
                      setWaGroupLink(e.target.value);
                      save({ ...tournament, waGroup: e.target.value.trim(), waMessage } as typeof tournament & { waGroup: string; waMessage: string });
                    }}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", caretColor: "#25d366" }} />
                </div>
                {/* Message template */}
                <div>
                  <p className="text-[10px] font-bold mb-1 uppercase" style={{ color: "rgba(167,139,250,0.45)" }}>Default Message <span style={{ color: "rgba(167,139,250,0.3)" }}>— use &#123;team&#125; and &#123;link&#125;</span></p>
                  <textarea value={waMessage} onChange={(e) => {
                      setWaMessage(e.target.value);
                      save({ ...tournament, waGroup: waGroupLink.trim(), waMessage: e.target.value } as typeof tournament & { waGroup: string; waMessage: string });
                    }} rows={3}
                    className="w-full px-3 py-2 rounded-xl text-sm resize-none focus:outline-none"
                    style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#e9d5ff", caretColor: "#a78bfa" }} />
                </div>
              </div>
              {/* Divider */}
              <div className="mx-6 h-px shrink-0" style={{ background: "rgba(124,58,237,0.12)" }} />
              {/* Leaders list — scrollable */}
              <div className="px-4 pt-3 pb-1 shrink-0">
                <p className="text-[10px] font-bold" style={{ color: "rgba(167,139,250,0.5)" }}>
                  LEADERS — {tournament.teams.filter(t => t.phone).length}/{tournament.teams.length} with number
                </p>
              </div>
              <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
                {tournament.teams.map((team) => {
                  const hasPhone = !!team.phone?.trim();
                  const sent = sentIds.has(team.id);
                  return (
                    <div key={team.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: sent ? "rgba(37,211,102,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${sent ? "rgba(37,211,102,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: sent ? "#4ade80" : "white" }}>{team.name}</p>
                        <p className="text-[11px] truncate" style={{ color: hasPhone ? "rgba(167,139,250,0.5)" : "rgba(167,139,250,0.2)" }}>
                          {hasPhone ? team.phone : "No number"}
                        </p>
                      </div>
                      {hasPhone ? (
                        <button onClick={() => sendToLeader(team)}
                          disabled={!sent && !waGroupLink.trim()}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white press-scale disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ background: sent ? "rgba(37,211,102,0.2)" : "linear-gradient(135deg,#25d366,#128c7e)", border: sent ? "1px solid rgba(37,211,102,0.4)" : "none", color: sent ? "#4ade80" : "white" }}>
                          {sent ? "✓ Sent" : <>{wasvg} Send</>}
                        </button>
                      ) : (
                        <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(167,139,250,0.2)" }}>No #</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-6 pb-5 pt-2 shrink-0">
                <button onClick={() => setShowRoomInfo(false)} className="w-full py-2 text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BOOKINGS MODAL */}
      {showBookings && tournament && (() => {
        // kept as IIFE to satisfy tournament guard
        return <BookingsModal tournament={tournament} save={save} onClose={() => setShowBookings(false)} />;

      })()}

      {/* RULES MODAL */}

      {showRulesModal && tournament && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={() => setShowRulesModal(false)}>
          <div className="w-full max-w-sm rounded-3xl p-6 anim-slide-up" style={{ background: "#13092b", border: "1px solid rgba(124,58,237,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold tracking-widest text-center mb-1" style={{ color: "rgba(167,139,250,0.6)" }}>RULES</p>
            <p className="text-base font-bold text-white text-center mb-4">{tournament.name}</p>
            <p className="text-[10px] mb-1.5" style={{ color: "rgba(167,139,250,0.5)" }}>ONE RULE PER LINE</p>
            <textarea
              autoFocus
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder={"No teaming\nNo emulator\nSquad only\n..."}
              rows={7}
              className="w-full rounded-xl p-3 text-sm resize-none focus:outline-none mb-4"
              style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#e9d5ff", caretColor: "#a78bfa" }}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  const rules = rulesText.split("\n").map((r) => r.trim()).filter(Boolean);
                  const updated = { ...tournament, rules };
                  save(updated);
                  // Share to WhatsApp
                  const msg = `📋 *${tournament.name} — Rules*\n\n${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nGood luck! 🎮`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
                  setShowRulesModal(false);
                }}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white press-scale flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#25d366,#128c7e)" }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.859L0 24l6.335-1.518A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.371l-.36-.214-3.722.892.934-3.617-.236-.373A9.818 9.818 0 0112 2.182c5.418 0 9.818 4.4 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818z"/></svg>
                Save & Share on WhatsApp
              </button>
              <button
                onClick={() => { const rules = rulesText.split("\n").map((r) => r.trim()).filter(Boolean); save({ ...tournament, rules }); setShowRulesModal(false); toast.success("Rules saved"); }}
                className="w-full py-2.5 rounded-xl text-sm font-bold press-scale"
                style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.3)" }}
              >Save only</button>
              <button onClick={() => setShowRulesModal(false)} className="w-full py-2 text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
