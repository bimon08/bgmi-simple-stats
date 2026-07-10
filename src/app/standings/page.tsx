"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Download, Share2, Trophy, BarChart3, Copy, X, Send } from "lucide-react";
import { toJpeg } from "html-to-image";
import { toast } from "sonner";
import { Tournament, StandingRow } from "@/lib/types";
import { loadTournament } from "@/lib/storage";
import { compareTiebreaker } from "@/lib/points";

export default function StandingsPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const standingsRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const t = loadTournament();
    setTournament(t);
    if (t?.geminiData && t.assignments) computeStandings(t);
  }, []);

  const computeStandings = (t: Tournament) => {
    if (!t.geminiData || !t.assignments) return;
    const rows: StandingRow[] = t.geminiData.groups.map((group) => {
      const teamId = t.assignments![group.group];
      const team = t.teams.find((tm) => tm.id === teamId);
      return {
        teamId: teamId || group.group,
        teamName: team?.name || `Group ${group.group}`,
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
    rows.sort(compareTiebreaker);
    setStandings(rows);
  };

  const captureAndShare = useCallback(async (download = false) => {
    const element = standingsRef.current;
    if (!element) return;
    setIsCapturing(true);
    try {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.width = "700px";
      clone.style.height = "auto";
      clone.style.overflow = "visible";
      // Remove floating controls from clone
      clone.querySelectorAll(".floating-controls").forEach((el) => el.remove());

      const temp = document.createElement("div");
      temp.style.cssText = "position:absolute;left:-9999px;top:0;";
      temp.appendChild(clone);
      document.body.appendChild(temp);
      await new Promise((r) => setTimeout(r, 300));

      const capturedHeight = clone.scrollHeight || clone.offsetHeight;
      const dataUrl = await toJpeg(clone, { width: 700, height: capturedHeight, pixelRatio: 3, quality: 0.92 });
      document.body.removeChild(temp);

      if (download) {
        const link = document.createElement("a");
        link.download = `${tournament?.name || "standings"}.jpg`;
        link.href = dataUrl;
        link.click();
        toast.success("Downloaded!");
        return;
      }
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "standings.jpg", { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "image/jpeg": blob })]);
        toast.success("Copied to clipboard!");
      } else {
        const link = document.createElement("a");
        link.download = "standings.jpg";
        link.href = dataUrl;
        link.click();
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") toast.error("Failed to capture");
    } finally {
      setIsCapturing(false);
    }
  }, [tournament]);

  const copyText = () => {
    if (standings.length === 0) return;
    const mc = standings[0]?.matchCount || 0;
    const lines = [
      `🏆 ${tournament?.name || "Tournament"} — After ${mc} Match${mc > 1 ? "es" : ""}`,
      "━━━━━━━━━━━━━━━━━━",
      ...standings.map((row, i) => {
        const m = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        const cd = row.chickenDinners > 0 ? ` (🍗×${row.chickenDinners})` : "";
        return `${m} ${row.teamName} — ${row.totalPoints} pts${cd}`;
      }),
      "━━━━━━━━━━━━━━━━━━",
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Copied for WhatsApp!");
  };

  if (!tournament) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Standings</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {standings.length > 0 ? `${standings.length} teams · ${standings[0]?.matchCount || 0} matches` : "No data yet"}
          </p>
        </div>
        {standings.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all shadow-lg shadow-amber-500/20"
          >
            <Trophy className="h-3 w-3" /> View & Share
          </button>
        )}
      </div>

      {/* Summary cards */}
      {standings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <BarChart3 className="h-6 w-6 text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500 font-medium">No standings yet</p>
          <p className="text-xs text-zinc-600 mt-1">Go to Stats → paste JSON → assign teams</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {standings.map((row, idx) => (
            <div key={row.teamId} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${idx < 3 ? "bg-amber-500/[0.04] border-amber-500/15" : "bg-zinc-900/40 border-zinc-800/40"}`}>
              <span className={`text-sm font-black w-6 text-center ${idx === 0 ? "text-amber-400" : idx === 1 ? "text-zinc-300" : idx === 2 ? "text-orange-400" : "text-zinc-600"}`}>
                {idx + 1}
              </span>
              <span className="text-sm font-semibold text-white flex-1 truncate">{row.teamName}</span>
              <span className="text-xs font-bold text-amber-400">{row.totalPoints} pts</span>
              <span className="text-[11px] text-zinc-500">{row.totalKills}k</span>
              {row.chickenDinners > 0 && <span className="text-[11px] text-amber-400/70">🍗{row.chickenDinners}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Standings Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Floating Controls */}
          <div className="floating-controls absolute top-4 right-4 z-30 flex gap-2">
            <button onClick={copyText} className="text-white hover:text-orange-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-orange-500/50 p-2.5 rounded-xl transition-all">
              <Copy className="h-5 w-5" />
            </button>
            <button onClick={() => captureAndShare(false)} disabled={isCapturing} className="text-white hover:text-orange-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-orange-500/50 p-2.5 rounded-xl transition-all disabled:opacity-50">
              <Send className="h-5 w-5" />
            </button>
            <button onClick={() => captureAndShare(true)} disabled={isCapturing} className="text-white hover:text-blue-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-blue-500/50 p-2.5 rounded-xl transition-all disabled:opacity-50">
              <Download className="h-5 w-5" />
            </button>
            <button onClick={() => setShowModal(false)} className="text-white hover:text-red-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-red-500/50 p-2.5 rounded-xl transition-all">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Capturable content */}
          <div
            ref={standingsRef}
            className="relative w-full min-h-dvh flex items-center justify-center bg-cover bg-center py-14"
            style={{ backgroundImage: "url(/images/image.webp)" }}
          >
            {/* Overlay */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.4), rgba(0,0,0,0.5))" }} />

            <div className="relative z-10 w-full max-w-2xl mx-auto px-4">
              {/* Title */}
              <div className="text-center mb-6">
                <h1
                  className="text-2xl sm:text-4xl font-bold tracking-wide text-orange-500"
                  style={{ textShadow: "0 0 30px rgba(249,115,22,0.6), 0 0 60px rgba(249,115,22,0.3), 0 2px 4px rgba(0,0,0,0.5)" }}
                >
                  {tournament.name || "Tournament"}
                </h1>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20">
                    <Trophy className="h-3.5 w-3.5 text-orange-400" />
                    <span className="text-xs font-medium text-white">Overall Rankings</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div
                className="rounded-2xl border border-white/[0.15] shadow-2xl shadow-black/50 overflow-hidden"
                style={{ backgroundColor: "rgba(15,15,15,0.75)" }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white/[0.06] border-b border-white/10">
                        <th className="px-3 py-2.5 text-center text-[11px] sm:text-sm font-semibold text-white w-10">#</th>
                        <th className="px-3 py-2.5 text-left text-[11px] sm:text-sm font-semibold text-white">Team</th>
                        <th className="px-3 py-2.5 text-center text-[11px] sm:text-sm font-semibold text-white w-10">M</th>
                        <th className="px-3 py-2.5 text-center text-[11px] sm:text-sm font-semibold text-white w-10">PP</th>
                        <th className="px-3 py-2.5 text-center text-[11px] sm:text-sm font-semibold text-white w-10">K</th>
                        <th className="px-3 py-2.5 text-center text-[11px] sm:text-sm font-semibold text-orange-400 w-12">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, index) => {
                        const colorCycle = index % 3;
                        const textColor = colorCycle === 0 ? "text-white" : colorCycle === 1 ? "text-sky-100" : "text-amber-100";
                        const rowBg = colorCycle === 0 ? "bg-white/[0.08]" : colorCycle === 1 ? "bg-sky-400/[0.10]" : "bg-amber-400/[0.10]";
                        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
                        return (
                          <tr
                            key={row.teamId}
                            className={`border-b border-white/5 last:border-b-0 ${rowBg}`}
                            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                          >
                            <td className={`px-3 py-2 text-center text-sm font-bold ${textColor}`}>
                              {medal || index + 1}
                            </td>
                            <td className={`px-3 py-2 text-left text-sm font-bold whitespace-nowrap ${textColor}`}>
                              {row.teamName}
                            </td>
                            <td className={`px-3 py-2 text-center text-sm ${textColor} opacity-60`}>
                              {row.matchCount}
                            </td>
                            <td className={`px-3 py-2 text-center text-sm ${textColor}`}>
                              {row.placementPoints}
                            </td>
                            <td className={`px-3 py-2 text-center text-sm ${textColor}`}>
                              {row.totalKills}
                            </td>
                            <td className="px-3 py-2 text-center text-sm font-bold text-orange-400">
                              {row.totalPoints}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 bg-white/[0.04] border-t border-white/10 text-center">
                  <span className="text-[11px] font-semibold text-white/50">
                    M = Matches · PP = Placement Points · K = Kills · Pts = Total
                  </span>
                </div>
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
