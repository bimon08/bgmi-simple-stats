"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, X, Minus, Download, Share2, Trophy,
  Clipboard, ClipboardPaste, ChevronDown, ChevronUp, Target,
  ChevronLeft, ChevronRight,
  Users, MoreHorizontal, FileDown, Database, Table2, Flame,
  ImageIcon, Pencil, UserPlus, ListX, Pen, Star, HelpCircle,
  Flag, ArrowRight, Save, Search, Tag, BarChart2, Hash,
  ListOrdered, TrendingUp, MoreVertical, Phone, RefreshCw,
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import { Team, Tournament, StandingRow, GeminiOutput, AssignedGroup, PointSystem, DEFAULT_BGMI_POINTS } from "@/lib/types";
import CreateScreen from "./components/CreateScreen";
import BookingsModal from "./components/BookingsModal";
import ShareCodeModal from "./components/ShareCodeModal";
import ImportCodeModal from "./components/ImportCodeModal";
import CollabDeleteConfirm from "./components/CollabDeleteConfirm";
import TeamEditScreen from "./components/TeamEditScreen";
import PointSystemModal from "./components/PointSystemModal";
import EditSheet from "./components/EditSheet";
import AddTeamsScreen from "./components/AddTeamsScreen";
import SYNCED_PLAYERS from "@/data/players.json";

