"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Team, Tournament } from "@/lib/types";
import {
  loadTournaments, saveTournaments,
  getDeletedTournamentIds, syncPastTeamsFromTournaments,
} from "@/lib/storage";
import type { PastTeam } from "@/lib/storage";
import { authFetch } from "@/lib/authFetch";

/**
 * Merge two team arrays by ID with field-level conflict resolution.
 * @param dropOtherOnly - if true, teams that exist ONLY in `other` are dropped
 *   (used for owned tournaments where local deletions are intentional).
 *   For shared tournaments, pass false to always keep all teams (union merge).
 */
function mergeTeams(base: Team[], other: Team[], dropOtherOnly: boolean): Team[] {
  const baseMap  = new Map(base.map(t => [t.id, t]));
  const otherMap = new Map(other.map(t => [t.id, t]));
  const result: Team[] = [];
  for (const t of base) {
    const o = otherMap.get(t.id);
    if (!o) { result.push(t); continue; }
    result.push({ ...o, ...t, phone: t.phone || o.phone || undefined, players: (t.players?.length ? t.players : o.players) ?? [] });
  }
  if (!dropOtherOnly) {
    for (const [id, t] of otherMap) {
      if (!baseMap.has(id)) result.push(t);
    }
  }
  return result;
}

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'offline' | 'synced' | 'unauthed';

interface SyncResult {
  tournaments: Tournament[];
  setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>;
  tournament: Tournament | null;
  setTournament: React.Dispatch<React.SetStateAction<Tournament | null>>;
  pastTeams: PastTeam[];
  setPastTeams: React.Dispatch<React.SetStateAction<PastTeam[]>>;
  pageLoaded: boolean;
  syncStatus: SyncStatus;
  save: (t: Tournament) => void;
  handleSync: () => void;
  scheduleSyncDebounce: () => void;
}

