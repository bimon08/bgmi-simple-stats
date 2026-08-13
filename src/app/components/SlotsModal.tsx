"use client";
import { useState, useCallback, useRef } from "react";
import { X, Copy, Check, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toJpeg } from "html-to-image";
import { toast } from "sonner";
import { Tournament } from "@/lib/types";
import standingsThemes from "@/lib/standingsThemes";
import GroupFilterDropdown from "./GroupFilterDropdown";

const APP_NAME = "ScrimCalc";
type Theme = typeof standingsThemes[0];

interface Props {
  tournament: Tournament;
  groupFilter: string;
  setGroupFilter: (v: string) => void;
  onClose: () => void;
}

export default function SlotsModal({ tournament, groupFilter, setGroupFilter, onClose }: Props) {
  const [startSlot, setStartSlot]           = useState(3);
  const [showRoster, setShowRoster]         = useState(false);
  const [themeIdx, setThemeIdx]             = useState(0);
  const [sharing, setSharing]               = useState(false);
  const [shareOk, setShareOk]               = useState(false);
  const [downloading, setDownloading]       = useState(false);
  const [menuOpen, setMenuOpen]             = useState(false);
  const [orientation, setOrientation]       = useState<"landscape" | "square">("landscape");

  const theme = standingsThemes[themeIdx];
  const ac    = theme.accentColor;

  // ── Slot data ────────────────────────────────────────────────────────────

  const slotAssignments = tournament.teams
    .filter(t => !t.out && (!tournament.splitEnabled || groupFilter === "all" || t.group === groupFilter))
    .map((t, i) => ({ ...t, slot: startSlot + i }));

  const maxPlayers = Math.min(
    Math.max(...slotAssignments.map(s => (s.players ?? []).length), 0),
    6
  );
  const totalPlayers = slotAssignments.reduce((s, t) => s + (t.players ?? []).length, 0);

  // ── Capture ──────────────────────────────────────────────────────────────

  const captureContent = useCallback(async (): Promise<string | null> => {
    const el = document.getElementById("scrimcalc-slots-content");
    if (!el) return null;

    // 1. Pre-fetch bg image as base64 so it's guaranteed embedded in the JPEG.
    //    html-to-image cannot reliably fetch relative CSS url() paths.
    let bgInline = "none";
    if (theme.bgImage) {
      try {
        const res  = await fetch(theme.bgImage);
        const blob = await res.blob();
        const b64  = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload  = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(blob);
        });
        bgInline = `url(${b64})`;
      } catch { /* fall through — no bg */ }
    }

    // 2. Sizing — landscape (16:9) or square (1:1)
    const teamRows  = slotAssignments.length;
    const rowH      = 38;
    const tableH    = 44 + teamRows * rowH + 44;
    const captureWidth = 1080;
    const captureHeight = orientation === "square"
      ? 1080                                                                    // 1:1
      : Math.max(Math.round(captureWidth * 0.56), 120 + tableH + 80);          // 16:9 landscape

    // 3. Clone + strip Tailwind classes from root (prevents pt-20/min-h-screen conflicts)
    const clone = el.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    clone.className = "";

    // Remove floating controls
    clone.querySelectorAll(".floating-controls").forEach(e => e.remove());

    // Fix: backdrop-filter → solid fallback (html-to-image can't render blur)
    clone.querySelectorAll<HTMLElement>("[style]").forEach(h => {
      if (h.style.backdropFilter) {
        h.style.backdropFilter = "none";
        h.style.backgroundColor = "rgba(0,0,0,0.85)";
      }
    });

    // Remove rounded corners on table card so no "black curved corner" artifact
    clone.querySelectorAll<HTMLElement>(".rounded-2xl, .rounded-xl").forEach(h => {
      h.style.borderRadius = "0";
    });

    // Make table fill full capture width
    clone.querySelectorAll<HTMLElement>(".max-w-4xl, .max-w-3xl").forEach(h => {
      h.style.maxWidth = "none";
      h.style.width = "100%";
    });

    // 4. Set root styles — background with pre-fetched data URL
    clone.style.cssText = `
      width: ${captureWidth}px;
      height: ${captureHeight}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      background-image: ${bgInline};
      background-size: cover;
      background-position: center;
      background-color: #0a0a0a;
      position: relative;
      overflow: hidden;
      padding: 40px 24px 24px;
      box-sizing: border-box;
    `;

    // 5. Offscreen container
    const tmpDiv = document.createElement("div");
    tmpDiv.style.cssText = "position:absolute;left:-9999px;top:0;";
    tmpDiv.appendChild(clone);
    document.body.appendChild(tmpDiv);

    // Small wait for browser to paint the clone
    await new Promise(r => setTimeout(r, 100));

    try {
      return await toJpeg(clone, {
        width: captureWidth,
        height: captureHeight,
        pixelRatio: 4,
        quality: 0.97,
        cacheBust: true,
        skipFonts: true,
      });
    } catch (err) {
      console.error("Capture error:", err);
      return null;
    } finally {
      document.body.removeChild(tmpDiv);
    }
  }, [slotAssignments, theme, orientation]);

  const handleShare = useCallback(async () => {
    setSharing(true); setShareOk(false);
    try {
      const dataUrl = await captureContent(); if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${tournament.name || "slots"}.jpg`, { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: tournament.name || "Slots" });
        setShareOk(true); setTimeout(() => setShareOk(false), 2500); return;
      }
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ "image/jpeg": blob })]);
        setShareOk(true); toast.success("Copied!"); setTimeout(() => setShareOk(false), 2500); return;
      }
      toast.error("Use Download instead");
    } catch (e: unknown) { if ((e as Error).name !== "AbortError") toast.error("Share failed"); }
    finally { setSharing(false); }
  }, [captureContent, tournament.name]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const dataUrl = await captureContent(); if (!dataUrl) return;
      const a = document.createElement("a");
      a.download = `${tournament.name || "slots"}.jpg`; a.href = dataUrl; a.click();
      toast.success("Downloaded!");
    } catch { toast.error("Download failed"); }
    finally { setDownloading(false); }
  }, [captureContent, tournament.name]);

  // ── Theme navigation ──────────────────────────────────────────────────────

  const goTheme = (dir: 1 | -1) => {
    setThemeIdx(i => Math.max(0, Math.min(i + dir, standingsThemes.length - 1)));
  };

  // ── Dynamic sizing based on team count ─────────────────────────────────

  const teamCount = slotAssignments.length;
  // Row sizing — fewer teams = roomier rows
  const rowPy     = teamCount > 14 ? "py-1.5" : teamCount > 10 ? "py-2" : teamCount > 6 ? "py-2.5" : "py-3.5";
  const rowPx     = "px-3";
  const rowFs     = teamCount > 14 ? "text-[11px]" : teamCount > 10 ? "text-xs" : "text-sm";
  const headPy    = teamCount > 14 ? "py-2" : teamCount > 10 ? "py-2.5" : "py-3";
  const titleMb   = teamCount > 12 ? "mb-3" : teamCount > 8 ? "mb-5" : "mb-7";
  const justify   = teamCount < 8 ? "justify-center" : "justify-start";

  // ── Row renderer (bimon-style) ────────────────────────────────────────────

  const renderRows = () => slotAssignments.map((s, rowIdx) => {
    const players = (s.players ?? []).slice(0, 6);
    const padded  = [...players, ...Array(maxPlayers - players.length).fill("")];
    const cycle   = rowIdx % 3;
    const textCls = cycle === 0 ? "text-white" : cycle === 1 ? "text-sky-100" : "text-amber-100";
    const rowBg   = cycle === 0 ? "bg-white/[0.08]" : cycle === 1 ? "bg-sky-400/[0.10]" : "bg-amber-400/[0.10]";
    const shadow  = "0 1px 3px rgba(0,0,0,0.8)";

    return (
      <tr key={s.id} className={`border-b border-white/5 last:border-b-0 ${rowBg} hover:bg-white/15 transition-colors`} style={{ textShadow: shadow }}>
        {/* Slot */}
        <td className={`${rowPx} ${rowPy} text-center ${rowFs} font-bold ${textCls} whitespace-nowrap`}>{s.slot}</td>
        {/* Team — expands to fill available width */}
        <td className={`${rowPx} ${rowPy} ${showRoster ? "text-left" : "text-center"} ${rowFs} font-bold ${textCls} whitespace-nowrap w-full`}>{s.name}</td>
        {/* Player cols — only when roster is on */}
        {showRoster && padded.map((p, pi) => (
          <td key={pi} className={`${rowPx} ${rowPy} text-center ${rowFs} font-semibold whitespace-nowrap ${p ? textCls : "text-zinc-600"}`}>{p || "—"}</td>
        ))}
      </tr>
    );
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "#000" }}>

      {/* ── Floating controls (not captured) ── */}
      <div className="floating-controls fixed top-3 left-0 right-0 z-30 flex items-center justify-between px-3 gap-2">

        {/* Close */}
        <button onClick={onClose} className="p-2 rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white/80 hover:text-white transition-all shrink-0">
          <X className="h-4 w-4" />
        </button>

        {/* Center: group filter only */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          {tournament.splitEnabled && (
            <GroupFilterDropdown value={groupFilter} onChange={setGroupFilter} groupCount={tournament.groupCount ?? 2} showFinal={tournament.teams.some(t => t.group === "final")} accentColor={ac} />
          )}
        </div>

        {/* Right: Share + three-dot */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          {/* Share */}
          <button onClick={handleShare} disabled={sharing}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold border backdrop-blur transition-all ${
              shareOk ? "bg-green-500/20 border-green-500/40 text-green-400" : "bg-black/60 border-white/20 text-white/70 hover:text-white"
            }`}>
            {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : shareOk ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {sharing ? "…" : shareOk ? "Copied" : "Share"}
          </button>

          {/* Three-dot button */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-2 rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white/70 hover:text-white transition-all"
          >
            <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor">
              <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="14" cy="2" r="1.5"/>
            </svg>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <>
              {/* Backdrop to close */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-44 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden">

                {/* Roster toggle */}
                <button
                  onClick={() => { setShowRoster(v => !v); setMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors border-b border-white/10"
                >
                  <span className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Roster
                  </span>
                  {/* Checkmark */}
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    showRoster ? "bg-amber-500 border-amber-500" : "border-white/30"
                  }`}>
                    {showRoster && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                  </span>
                </button>

                {/* Landscape */}
                <button
                  onClick={() => { setOrientation("landscape"); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors border-b border-white/10"
                >
                  <span className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2"/>
                    </svg>
                    Landscape
                  </span>
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    orientation === "landscape" ? "bg-amber-500 border-amber-500" : "border-white/30"
                  }`}>
                    {orientation === "landscape" && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                  </span>
                </button>

                {/* Square */}
                <button
                  onClick={() => { setOrientation("square"); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors border-b border-white/10"
                >
                  <span className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                    </svg>
                    Square
                  </span>
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    orientation === "square" ? "bg-amber-500 border-amber-500" : "border-white/30"
                  }`}>
                    {orientation === "square" && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                  </span>
                </button>

                {/* Start slot */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <span className="text-sm font-semibold text-white/70">Start slot</span>
                  <input
                    type="number"
                    value={startSlot}
                    onChange={e => setStartSlot(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 bg-white/10 border border-white/20 rounded-lg text-xs text-white text-center focus:outline-none focus:border-amber-500/50 py-1"
                    min={1}
                  />
                </div>

                {/* Save / Download */}
                <button
                  onClick={() => { handleDownload(); setMenuOpen(false); }}
                  disabled={downloading}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Save image
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Capture target — background lives HERE so the clone picks it up ── */}
      <div
        id="scrimcalc-slots-content"
        className={`relative min-h-screen flex flex-col items-center ${justify} px-4 pt-20 pb-28`}
        style={{
          backgroundColor: "#0a0a0a",
          backgroundImage: theme.bgImage ? `url(${theme.bgImage})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Overlay — absolute so it's captured with the clone */}
        {theme.overlay !== "none" && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: theme.overlay }} />
        )}
        {/* Title */}
        <div className={`relative text-center ${titleMb} w-full z-10`}>
          <h1 style={{
            fontSize: `clamp(${teamCount > 12 ? "20px" : "26px"}, 5vw, ${teamCount > 12 ? "34px" : "42px"})`,
            fontWeight: 900,
            color: ac,
            textShadow: [
              `0 0 30px ${ac}cc`,
              `0 0 60px ${ac}66`,
              // thick black outline
              `-2px -2px 0 #000`,
              ` 2px -2px 0 #000`,
              `-2px  2px 0 #000`,
              ` 2px  2px 0 #000`,
              `0 4px 12px rgba(0,0,0,0.9)`,
            ].join(", "),
            letterSpacing: "0.02em",
            lineHeight: 1.1,
          }}>
            {tournament.name}
          </h1>
          {tournament.splitEnabled && groupFilter !== "all" && (
            <div className="mt-2 inline-flex items-center px-4 py-1 rounded-full"
              style={{ background: "rgba(0,0,0,0.65)", border: `1.5px solid ${ac}80`, backdropFilter: "blur(8px)" }}>
              <span className="text-xs font-bold whitespace-nowrap" style={{ color: ac }}>
                {groupFilter === "final" ? "🏆 Final" : `Group ${groupFilter}`}
              </span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className={`w-full ${showRoster ? "max-w-4xl" : "max-w-xs"} transition-all`}>
          <div
            className="rounded-2xl border border-white/15 shadow-2xl shadow-black/50 overflow-hidden"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <div className="overflow-x-auto">
              <table
                className="w-full"
                style={{ minWidth: showRoster ? `${50 + 110 + maxPlayers * 130}px` : "260px" }}
              >
                <thead>
                  <tr className="bg-white/[0.06] border-b border-white/10">
                    <th className={`${rowPx} ${headPy} ${showRoster ? "text-center" : "text-center"} ${rowFs} font-semibold text-white whitespace-nowrap`}>Slot</th>
                    <th className={`${rowPx} ${headPy} ${showRoster ? "text-left" : "text-center"} ${rowFs} font-semibold text-white whitespace-nowrap w-full`}>Team</th>
                    {showRoster && Array.from({ length: maxPlayers }, (_, i) => (
                      <th key={i} className={`${rowPx} ${headPy} text-center ${rowFs} font-semibold text-white whitespace-nowrap`}>Player {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>{renderRows()}</tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-3 py-2.5 bg-white/[0.04] border-t border-white/10 text-center">
              <span className="text-xs font-semibold text-white">
                Total Players: {totalPlayers}
              </span>
            </div>
          </div>

          {/* Branding footer */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <div style={{ height: "1px", width: "32px", background: `linear-gradient(to right, transparent, ${ac}70)` }} />
            <span className="text-[11px] font-semibold text-white/50 tracking-widest">{APP_NAME}</span>
            <div style={{ height: "1px", width: "32px", background: `linear-gradient(to left, transparent, ${ac}70)` }} />
          </div>
        </div>
      </div>

      {/* ── Theme picker (fixed at bottom, not captured) ── */}
      <div className="floating-controls fixed bottom-0 left-0 right-0 z-30 pb-safe">
        <div className="bg-black/70 backdrop-blur-xl border-t border-white/10 px-4 pt-2.5 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <button
              onClick={() => goTheme(-1)}
              disabled={themeIdx === 0}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-white">{theme.name}</span>
            <button
              onClick={() => goTheme(1)}
              disabled={themeIdx === standingsThemes.length - 1}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white disabled:opacity-20 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Dots */}
          <div className="flex justify-center gap-1.5 flex-wrap">
            {standingsThemes.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setThemeIdx(i)}
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
}