import {
  loadTournaments, saveTournaments, createTournament,
  upsertTournament, deleteTournamentById, mergeTournaments,
  getDeletedTournamentIds, syncPastTeamsFromTournaments, loadPastTeams,
} from "@/lib/storage";
import type { PastTeam } from "@/lib/storage";
import { compareTiebreaker } from "@/lib/points";
import { generatePrompt } from "@/lib/prompt";
import { formatIndianPhone } from "@/lib/phone";
import standingsThemes from "@/lib/standingsThemes";
import { authFetch } from "@/lib/authFetch";

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
function mergeTeams(base: Team[], other: Team[], baseIsLocal: boolean): Team[] {
  const baseMap  = new Map(base.map(t => [t.id, t]));
  const otherMap = new Map(other.map(t => [t.id, t]));
  const result: Team[] = [];
  // Always include all base teams (the "winner" side)
  for (const t of base) {
    const o = otherMap.get(t.id);
    if (!o) { result.push(t); continue; }
    // Both sides have the team — merge fields
    result.push({
      ...o,
      ...t,
      phone: t.phone || o.phone || undefined,
      players: (t.players?.length ? t.players : o.players) ?? [],
    });
  }
  // Only add other-only teams if other is the local side (i.e., base is remote)
  // This prevents remote-only teams from re-appearing after local deletion
  if (!baseIsLocal) {
    for (const [id, t] of otherMap) {
      if (!baseMap.has(id)) result.push(t);
    }
  }
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
  const [pendingCloneDraft, setPendingCloneDraft] = useState<import("@/lib/types").Tournament | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const toggleCard = (id: string) => setExpandedCards((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showAddScreen, setShowAddScreen] = useState(false);
  const [addScreenTab, setAddScreenTab] = useState<"add" | "entered" | "past">("add");
  const [pastTeams, setPastTeams] = useState<PastTeam[]>([]);
  const [addScreenMode, setAddScreenMode] = useState<"create" | "edit">("create");
  const [addForm, setAddForm] = useState({ name: "", tags: "", phone: "" });
  const [playerInputs, setPlayerInputs] = useState<string[]>([""]);  
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamForm, setEditTeamForm] = useState({ name: "", tags: "", players: "", phone: "" });
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
  const syncInProgress = useRef(false);
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
  const [themeIdx, setThemeIdx] = useState(0);
  const themeScrollRef = useRef<HTMLDivElement>(null);
  const [slotThemeIdx, setSlotThemeIdx] = useState(0);
  const slotThemeScrollRef = useRef<HTMLDivElement>(null);

  // Online-first: fetch from server first, fall back to local if offline
  useEffect(() => {
    const local = loadTournaments();
    const deletedIds = getDeletedTournamentIds();

    authFetch("/api/tournaments")
      .then((r) => {
        if (r.status === 401) {
          // Not authenticated — redirect to login
          window.location.href = "/login";
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((json) => {
        if (!json?.tournaments) {
          // Server unavailable — fall back to local
          setTournaments(local);
          setPastTeams(syncPastTeamsFromTournaments(local));
          setPageLoaded(true);
          setSyncStatus('offline');
          return;
        }
        const remote: Tournament[] = json.tournaments;
        const remoteFiltered = remote.filter((t: Tournament) => !deletedIds.has(t.id));
        const remoteMap = new Map(remoteFiltered.map((t: Tournament) => [t.id, t]));
        const localMap  = new Map(local.map((t) => [t.id, t]));
        const allRemoteIds = new Set(remote.map((t: Tournament) => t.id));
        const allIds = new Set([...remoteMap.keys(), ...localMap.keys()]);
        const merged: Tournament[] = [];
        allIds.forEach((id) => {
          const r = remoteMap.get(id);
          const l = localMap.get(id);
          if (r && !l) { merged.push(r); return; }
          if (l && !r) {
            // Local-only: keep only if never synced (brand new, unsaved)
            if (!allRemoteIds.has(id) && !deletedIds.has(id)) {
              merged.push(l);
            }
            return;
          }
          // Both exist — server wins, merge teams
          const rTs = r!.updatedAt ?? r!.createdAt ?? "";
          const lTs = l!.updatedAt ?? l!.createdAt ?? "";
          const serverNewer = rTs >= lTs;
          const base  = serverNewer ? r! : l!;
          const other = serverNewer ? l! : r!;
          merged.push({ ...base, teams: mergeTeams(base.teams ?? [], other.teams ?? [], !serverNewer) });
        });
        saveTournaments(merged);
        setTournaments(merged);
        setPastTeams(syncPastTeamsFromTournaments(merged));
        setPageLoaded(true);
        setSyncStatus('synced');
      })
      .catch(() => {
        // Offline or network error — fall back to local
        setTournaments(local);
        setPastTeams(syncPastTeamsFromTournaments(local));
        setPageLoaded(true);
        if (!navigator.onLine) setSyncStatus('offline');
        else setTimeout(() => doSync(false), 5000);
      });
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
      if (document.visibilityState === 'visible' && navigator.onLine) {
        // If a debounced sync is pending, fire it immediately instead of waiting
        if (syncTimer.current) {
          clearTimeout(syncTimer.current);
          syncTimer.current = null;
        }
        doSync(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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

    // Add 0-stat rows for registered IN teams that didn't appear in any group
    const assignedTeamIds = new Set(Object.values(assignMap));
    t.teams.forEach((team) => {
      if (team.out) return; // skip OUT teams
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
    // Write to localStorage synchronously FIRST so any immediate doSync()
    // call (e.g. from handleSync) reads the correct updated value.
    const all = loadTournaments();
    const idx = all.findIndex(x => x.id === updated.id);
    const persisted = idx >= 0 ? all.map(x => x.id === updated.id ? updated : x) : [...all, updated];
    saveTournaments(persisted);
    setTournament(updated);
    setTournaments(persisted);
    scheduleSyncDebounce();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSync = async (showToast = false) => {
    if (!navigator.onLine) { setSyncStatus('offline'); return; }
    if (syncInProgress.current) return; // prevent concurrent syncs
    syncInProgress.current = true;
    setSyncStatus('syncing');
    try {
      const local = loadTournaments();
      const ownedLocal  = local.filter(t => !t.sharedFrom);
      const sharedLocal = local.filter(t =>  t.sharedFrom);

      // ── Pull + push owned tournaments (requires session) ──────────────────
      let ownedMerged: Tournament[] = ownedLocal;
      const pullRes = await authFetch("/api/tournaments");
      if (pullRes.status === 401) {
        setSyncStatus('unauthed');
        // Still save local data but don't push
        if (showToast) toast.error("Not logged in — changes saved locally only");
        return;
      }
      if (pullRes.ok) {
        const { tournaments: remote } = await pullRes.json() as { tournaments: Tournament[] };
        const deletedIds = getDeletedTournamentIds();
        const remoteFiltered = remote.filter((t: Tournament) => !deletedIds.has(t.id));
        const remoteMap = new Map(remoteFiltered.map((t: Tournament) => [t.id, t]));
        const localMap  = new Map(ownedLocal.map(t => [t.id, t]));
        // Build set of ALL remote IDs (before deletedIds filtering) to detect server-side deletes
        const allRemoteIds = new Set(remote.map((t: Tournament) => t.id));
        const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
        ownedMerged = [];
        allIds.forEach(id => {
          const l = localMap.get(id);
          const r = remoteMap.get(id);
          if (!l) { ownedMerged.push(r!); return; }
          if (!r) {
            // Local-only: keep only if never synced before (brand new tournament).
            if (!allRemoteIds.has(id) && !deletedIds.has(id)) {
              ownedMerged.push(l);
            }
            return;
          }
          const localNewer = (l.updatedAt ?? "") >= (r.updatedAt ?? "");
          const base = localNewer ? l : r;
          const other = localNewer ? r : l;
          ownedMerged.push({
            ...base,
            teams: mergeTeams(base.teams ?? [], other.teams ?? [], localNewer),
          });
        });
        // Always push merged data to server
        const pushPayload = ownedMerged.filter(t => !deletedIds.has(t.id));
        if (pushPayload.length > 0) {
          const pushRes = await authFetch("/api/tournaments", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tournaments: pushPayload }),
          });
          if (pushRes.status === 401) { setSyncStatus('unauthed'); return; }
          if (!pushRes.ok) throw new Error("Sync push failed");
        }
      }

      // ── Pull + push shared tournaments (no auth needed) ──────────────────
      // Build set of owned IDs so we can detect self-imports
      const ownedIdSet = new Set(ownedLocal.map(t => t.id));
      // Filter out any self-imports (user imported their own tournament)
      const cleanedSharedLocal = sharedLocal.filter(st => !ownedIdSet.has(st.id));
      if (cleanedSharedLocal.length < sharedLocal.length) {
        // Silently remove self-imports from localStorage
        const without = loadTournaments().filter(t => !(t.sharedFrom && ownedIdSet.has(t.id)));
        saveTournaments(without);
      }

      const sharedMerged: Tournament[] = [];
      for (const st of cleanedSharedLocal) {
        const code = st.sharedFrom!;
        try {
          // Pull latest from owner's DB
          const sRes = await fetch(`/api/share/${code}`);
          if (!sRes.ok) { sharedMerged.push(st); continue; } // code gone? keep local
          const { tournament: remote } = await sRes.json() as { tournament: Tournament };
          // Merge teams (incoming local wins for its teams, remote fills gaps)
          const merged: Tournament = { ...remote, sharedFrom: code, teams: mergeTeams(st.teams ?? [], remote.teams ?? [], true) };
          // Strip owner-only fields before pushing so they can't bleed back through the share endpoint
          const { isActive: _ia, entryFee: _ef, ...sharePayload } = merged;
          void _ia; void _ef;
          await fetch(`/api/share/${code}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tournament: sharePayload }),
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
        ultimateMerged.push({
          ...base,
          teams: mergeTeams(base.teams ?? [], other.teams ?? [], freshNewer),
        });
      });
      saveTournaments(ultimateMerged);
      setTournaments(ultimateMerged);
      // Also refresh the active tournament if it's currently open,
      // so isActive / other fields don't appear stale in open screens
      setTournament(prev => {
        if (!prev) return prev;
        return ultimateMerged.find(t => t.id === prev.id) ?? prev;
      });

      setPastTeams(syncPastTeamsFromTournaments(ultimateMerged));

      setSyncStatus('synced');
      if (showToast) toast.success(`Synced ☁️`);
    } catch {
      if (!navigator.onLine) {
        setSyncStatus('offline');
        if (showToast) toast.error("You're offline — will retry when connected");
      } else {
        // Online but sync failed (server error / timeout) — auto-retry after 5s
        setSyncStatus('idle');
        if (showToast) toast.error("Sync failed — retrying…");
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => doSync(false), 5000);
      }
    } finally {
      syncInProgress.current = false;
    }
  };

  const scheduleSyncDebounce = () => {
    setSyncStatus('pending');
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => doSync(false), 1000);
  };

  // Force sync on page close so unsaved changes push to server
  useEffect(() => {
    const onBeforeUnload = () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
        // Use sendBeacon for reliable background push
        const local = loadTournaments().filter(t => !t.sharedFrom);
        if (local.length > 0) {
          navigator.sendBeacon(
            "/api/tournaments",
            new Blob([JSON.stringify({ tournaments: local })], { type: "application/json" })
          );
        }
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Handles: "Leader - KW", "Leader Name X", "Leader's Name X", "Captain X",
      //          "Leader Name-777sTOPDAWG" (dash, no space after label)
      const mLeader = line.match(/^(?:[Ll]eader['\u2019s]*|[Cc]aptain)\s+(?:[Nn]ame\s*)?(.+)$/u);
      if (mLeader) {
        // Strip residual "Name[-: ]" not consumed by the optional group
        let raw = stripSep(mLeader[1].trim()).replace(/^[Nn]ame\s*[-\u2013:\uff1a]?\s*/, '');
        // If captured value starts with "phone/phn", fall through to phone handler below
        if (!/^[Pp]h(?:one?|n)/i.test(raw) && !/^[Nn]ame\s*$/.test(raw) && raw !== '') {
          const alts = splitOrAlts(raw);
          captain = alts[0];
          alts.slice(1).forEach(p => { if (!isPhone(p)) players.push(p); });
          labeledHits++; hasStructuredLabel = true; afterPlayerNameLabel = false; continue;
        }
      }

      // ── Phone label ─────────────────────────────────────────────────────────
      // Handles: "Phone number", "Phn -", "Ph -",
      //          "Leader's phone number-9362703176" (dash, no space)
      const mPhone = line.match(
        /^(?:[Ll]eader['\u2019s]*\s+)?[Pp]h(?:one?|n)\s*(?:[Nn]umber)?\s*[-\u2013:\uff1a]?\s*(.+)$/u
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
      // Handles: "Player 2 X", "Player 2. X", "Player 2- X", "Player X",
      //          "Player5- Fs exotic" (no space between keyword and digit)
      const mPlayer = line.match(/^[Pp]layers?\s*(?:\d+\s*[.\-\s]*)?(.+)$/u);
      if (mPlayer) {
        const raw = stripSep(mPlayer[1].trim());
        if (!raw || isPhone(raw)) { afterPlayerNameLabel = true; continue; }
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
  const slotAssignments = tournament?.teams.filter(t => !t.out).map((t, i) => ({ ...t, slot: startSlot + i })) || [];


  const captureRef = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, download = false, filename = "image") => {
    const el = ref.current; if (!el) return; setIsCapturing(true);
    try {
      // True WYSIWYG: html2canvas renders the element exactly as it appears
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        scale: window.devicePixelRatio || 2,
        backgroundColor: null,
        logging: false,
        imageTimeout: 5000,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
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
            if (!pageLoaded) return null; // skeleton handles this phase
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
                    onClick={() => renamingId !== t.id && toggleCard(t.id)}
                    onKeyDown={(e) => e.key === "Enter" && renamingId !== t.id && toggleCard(t.id)}
                  >
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black" style={{ background: "rgba(124,58,237,0.22)", color: "#a78bfa" }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      {renamingId === t.id ? (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && renameValue.trim()) {
                                const renamed = { ...t, name: renameValue.trim() };
                                save(renamed);
                                if (tournament?.id === t.id) setTournament(renamed);
                                setRenamingId(null);
                              }
                              if (e.key === "Escape") { setRenamingId(null); }
                            }}
                            className="flex-1 min-w-0 bg-transparent text-sm font-bold text-white focus:outline-none border-b border-violet-500/50"
                          />
                          <button onClick={() => { if (renameValue.trim()) { const renamed = { ...t, name: renameValue.trim() }; save(renamed); if (tournament?.id === t.id) setTournament(renamed); } setRenamingId(null); }} className="shrink-0 text-emerald-400 text-xs font-bold px-1">✓</button>
                          <button onClick={() => setRenamingId(null)} className="shrink-0 text-zinc-500 text-xs px-1">✕</button>
                        </div>
                      ) : (
                        <p
                          className="text-sm font-bold text-white truncate active:underline"
                          onDoubleClick={e => { e.stopPropagation(); setRenamingId(t.id); setRenameValue(t.name); }}
                        >{t.name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>Teams: {t.teams.filter(tm => !tm.out).length}</p>
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
      {showSlots && tournament && (() => {
        // DEV: Pad slots with dummy teams for testing (UI only, remove later)
        const paddedSlots = [...slotAssignments];
        const SLOT_DUMMY_TARGET = 25;
        const slotDummyNames = ["Alpha","Bravo","Charlie","Delta","Echo","Foxtrot","Golf","Hotel","India","Juliet","Kilo","Lima","Mike","Nova","Oscar","Papa","Quebec","Romeo","Sierra","Tango","Uniform","Victor","Whiskey","Xray","Yankee"];
        if (paddedSlots.length < SLOT_DUMMY_TARGET) {
          for (let i = paddedSlots.length; i < SLOT_DUMMY_TARGET; i++) {
            paddedSlots.push({ id: `dummy-slot-${i}`, name: slotDummyNames[i] || `Team ${i+1}`, slot: startSlot + i, players: [], out: false } as typeof paddedSlots[0]);
          }
        }

        const renderSlotCard = (t: typeof standingsThemes[0], cardIdx: number) => {
          const total = paddedSlots.length;
          const perCol = Math.ceil(total / 2);
          const cols = [paddedSlots.slice(0, perCol), paddedSlots.slice(perCol)].filter(c => c.length > 0);

          // Dynamic sizing
          const rowPad = perCol > 12 ? "1px 2px" : perCol > 9 ? "1px 3px" : perCol > 7 ? "2px 3px" : "3px 4px";
          const fs = perCol > 12 ? "7px" : perCol > 9 ? "7.5px" : perCol > 7 ? "8px" : "9px";
          const rankSize = perCol > 12 ? "11px" : perCol > 9 ? "12px" : perCol > 7 ? "14px" : "16px";
          const rankFs = perCol > 12 ? "6px" : perCol > 9 ? "6.5px" : perCol > 7 ? "7px" : "8px";
          const headerPad = perCol > 12 ? "1px 2px" : perCol > 9 ? "2px 3px" : "3px 4px";
          const headerFs = perCol > 12 ? "5px" : perCol > 9 ? "5.5px" : "6px";

          return (
            <div
              key={t.id}
              ref={cardIdx === slotThemeIdx ? slotsRef : undefined}
              className="shrink-0 relative overflow-hidden"
              style={{
                width: "calc(100vw - 48px)",
                aspectRatio: "1/1",
                scrollSnapAlign: "center",
                borderRadius: "20px",
                background: t.bg,
                ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
              }}
            >
              {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "20px" }} />}
              <div className="relative z-10 px-3 py-3 h-full flex flex-col">
                <div className="text-center mb-2">
                  <h2 className="text-base font-bold tracking-wide" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</h2>
                  <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}>
                    <span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>📋 Slot Assignments</span>
                  </div>
                </div>
                <div className="flex-1" style={{ display: "flex", gap: "6px" }}>
                  {cols.map((col, ci) => (
                    <div key={ci} className="flex-1 overflow-hidden flex flex-col" style={{ borderRadius: "8px", backgroundColor: t.tableBg, border: `1px solid ${t.tableBorder}` }}>
                      <div style={{ backgroundColor: t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, padding: headerPad, display: "flex", alignItems: "center" }}>
                        <span style={{ width: "20px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: t.headerText }}>Slot</span>
                        <span style={{ flex: 1, fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", color: t.headerText }}>Team</span>
                      </div>
                      {col.map((s, idx) => (
                        <div key={s.id} className="flex items-center flex-1" style={{ padding: "0 3px", borderBottom: `1px solid ${t.rowBorder}`, background: idx % 2 === 0 ? t.rowEven : t.rowOdd }}>
                          <span className="inline-flex items-center justify-center rounded font-black" style={{
                            width: rankSize, height: rankSize, fontSize: rankFs, flexShrink: 0, marginRight: "3px",
                            background: t.rankDefault,
                            color: t.rankDefaultText,
                          }}>{s.slot}</span>
                          <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>{s.name.slice(0, 7)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-[9px]"><div className="h-px w-6" style={{ background: `linear-gradient(to right,transparent,${t.footerAccent})` }} /><span className="font-medium" style={{ color: t.footerText }}>{APP_NAME}</span><div className="h-px w-6" style={{ background: `linear-gradient(to left,transparent,${t.footerAccent})` }} /></div>
              </div>
            </div>
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0a0a" }}>
            {/* Top bar */}
            <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
              <button onClick={() => setShowSlots(false)} className="text-white/70 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl transition-all"><X className="h-5 w-5" /></button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-widest text-white/30">SLOTS</span>
                <div className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg"><span className="text-[10px] text-white/50">Start</span><input type="number" value={startSlot} onChange={(e) => setStartSlot(Math.max(1, parseInt(e.target.value) || 1))} className="w-8 bg-transparent text-xs text-white text-center focus:outline-none" min={1} /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => captureRef(slotsRef, false, tournament.name || "slots")} disabled={isCapturing} className="text-white/70 hover:text-orange-400 bg-white/5 border border-white/10 p-2 rounded-xl transition-all disabled:opacity-50"><Share2 className="h-5 w-5" /></button>
                <button onClick={() => captureRef(slotsRef, true, tournament.name || "slots")} disabled={isCapturing} className="text-white/70 hover:text-blue-400 bg-white/5 border border-white/10 p-2 rounded-xl transition-all disabled:opacity-50"><Download className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Card carousel + dots together */}
            <div className="flex-1 flex flex-col justify-center overflow-hidden relative">
              {slotThemeIdx > 0 && <button onClick={() => { const el = slotThemeScrollRef.current; if (el) { const cw = el.firstElementChild?.clientWidth ?? 300; el.scrollBy({ left: -(cw + 16), behavior: "smooth" }); }}} className="absolute left-1 z-20 p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:bg-black/70 transition-all" style={{ top: "45%", transform: "translateY(-50%)" }}><ChevronLeft className="h-5 w-5" /></button>}
              {slotThemeIdx < standingsThemes.length - 1 && <button onClick={() => { const el = slotThemeScrollRef.current; if (el) { const cw = el.firstElementChild?.clientWidth ?? 300; el.scrollBy({ left: cw + 16, behavior: "smooth" }); }}} className="absolute right-1 z-20 p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:bg-black/70 transition-all" style={{ top: "45%", transform: "translateY(-50%)" }}><ChevronRight className="h-5 w-5" /></button>}
              <div className="overflow-hidden">
              <div
                ref={slotThemeScrollRef}
                className="flex gap-4 overflow-x-auto px-6 py-2 no-scrollbar w-full items-center"
                style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingBottom: "20px", marginBottom: "-20px" }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const cardW = el.firstElementChild?.clientWidth ?? 300;
                  const gap = 16;
                  const idx = Math.round(el.scrollLeft / (cardW + gap));
                  const clamped = Math.max(0, Math.min(idx, standingsThemes.length - 1));
                  setSlotThemeIdx(clamped);
                }}
              >
                {standingsThemes.map((t, i) => renderSlotCard(t, i))}
              </div>
              </div>
              {/* Theme name + dots */}
              <div className="pt-2 pb-2 px-4">
                <p className="text-center text-sm font-bold text-white mb-1.5">{standingsThemes[slotThemeIdx].name}</p>
                <div className="flex justify-center gap-1.5 flex-wrap">
                  {standingsThemes.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSlotThemeIdx(i);
                        const el = slotThemeScrollRef.current;
                        if (el) {
                          const cardW = el.firstElementChild?.clientWidth ?? 300;
                          el.scrollTo({ left: i * (cardW + 16), behavior: "smooth" });
                        }
                      }}
                      className="transition-all duration-300"
                      style={{
                        width: slotThemeIdx === i ? "20px" : "6px",
                        height: "6px",
                        borderRadius: "3px",
                        background: slotThemeIdx === i ? t.previewColors[1] : "rgba(255,255,255,0.2)",
                        boxShadow: slotThemeIdx === i ? `0 0 8px ${t.previewColors[1]}60` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STANDINGS MODAL */}
      {showStandings && tournament && (() => {
        const warheadData = [...standings].sort((a, b) => b.totalKills - a.totalKills);
        const killMap = new Map<string, number>();
        tournament.geminiData?.groups.forEach((group) => group.matches.forEach((match) => Object.entries(match.playerKills).forEach(([p, k]) => killMap.set(p, (killMap.get(p) || 0) + k))));
        const topFraggers = [...killMap.entries()].map(([name, kills]) => ({ name, kills })).sort((a, b) => b.kills - a.kills).slice(0, 20);

        // DEV: Pad with dummy teams for preview testing (UI only, remove later)
        const DUMMY_TARGET = 25;
        const dummyNames = ["Alpha","Bravo","Charlie","Delta","Echo","Foxtrot","Golf","Hotel","India","Juliet","Kilo","Lima","Mike","Nova","Oscar","Papa","Quebec","Romeo","Sierra","Tango","Uniform","Victor","Whiskey","Xray","Yankee"];
        const paddedStandings = [...standings];
        if (paddedStandings.length < DUMMY_TARGET) {
          const lastPts = paddedStandings[paddedStandings.length - 1]?.totalPoints ?? 10;
          for (let i = paddedStandings.length; i < DUMMY_TARGET; i++) {
            paddedStandings.push({ teamId: `dummy-${i}`, teamName: dummyNames[i] || `Team ${i+1}`, group: "A", players: [], chickenDinners: Math.random() > 0.7 ? 1 : 0, matchCount: 4, placementPoints: Math.max(1, lastPts - (i - standings.length) * 2), totalKills: Math.floor(Math.random() * 15), totalPoints: Math.max(1, lastPts - (i - standings.length) * 2), lastMatchPosition: i + 1, positions: [] });
          }
        }
        // Use paddedStandings in renderCard instead of standings for testing

        const renderCard = (t: typeof standingsThemes[0], cardIdx: number) => {
          const medalStyle = (rank: number) => rank === 1 ? { bg: t.rank1, color: "#000" } : rank === 2 ? { bg: t.rank2, color: "#000" } : rank === 3 ? { bg: t.rank3, color: "#fff" } : { bg: t.rankDefault, color: t.rankDefaultText };
          const getRankBg = (rank: number) => rank === 1 ? t.rank1 : rank === 2 ? t.rank2 : rank === 3 ? t.rank3 : t.rankDefault;
          const getRankText = (rank: number) => rank === 1 ? "#000" : rank === 2 ? "#000" : rank === 3 ? "#fff" : t.rankDefaultText;
          const badgeLabel = standingsTab === "table" ? "🏆 Overall Rankings" : standingsTab === "warhead" ? "💀 Team Kills" : "🔫 Top Fraggers";

          const renderTitle = () => {
            switch (t.layout) {
              case "banner":
                return (
                  <div className="mb-2">
                    <div style={{ borderLeft: `4px solid ${t.accentColor}`, paddingLeft: "12px" }}>
                      <h2 className="text-lg font-black tracking-wider uppercase" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</h2>
                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: t.accentColor }}>{badgeLabel}</span>
                    </div>
                  </div>
                );
              case "bold":
                return (
                  <div className="text-center mb-2">
                    <h2 className="text-xl font-black tracking-widest uppercase" style={{ color: t.titleColor, textShadow: t.titleShadow, letterSpacing: "0.15em" }}>{tournament.name}</h2>
                    <div className="mt-1 flex items-center justify-center gap-3">
                      <div className="h-0.5 w-8" style={{ background: t.accentColor }} />
                      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: t.accentColor }}>{badgeLabel}</span>
                      <div className="h-0.5 w-8" style={{ background: t.accentColor }} />
                    </div>
                  </div>
                );
              case "minimal":
                return (
                  <div className="mb-2">
                    <h2 className="text-sm font-bold tracking-wider uppercase" style={{ color: t.titleColor, opacity: 0.7 }}>{tournament.name}</h2>
                    <span className="text-[8px] font-medium uppercase tracking-widest" style={{ color: t.legendText }}>{badgeLabel}</span>
                  </div>
                );
              case "accent-bar":
                return (
                  <div className="text-center mb-2">
                    <div className="inline-block px-4 py-1.5 rounded-lg mb-1" style={{ background: t.accentColor }}>
                      <h2 className="text-sm font-black tracking-wide" style={{ color: "#000", textShadow: "none" }}>{tournament.name}</h2>
                    </div>
                    <div><span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>{badgeLabel}</span></div>
                  </div>
                );
              case "compact":
                return (
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</h2>
                      <span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: t.legendText }}>{badgeLabel}</span>
                    </div>
                    <div className="px-2 py-1 rounded-md" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}>
                      <span className="text-[10px] font-black" style={{ color: t.accentColor }}>{standings.length}</span>
                    </div>
                  </div>
                );
              case "split":
                return (
                  <div className="text-center mb-2">
                    <h2 className="text-base font-bold italic tracking-wide" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</h2>
                    <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}>
                      <span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>{badgeLabel}</span>
                    </div>
                  </div>
                );
              default: // "default"
                return (
                  <div className="text-center mb-2">
                    <h2 className="text-base font-bold tracking-wide" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</h2>
                    <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}>
                      <span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>{badgeLabel}</span>
                    </div>
                  </div>
                );
            }
          };

          /* ─── Table always multi-col, dynamic sizing ─── */
          const renderStandingsTable = () => {
            if (paddedStandings.length === 0) return (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <span style={{ fontSize: "36px" }}>📊</span>
                <p style={{ color: t.cellText, fontWeight: 700, fontSize: "14px" }}>No standings yet</p>
              </div>
            );

            const total = paddedStandings.length;
            const numCols = 2;
            const perCol = Math.ceil(total / numCols);
            const cols: typeof paddedStandings[] = [];
            for (let c = 0; c < numCols; c++) {
              const slice = paddedStandings.slice(c * perCol, (c + 1) * perCol);
              if (slice.length > 0) cols.push(slice);
            }

            const isBold = t.layout === "bold";
            const isMinimal = t.layout === "minimal";
            const isAccentBar = t.layout === "accent-bar";

            // Dynamic sizing based on max rows per column
            const rowPad = perCol > 12 ? "1px 2px" : perCol > 9 ? "1px 3px" : perCol > 7 ? "2px 3px" : "3px 4px";
            const fs = perCol > 12 ? "7px" : perCol > 9 ? "7.5px" : perCol > 7 ? "8px" : "9px";
            const scoreFs = perCol > 12 ? "7.5px" : perCol > 9 ? "8px" : perCol > 7 ? "9px" : "10px";
            const rankSize = perCol > 12 ? "11px" : perCol > 9 ? "12px" : perCol > 7 ? "14px" : isBold ? "22px" : "16px";
            const rankFs = perCol > 12 ? "6px" : perCol > 9 ? "6.5px" : perCol > 7 ? "7px" : isBold ? "10px" : "8px";
            const headerPad = perCol > 12 ? "1px 2px" : perCol > 9 ? "2px 3px" : "3px 4px";
            const headerFs = perCol > 12 ? "5px" : perCol > 9 ? "5.5px" : "6px";

            return (
              <div style={{ display: "flex", gap: "6px" }}>
                {cols.map((col, ci) => (
                  <div
                    key={ci}
                    className="flex-1 overflow-hidden"
                    style={{
                      borderRadius: isBold ? "12px" : "8px",
                      backgroundColor: isMinimal ? "transparent" : t.tableBg,
                      border: isMinimal ? "none" : isBold ? `2px solid ${t.accentColor}` : `1px solid ${t.tableBorder}`,
                    }}
                  >
                    <div style={{ backgroundColor: isMinimal ? "transparent" : t.headerBg, borderBottom: isBold ? `2px solid ${t.accentColor}` : `1px solid ${isMinimal ? t.rowBorder + "40" : t.headerBorder}`, padding: headerPad, display: "flex", alignItems: "center" }}>
                        <span style={{ width: "18px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: isMinimal ? t.legendText : t.headerText }}>#</span>
                        <span style={{ flex: 1, fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", color: isMinimal ? t.legendText : t.headerText }}>Team</span>
                        <span style={{ width: "14px", fontSize: headerFs, fontWeight: 800, textAlign: "center", color: isMinimal ? t.legendText : t.headerText }}>🍗</span>
                        <span style={{ width: "16px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: isMinimal ? t.legendText : t.headerText }}>MP</span>
                        <span style={{ width: "16px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: isMinimal ? t.legendText : t.headerText }}>K</span>
                        <span style={{ width: "20px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "right", color: t.accentColor }}>T</span>
                      </div>
                    {col.map((row, idx) => {
                      const rank = ci * perCol + idx + 1;
                      return (
                        <div
                          key={row.teamId}
                          className="flex items-center"
                          style={{
                            padding: rowPad,
                            borderBottom: isMinimal ? `1px solid ${t.rowBorder}20` : `1px solid ${t.rowBorder}`,
                            background: isMinimal ? "transparent" : idx % 2 === 0 ? t.rowEven : t.rowOdd,
                          }}
                        >
                          {isAccentBar && <div style={{ width: "2px", alignSelf: "stretch", background: rank <= 3 ? t.accentColor : "transparent", marginRight: "2px" }} />}
                          {isMinimal ? (
                            <span style={{ width: "16px", textAlign: "center", color: rank <= 3 ? t.accentColor : t.legendText, fontSize: fs, fontWeight: 900, fontFamily: "monospace" }}>{rank}</span>
                          ) : (
                            <span className="inline-flex items-center justify-center rounded font-black" style={{ width: rankSize, height: rankSize, fontSize: rankFs, background: getRankBg(rank), color: getRankText(rank), flexShrink: 0, marginRight: "3px" }}>{rank}</span>
                          )}
                          <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>{row.teamName.slice(0, 7)}</span>
                          <span style={{ width: "14px", textAlign: "center", fontSize: fs, fontWeight: 700, fontFamily: "monospace", color: row.chickenDinners > 0 ? "#facc15" : "rgba(255,255,255,0.2)" }}>{row.chickenDinners}</span>
                          <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontWeight: 600, fontFamily: "monospace", opacity: 0.7 }}>{row.matchCount}</span>
                          <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontWeight: 600, fontFamily: "monospace" }}>{row.totalKills}</span>
                          <span style={{ color: t.accentColor, fontSize: scoreFs, fontWeight: 900, fontFamily: "monospace", width: "20px", textAlign: "right" }}>{row.totalPoints}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          };

          /* ─── Layout-specific List (warhead/fraggers) ─── */
          const renderList = (data: Array<{teamId?: string; teamName?: string; name?: string; totalKills?: number; kills?: number}>, type: "warhead" | "fraggers") => {
            const icon = type === "warhead" ? "💀" : "🔫";
            if (t.layout === "minimal") {
              return <div>{data.map((item, idx) => { const m = medalStyle(idx + 1); const label = type === "warhead" ? item.teamName : item.name; const val = type === "warhead" ? item.totalKills : item.kills; return <div key={label} className="flex items-center" style={{ padding: "5px 8px", borderBottom: `1px solid ${t.rowBorder}20` }}><span style={{ width: "18px", textAlign: "center", color: idx < 3 ? t.accentColor : t.legendText, fontSize: "10px", fontWeight: 900, marginRight: "8px" }}>{idx + 1}</span><span style={{ flex: 1, color: t.cellText, fontSize: "11px", fontWeight: 600 }}>{label}</span><span style={{ color: idx === 0 ? t.accentColor : t.cellText, fontSize: "13px", fontWeight: 900, fontFamily: "monospace" }}>{val}</span></div>; })}</div>;
            }
            return (
              <div className="overflow-hidden rounded-xl" style={{ backgroundColor: t.tableBg, border: `1px solid ${t.tableBorder}` }}>
                <div style={{ background: `linear-gradient(90deg,${t.headerBg},transparent)`, padding: "7px 12px", borderBottom: `1px solid ${t.rowBorder}` }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: t.headerText }}><span>Rank · {type === "warhead" ? "Team" : "Player"}</span><span>Kills</span></div></div>
                {data.map((item, idx) => { const m = medalStyle(idx + 1); const label = type === "warhead" ? item.teamName : item.name; const val = type === "warhead" ? item.totalKills : item.kills; return <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", borderBottom: `1px solid ${t.rowBorder}`, background: idx % 2 === 0 ? t.rowEven : t.rowOdd }}><span style={{ background: m.bg, color: m.color, borderRadius: "6px", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 900, flexShrink: 0 }}>{idx + 1}</span><span style={{ flex: 1, color: t.cellText, fontSize: "12px", fontWeight: 700 }}>{label}</span><span style={{ color: idx === 0 ? t.accentColor : t.cellText, fontSize: "14px", fontWeight: 900, fontFamily: "monospace" }}>{val}</span><span style={{ color: t.legendText, fontSize: "9px" }}>{icon}</span></div>; })}
              </div>
            );
          };

          /* ─── Layout-specific Footer ─── */
          const renderFooter = () => {
            if (t.layout === "banner") return <div className="mt-1 text-right"><span className="text-[8px] font-bold tracking-widest" style={{ color: t.footerText, opacity: 0.5 }}>By {APP_NAME}</span></div>;
            if (t.layout === "minimal") return <div className="mt-2 pt-1" style={{ borderTop: `1px solid ${t.rowBorder}20` }}><span className="text-[8px] font-medium" style={{ color: t.footerText, opacity: 0.4 }}>{APP_NAME}</span></div>;
            return <div className="mt-2 flex items-center justify-center gap-2 text-[9px]"><div className="h-px w-6" style={{ background: `linear-gradient(to right,transparent,${t.footerAccent})` }} /><span className="font-medium" style={{ color: t.footerText }}>{APP_NAME}</span><div className="h-px w-6" style={{ background: `linear-gradient(to left,transparent,${t.footerAccent})` }} /></div>;
          };

          /* ─── Card wrapper (layout affects decorative elements) ─── */
          const borderDecor = t.layout === "accent-bar" ? { borderLeft: `5px solid ${t.accentColor}` } : t.layout === "bold" ? { border: `3px solid ${t.accentColor}30` } : {};

          return (
            <div
              key={t.id}
              ref={cardIdx === themeIdx ? standingsRef : undefined}
              className="shrink-0 relative overflow-hidden"
              style={{
                width: "calc(100vw - 48px)",
                aspectRatio: "1/1",
                scrollSnapAlign: "center",
                borderRadius: t.layout === "bold" ? "24px" : "20px",
                background: t.bg,
                ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
                ...borderDecor,
              }}
            >
              {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "20px" }} />}
              <div className="relative z-10 px-3 py-3 h-full flex flex-col">
                {renderTitle()}
                <div className="flex-1">
                  {standingsTab === "table" && renderStandingsTable()}
                  {standingsTab === "warhead" && renderList(warheadData as Array<{teamId?: string; teamName?: string; totalKills?: number}>, "warhead")}
                  {standingsTab === "fraggers" && renderList(topFraggers as Array<{name?: string; kills?: number}>, "fraggers")}
                </div>
                {standingsTab === "table" && t.layout !== "minimal" && t.layout !== "compact" && <div style={{ textAlign: "center", marginTop: "2px", fontSize: "6px", color: t.legendText }}>🍗 Dinners · M Matches · P Placement · E Eliminations · T Total</div>}
                {renderFooter()}
              </div>
            </div>
          );
        };

        return (
          <div className="fixed inset-0 z-[55] flex flex-col" style={{ background: "#0a0a0a" }}>
            {/* Top bar */}
            <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
              <button onClick={() => setShowStandings(false)} className="text-white/70 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl transition-all"><X className="h-5 w-5" /></button>
              <p className="text-xs font-bold tracking-widest text-white/30">STANDINGS</p>
              <div className="flex gap-2">
                <button onClick={() => captureRef(standingsRef, false, `${tournament.name}-${standingsTab}`)} disabled={isCapturing} className="text-white/70 hover:text-orange-400 bg-white/5 border border-white/10 p-2 rounded-xl transition-all disabled:opacity-50"><Share2 className="h-5 w-5" /></button>
                <button onClick={() => captureRef(standingsRef, true, `${tournament.name}-${standingsTab}`)} disabled={isCapturing} className="text-white/70 hover:text-blue-400 bg-white/5 border border-white/10 p-2 rounded-xl transition-all disabled:opacity-50"><Download className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Card carousel + dots together */}
            <div className="flex-1 flex flex-col justify-center overflow-hidden relative">
              {themeIdx > 0 && <button onClick={() => { const el = themeScrollRef.current; if (el) { const cw = el.firstElementChild?.clientWidth ?? 300; el.scrollBy({ left: -(cw + 16), behavior: "smooth" }); }}} className="absolute left-1 z-20 p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:bg-black/70 transition-all" style={{ top: "45%", transform: "translateY(-50%)" }}><ChevronLeft className="h-5 w-5" /></button>}
              {themeIdx < standingsThemes.length - 1 && <button onClick={() => { const el = themeScrollRef.current; if (el) { const cw = el.firstElementChild?.clientWidth ?? 300; el.scrollBy({ left: cw + 16, behavior: "smooth" }); }}} className="absolute right-1 z-20 p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:bg-black/70 transition-all" style={{ top: "45%", transform: "translateY(-50%)" }}><ChevronRight className="h-5 w-5" /></button>}
              <div className="overflow-hidden">
              <div
                ref={themeScrollRef}
                className="flex gap-4 overflow-x-auto px-6 py-2 no-scrollbar w-full items-center"
                style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingBottom: "20px", marginBottom: "-20px" }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const cardW = el.firstElementChild?.clientWidth ?? 300;
                  const gap = 16;
                  const idx = Math.round(el.scrollLeft / (cardW + gap));
                  const clamped = Math.max(0, Math.min(idx, standingsThemes.length - 1));
                  setThemeIdx(clamped);
                }}
              >
                {standingsThemes.map((t, i) => renderCard(t, i))}
              </div>
              </div>
              {/* Theme name + dots */}
              <div className="pt-2 pb-2 px-4">
                <p className="text-center text-sm font-bold text-white mb-1.5">{standingsThemes[themeIdx].name}</p>
                <div className="flex justify-center gap-1.5 flex-wrap">
                  {standingsThemes.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setThemeIdx(i);
                        const el = themeScrollRef.current;
                        if (el) {
                          const cardW = el.firstElementChild?.clientWidth ?? 300;
                          el.scrollTo({ left: i * (cardW + 16), behavior: "smooth" });
                        }
                      }}
                      className="transition-all duration-300"
                      style={{
                        width: themeIdx === i ? "20px" : "6px",
                        height: "6px",
                        borderRadius: "3px",
                        background: themeIdx === i ? t.previewColors[1] : "rgba(255,255,255,0.2)",
                        boxShadow: themeIdx === i ? `0 0 8px ${t.previewColors[1]}60` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* SHARE CODE MODAL */}
      {showShareModal && shareInfo && (
        <ShareCodeModal shareInfo={shareInfo} onClose={() => setShowShareModal(false)} />
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
                  LEADERS — {tournament.teams.filter(t => !t.out && t.phone).length}/{tournament.teams.filter(t => !t.out).length} with number
                </p>
              </div>
              <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
                {tournament.teams.filter(tm => !tm.out).map((team) => {
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
        return <BookingsModal tournament={tournament} save={save} onClose={() => setShowBookings(false)} onSyncNow={handleSync} />;

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
