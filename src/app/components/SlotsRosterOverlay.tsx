"use client";
import { useState, useCallback, useMemo } from "react";
import { X, Copy, Check, Download, Loader2 } from "lucide-react";
import { toJpeg } from "html-to-image";
import { toast } from "sonner";
import { Tournament } from "@/lib/types";
import standingsThemes from "@/lib/standingsThemes";

const APP_NAME = "ScrimCalc";
type Theme = typeof standingsThemes[0];

interface Props {
  tournament: Tournament;
  groupFilter: string;
  theme: Theme;
  onClose: () => void;
}

export default function SlotsRosterOverlay({
  tournament,
  groupFilter,
  theme,
  onClose,
}: Props) {
  const [isSharing, setIsSharing]     = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────

  const teams = useMemo(() =>
    tournament.teams.filter(t => !t.out && (
      !tournament.splitEnabled || groupFilter === "all" || t.group === groupFilter
    )).map((t, i) => ({ ...t, slot: 3 + i }))
  , [tournament, groupFilter]);

  const maxPlayers = useMemo(
    () => Math.min(Math.max(...teams.map(t => (t.players ?? []).length), 0), 6),
    [teams]
  );

  const totalPlayers = useMemo(
    () => teams.reduce((s, t) => s + (t.players ?? []).length, 0),
    [teams]
  );

  // ── Capture (bimon-style off-screen clone at computed width) ────────────

  const captureImage = useCallback(async (): Promise<string | null> => {
    const element = document.getElementById("scrimcalc-roster-content");
    if (!element) return null;

    // Compute full pixel width so ALL 6 player cols never clip
    const slotCol    = 52;
    const teamCol    = 130;
    const playerCols = maxPlayers * 130;
    const padding    = 48;
    const fullWidth  = Math.max(800, slotCol + teamCol + playerCols + padding);

    const pixelRatio = 4; // 4× DPI — crisp on retina

    // Off-screen container (invisible, outside layout)
    const offscreen = document.createElement("div");
    offscreen.style.cssText = `position:fixed;left:0;top:0;width:${fullWidth}px;height:auto;overflow:visible;z-index:-9999;opacity:0;pointer-events:none;`;
    document.body.appendChild(offscreen);

    // Deep clone
    const clone = element.cloneNode(true) as HTMLElement;
    clone.id = "scrimcalc-roster-content-clone";
    clone.style.cssText = `width:${fullWidth}px;min-width:${fullWidth}px;height:auto;min-height:auto;overflow:visible;`;

    // Strip overflow / max-width on descendants, remove controls
    clone.querySelectorAll("*").forEach(el => {
      const h = el as HTMLElement;
      if (h.style) {
        h.style.overflow  = "visible";
        h.style.overflowX = "visible";
        h.style.maxWidth  = "none";
      }
    });
    clone.querySelectorAll(".floating-controls").forEach(el => el.remove());

    offscreen.appendChild(clone);
    void clone.offsetWidth; // force reflow
    const capturedHeight = clone.scrollHeight || clone.offsetHeight;

    try {
      return await toJpeg(clone, {
        pixelRatio,
        quality: 0.97,
        width: fullWidth,
        height: capturedHeight,
        skipFonts: true,          // avoids SecurityError from cross-origin Google Fonts stylesheets
        cacheBust: true,
        style: { width: `${fullWidth}px`, minWidth: `${fullWidth}px`, overflow: "visible" },
      });
    } finally {
      offscreen.remove();
    }
  }, [maxPlayers]);

  // ── Share / Download ─────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    setShareSuccess(false);
    try {
      const dataUrl = await captureImage();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${tournament.name || "slots"}-roster.jpg`, { type: "image/jpeg" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: tournament.name });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
        return;
      }
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ "image/jpeg": blob })]);
        setShareSuccess(true);
        toast.success("Copied to clipboard!");
        setTimeout(() => setShareSuccess(false), 2500);
        return;
      }
      toast.error("Clipboard not supported — use Download instead");
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") toast.error("Share failed");
    } finally {
      setIsSharing(false);
    }
  }, [captureImage, tournament.name]);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const dataUrl = await captureImage();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.download = `${tournament.name || "slots"}-roster.jpg`;
      a.href = dataUrl;
      a.click();
      toast.success("Downloaded!");
    } catch {
      toast.error("Download failed");
    } finally {
      setIsDownloading(false);
    }
  }, [captureImage, tournament.name]);

  // ── Row renderer ─────────────────────────────────────────────────────────

  const renderRow = (team: typeof teams[0], index: number) => {
    const players = (team.players ?? []).map(p => p).slice(0, 6);
    const padded  = [...players, ...Array(maxPlayers - players.length).fill("")];
    const cycle   = index % 3;
    const textColor = cycle === 0 ? "#ffffff" : cycle === 1 ? "#e0f2fe" : "#fef3c7";
    const rowBg     = cycle === 0
      ? (index % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)")
      : cycle === 1 ? "rgba(56,189,248,0.08)" : "rgba(251,191,36,0.07)";
    const shadow = "0 1px 3px rgba(0,0,0,0.8)";

    return (
      <tr key={team.id} style={{ background: rowBg, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {/* Slot */}
        <td style={{ width: "52px", padding: "7px 8px", textAlign: "center", fontSize: "13px", fontWeight: 800, color: textColor, textShadow: shadow, whiteSpace: "nowrap" }}>
          {team.slot}
        </td>
        {/* Team name */}
        <td style={{ padding: "7px 10px 7px 6px", fontSize: "13px", fontWeight: 700, color: textColor, textShadow: shadow, whiteSpace: "nowrap" }}>
          {team.name}
        </td>
        {/* Player columns */}
        {padded.map((p, pi) => (
          <td key={pi} style={{ padding: "7px 6px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: p ? textColor : "rgba(255,255,255,0.25)", textShadow: p ? shadow : "none", whiteSpace: "nowrap" }}>
            {p || "—"}
          </td>
        ))}
      </tr>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto" style={{ background: "rgba(0,0,0,0.85)" }}>

      {/* Floating controls */}
      <div className="floating-controls fixed top-4 right-4 z-[70] flex gap-2">
        <button
          onClick={handleShare}
          disabled={isSharing}
          title="Share / Copy"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border transition-all ${shareSuccess ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-black/70 border-white/20 text-white hover:border-amber-500/50 hover:text-amber-400"}`}
        >
          {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : shareSuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {isSharing ? "…" : shareSuccess ? "Copied!" : "Share"}
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          title="Download JPEG"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border border-white/20 bg-black/70 text-white hover:border-blue-500/50 hover:text-blue-400 transition-all"
        >
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Save
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-xl border border-white/20 bg-black/70 text-white hover:border-red-500/50 hover:text-red-400 transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Capture target ── */}
      <div
        id="scrimcalc-roster-content"
        className="relative w-full min-h-screen flex items-center justify-center py-12 px-4"
        style={{
          // Always set separately — `background` shorthand resets backgroundImage
          backgroundColor: theme.bg.startsWith("#") || theme.bg.startsWith("rgb") ? theme.bg : "#0a0a0a",
          backgroundImage: theme.bgImage ? `url(${theme.bgImage})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Overlay */}
        {theme.overlay !== "none" && (
          <div className="absolute inset-0" style={{ background: theme.overlay }} />
        )}

        <div className="relative z-10 w-full" style={{ maxWidth: `${52 + 130 + maxPlayers * 130 + 48}px`, margin: "0 auto" }}>

          {/* Title */}
          <div className="text-center mb-5">
            <h1 style={{
              fontSize: "clamp(22px, 4vw, 38px)",
              fontWeight: 900,
              color: theme.accentColor,
              textShadow: `0 0 30px ${theme.accentColor}99, 0 0 60px ${theme.accentColor}44, 0 2px 4px rgba(0,0,0,0.7)`,
              letterSpacing: "0.02em",
              lineHeight: 1.1,
            }}>{tournament.name}</h1>
            {tournament.splitEnabled && groupFilter !== "all" && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)" }}>
                <span className="text-xs font-semibold text-white">{groupFilter === "final" ? "🏆 Final" : `Group ${groupFilter}`}</span>
              </div>
            )}
          </div>

          {/* Table */}
          <div style={{ borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden", boxShadow: "0 25px 50px rgba(0,0,0,0.5)", background: "rgba(0,0,0,0.45)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <th style={{ width: "52px", padding: "10px 8px", textAlign: "center", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap" }}>Slot</th>
                  <th style={{ padding: "10px 10px 10px 6px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap" }}>Team</th>
                  {Array.from({ length: maxPlayers }, (_, i) => (
                    <th key={i} style={{ padding: "10px 6px", textAlign: "center", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap" }}>Player {i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((team, i) => renderRow(team, i))}
              </tbody>
            </table>

            {/* Table footer */}
            <div style={{ padding: "8px 16px", background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Total Players: {totalPlayers}</span>
            </div>
          </div>

          {/* Branding footer */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <div style={{ height: "1px", width: "32px", background: `linear-gradient(to right, transparent, ${theme.accentColor}80)` }} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>{APP_NAME}</span>
            <div style={{ height: "1px", width: "32px", background: `linear-gradient(to left, transparent, ${theme.accentColor}80)` }} />
          </div>

        </div>
      </div>
    </div>
  );
}