export function useCloudSync(): SyncResult {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [pastTeams, setPastTeams] = useState<PastTeam[]>([]);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInProgress = useRef(false);

  const doSync = async (showToast = false) => {
    if (!navigator.onLine) { setSyncStatus('offline'); return; }
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setSyncStatus('syncing');
    try {
      const local = loadTournaments();
      const ownedLocal  = local.filter(t => !t.sharedFrom);
      const sharedLocal = local.filter(t =>  t.sharedFrom);

      // Pull + push owned tournaments
      let ownedMerged: Tournament[] = ownedLocal;
      const pullRes = await authFetch("/api/tournaments");
      if (pullRes.status === 401) {
        setSyncStatus('unauthed');
        if (showToast) toast.error("Not logged in — changes saved locally only");
        return;
      }
      if (pullRes.ok) {
        const { tournaments: remote } = await pullRes.json() as { tournaments: Tournament[] };
        const deletedIds = getDeletedTournamentIds();
        const remoteFiltered = remote.filter((t: Tournament) => !deletedIds.has(t.id));
        const remoteMap = new Map(remoteFiltered.map((t: Tournament) => [t.id, t]));
        const localMap  = new Map(ownedLocal.map(t => [t.id, t]));
        const allRemoteIds = new Set(remote.map((t: Tournament) => t.id));
        const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
        ownedMerged = [];
        allIds.forEach(id => {
          const l = localMap.get(id);
          const r = remoteMap.get(id);
          if (!l) { ownedMerged.push(r!); return; }
          if (!r) {
            if (!allRemoteIds.has(id) && !deletedIds.has(id)) ownedMerged.push(l);
            return;
          }
          const localNewer = (l.updatedAt ?? "") >= (r.updatedAt ?? "");
          const base = localNewer ? l : r;
          const other = localNewer ? r : l;
          ownedMerged.push({ ...base, teams: mergeTeams(base.teams ?? [], other.teams ?? [], localNewer) });
        });
        const pushPayload = ownedMerged.filter(t => !deletedIds.has(t.id));
        const allSharedCodes = loadTournaments().filter(t => t.sharedFrom).map(t => t.sharedFrom!).filter((v, i, a) => a.indexOf(v) === i);
        if (pushPayload.length > 0 || allSharedCodes.length > 0) {
          const pushRes = await authFetch("/api/tournaments", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tournaments: pushPayload, sharedCodes: allSharedCodes }),
          });
          if (pushRes.status === 401) { setSyncStatus('unauthed'); return; }
          if (!pushRes.ok) throw new Error("Sync push failed");
        }
      }

      // Pull + push shared tournaments
      const ownedIdSet = new Set(ownedLocal.map(t => t.id));
      const cleanedSharedLocal = sharedLocal.filter(st => !ownedIdSet.has(st.id));
      if (cleanedSharedLocal.length < sharedLocal.length) {
        const without = loadTournaments().filter(t => !(t.sharedFrom && ownedIdSet.has(t.id)));
        saveTournaments(without);
      }

      const sharedMerged: Tournament[] = [];
      for (const st of cleanedSharedLocal) {
        const code = st.sharedFrom!;
        try {
          const sRes = await fetch(`/api/share/${code}`);
          if (!sRes.ok) { sharedMerged.push(st); continue; }
          const { tournament: remote } = await sRes.json() as { tournament: Tournament };
          // Shared = pure mirror of owner's data, no merge
          sharedMerged.push({ ...remote, sharedFrom: code });
        } catch { sharedMerged.push(st); }
      }

      // Combine owned + shared
      const seenIds = new Set<string>();
      const combined: Tournament[] = [];
      for (const t of [...sharedMerged, ...ownedMerged]) {
        if (!seenIds.has(t.id)) { seenIds.add(t.id); combined.push(t); }
      }
      const finalMerged = [...combined.filter(t => !t.sharedFrom), ...combined.filter(t => t.sharedFrom)];

      // Merge with fresh localStorage to preserve mid-sync saves
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
        // Shared = always take synced (owner's) version
        if (f.sharedFrom || s.sharedFrom) { ultimateMerged.push(s); return; }
        const freshNewer = (f.updatedAt ?? "") >= (s.updatedAt ?? "");
        const base  = freshNewer ? f : s;
        const other = freshNewer ? s : f;
        ultimateMerged.push({ ...base, teams: mergeTeams(base.teams ?? [], other.teams ?? [], freshNewer) });
      });
      saveTournaments(ultimateMerged);
      setTournaments(ultimateMerged);
      setTournament(prev => prev ? (ultimateMerged.find(t => t.id === prev.id) ?? prev) : prev);
      setPastTeams(syncPastTeamsFromTournaments(ultimateMerged));
      setSyncStatus('synced');
      if (showToast) toast.success(`Synced ☁️`);
    } catch {
      if (!navigator.onLine) {
        setSyncStatus('offline');
        if (showToast) toast.error("You're offline — will retry when connected");
      } else {
        setSyncStatus('idle');
        if (showToast) toast.error("Sync failed — retrying…");
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => doSync(false), 5000);
      }
    } finally {
      syncInProgress.current = false;
    }
  };

  const scheduleSyncDebounce = useCallback(() => {
    setSyncStatus('pending');
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => doSync(false), 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback((t: Tournament) => {
    const updated = { ...t, updatedAt: new Date().toISOString() };
    const all = loadTournaments();
    const idx = all.findIndex(x => x.id === updated.id);
    const persisted = idx >= 0 ? all.map(x => x.id === updated.id ? updated : x) : [...all, updated];
    saveTournaments(persisted);
    setTournament(updated);
    setTournaments(persisted);
    scheduleSyncDebounce();
  }, [scheduleSyncDebounce]);

  const handleSync = useCallback(() => {
    if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; }
    doSync(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial load — online-first, fallback to local
  useEffect(() => {
    const local = loadTournaments();
    const deletedIds = getDeletedTournamentIds();

    authFetch("/api/tournaments")
      .then(r => r.ok ? r.json() : null)
      .then(async (json) => {
        if (!json?.tournaments) {
          setTournaments(local);
          setPastTeams(syncPastTeamsFromTournaments(local));
          setPageLoaded(true);
          setSyncStatus('offline');
          return;
        }
        const remote: Tournament[] = json.tournaments;
        const serverSharedCodes: string[] = json.sharedCodes ?? [];
        const remoteFiltered = remote.filter((t: Tournament) => !deletedIds.has(t.id));
        const remoteMap = new Map(remoteFiltered.map((t: Tournament) => [t.id, t]));
        const localMap  = new Map(local.map(t => [t.id, t]));
        const allRemoteIds = new Set(remote.map((t: Tournament) => t.id));
        const allIds = new Set([...remoteMap.keys(), ...localMap.keys()]);
        const merged: Tournament[] = [];
        allIds.forEach(id => {
          const r = remoteMap.get(id);
          const l = localMap.get(id);
          if (r && !l) { merged.push(r); return; }
          if (l && !r) {
            if (!allRemoteIds.has(id) && !deletedIds.has(id)) merged.push(l);
            return;
          }
          const rTs = r!.updatedAt ?? r!.createdAt ?? "";
          const lTs = l!.updatedAt ?? l!.createdAt ?? "";
          const serverNewer = rTs >= lTs;
          const base  = serverNewer ? r! : l!;
          const other = serverNewer ? l! : r!;
          // Shared = always take server (owner's) version as-is
          if (r!.sharedFrom || l!.sharedFrom) { merged.push({ ...r!, sharedFrom: l!.sharedFrom || r!.sharedFrom }); return; }
          merged.push({ ...base, teams: mergeTeams(base.teams ?? [], other.teams ?? [], !serverNewer) });
        });

        const localSharedCodes = new Set(local.filter(t => t.sharedFrom).map(t => t.sharedFrom!));
        for (const code of serverSharedCodes) {
          if (localSharedCodes.has(code)) continue;
          try {
            const sRes = await fetch(`/api/share/${code}`);
            if (!sRes.ok) continue;
            const { tournament: t } = await sRes.json();
            if (t && !merged.some(m => m.id === t.id)) {
              merged.push({ ...t, sharedFrom: code, updatedAt: new Date().toISOString() });
            }
          } catch { /* skip */ }
        }

        saveTournaments(merged);
        setTournaments(merged);
        setPastTeams(syncPastTeamsFromTournaments(merged));
        setPageLoaded(true);
        setSyncStatus('synced');
      })
      .catch(() => {
        setTournaments(local);
        setPastTeams(syncPastTeamsFromTournaments(local));
        setPageLoaded(true);
        if (!navigator.onLine) setSyncStatus('offline');
        else setTimeout(() => doSync(false), 5000);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force sync on page close
  useEffect(() => {
    const onBeforeUnload = () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
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
  }, []);

  return {
    tournaments, setTournaments,
    tournament, setTournament,
    pastTeams, setPastTeams,
    pageLoaded, syncStatus,
    save, handleSync, scheduleSyncDebounce,
  };
}
