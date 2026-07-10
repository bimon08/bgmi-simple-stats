"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Shuffle, Download, Share2, Copy, Hash } from "lucide-react";
import { toJpeg } from "html-to-image";
import { toast } from "sonner";
import { Tournament } from "@/lib/types";
import { loadTournament, saveTournament } from "@/lib/storage";

export default function SlotsPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [startSlot, setStartSlot] = useState(3);
  const [slots, setSlots] = useState<{ teamId: string; teamName: string; slot: number }[]>([]);
  const slotsRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const t = loadTournament();
    setTournament(t);
    if (t) {
      // Load existing slot assignments if any
      const existing = t.teams.filter((tm) => tm.slot).map((tm) => ({ teamId: tm.id, teamName: tm.name, slot: tm.slot! }));
      if (existing.length > 0) {
        setSlots(existing.sort((a, b) => a.slot - b.slot));
      }
    }
  }, []);

  const save = useCallback((t: Tournament) => { setTournament(t); saveTournament(t); }, []);

  const randomize = () => {
    if (!tournament || tournament.teams.length === 0) return;

    // Shuffle teams
    const shuffled = [...tournament.teams].sort(() => Math.random() - 0.5);

    // Assign slots starting from startSlot
    const assigned = shuffled.map((team, i) => ({
      teamId: team.id,
      teamName: team.name,
      slot: startSlot + i,
    }));

    setSlots(assigned.sort((a, b) => a.slot - b.slot));

    // Save slot assignments back to teams
    const updatedTeams = tournament.teams.map((t) => {
      const found = assigned.find((a) => a.teamId === t.id);
      return found ? { ...t, slot: found.slot } : t;
    });
    save({ ...tournament, teams: updatedTeams });
    toast.success("Slots randomized!");
  };

  const copyText = () => {
    if (slots.length === 0) return;
    const lines = [
      `📋 ${tournament?.name || "Tournament"} — Slot List`,
      "━━━━━━━━━━━━━━━━━━",
      ...slots.map((s) => `Slot ${String(s.slot).padStart(2, " ")}  →  ${s.teamName}`),
      "━━━━━━━━━━━━━━━━━━",
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Copied for WhatsApp!");
  };

  const captureAndShare = useCallback(async (download = false) => {
    const element = slotsRef.current;
    if (!element) return;
    setIsCapturing(true);
    try {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.width = "600px";
      clone.style.padding = "32px";
      const temp = document.createElement("div");
      temp.style.cssText = "position:absolute;left:-9999px;top:0;";
      temp.appendChild(clone);
      document.body.appendChild(temp);
      await new Promise((r) => setTimeout(r, 300));
      const dataUrl = await toJpeg(clone, { width: 600, pixelRatio: 2, quality: 0.92 });
      document.body.removeChild(temp);

      if (download) {
        const link = document.createElement("a");
        link.download = `${tournament?.name || "slots"}.jpg`;
        link.href = dataUrl;
        link.click();
        toast.success("Downloaded!");
        return;
      }
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "slots.jpg", { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const link = document.createElement("a");
        link.download = "slots.jpg";
        link.href = dataUrl;
        link.click();
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") toast.error("Failed to capture");
    } finally {
      setIsCapturing(false);
    }
  }, [tournament]);

  if (!tournament) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Slots</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{slots.length > 0 ? `${slots.length} teams assigned` : "Randomize slot assignments"}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Start slot input */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <Hash className="h-3 w-3 text-zinc-500" />
            <span className="text-[11px] text-zinc-400">Start</span>
            <input
              type="number"
              value={startSlot}
              onChange={(e) => setStartSlot(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-10 bg-transparent text-sm text-white text-center focus:outline-none"
              min={1}
            />
          </div>
          <button
            onClick={randomize}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all shadow-lg shadow-amber-500/20"
          >
            <Shuffle className="h-3 w-3" /> Randomize
          </button>
        </div>
      </div>

      {/* Slots */}
      {slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <Shuffle className="h-6 w-6 text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500 font-medium">No slots assigned</p>
          <p className="text-xs text-zinc-600 mt-1">Hit Randomize to assign slots</p>
        </div>
      ) : (
        <>
          {/* Share buttons */}
          <div className="flex gap-2">
            <button onClick={copyText} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all">
              <Copy className="h-3 w-3" /> Text
            </button>
            <button onClick={() => captureAndShare(true)} disabled={isCapturing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-50">
              <Download className="h-3 w-3" /> Image
            </button>
            <button onClick={() => captureAndShare(false)} disabled={isCapturing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-50">
              <Share2 className="h-3 w-3" /> Share
            </button>
          </div>

          {/* Slot list (capturable) */}
          <div
            ref={slotsRef}
            className="rounded-2xl border border-zinc-800/50 overflow-hidden"
            style={{ background: "linear-gradient(180deg, #0c0c0c 0%, #111 50%, #0c0c0c 100%)" }}
          >
            <div className="text-center py-5 px-4">
              <h2 className="text-xl font-black tracking-wide text-amber-500" style={{ textShadow: "0 0 40px rgba(245,158,11,0.3)" }}>
                {tournament.name || "Tournament"}
              </h2>
              <p className="text-[11px] text-zinc-500 mt-1">Slot Assignments</p>
            </div>

            <div className="px-4 pb-4 space-y-1">
              {slots.map((s) => (
                <div
                  key={s.teamId}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-800/30"
                >
                  <span className="text-lg font-black text-amber-400 w-10 text-center">{s.slot}</span>
                  <div className="h-4 w-px bg-zinc-700" />
                  <span className="text-sm font-semibold text-white">{s.teamName}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
