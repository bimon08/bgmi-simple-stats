"use client";
import { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import { Tournament, Team } from "@/lib/types";
import standingsThemes from "@/lib/standingsThemes";
import GroupFilterDropdown from "./GroupFilterDropdown";
import ExportPopover from "./ExportPopover";
import ThemeCarousel from "./ThemeCarousel";

const APP_NAME = "ScoreCalc";
type Theme = typeof standingsThemes[0];

interface Props {
  tournament: Tournament;
  groupFilter: string;
  setGroupFilter: (v: string) => void;
  onClose: () => void;
}

export default function SlotsModal({ tournament, groupFilter, setGroupFilter, onClose }: Props) {
  const [startSlot, setStartSlot] = useState(3);
  const cardRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef(0);

  const slotAssignments = (tournament.teams.filter(t => !t.out && (
    !tournament.splitEnabled || groupFilter === "all" || t.group === groupFilter
  ))).map((t, i) => ({ ...t, slot: startSlot + i }));

  const capture = useCallback(async (download: boolean) => {
    const el = cardRef.current; if (!el) return;
    try {
      const canvas = await html2canvas(el, { useCORS: true, allowTaint: true, scale: window.devicePixelRatio || 2, backgroundColor: null, logging: false, imageTimeout: 5000 });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      if (download) { const a = document.createElement("a"); a.download = `${tournament.name || "slots"}.jpg`; a.href = dataUrl; a.click(); toast.success("Downloaded!"); return; }
      const res = await fetch(dataUrl); const blob = await res.blob();
      const file = new File([blob], `${tournament.name || "slots"}.jpg`, { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ "image/jpeg": blob })]); toast.success("Copied!"); }
      else { const a = document.createElement("a"); a.download = `${tournament.name || "slots"}.jpg`; a.href = dataUrl; a.click(); }
    } catch (err: unknown) { if ((err as Error).name !== "AbortError") toast.error("Failed"); }
  }, [tournament.name]);

  const renderCard = (t: Theme, cardIdx: number) => {
    const total = slotAssignments.length;
    const perCol = Math.ceil(total / 2);
    const cols = [slotAssignments.slice(0, perCol), slotAssignments.slice(perCol)].filter(c => c.length > 0);
    const fs = perCol > 12 ? "7px" : perCol > 9 ? "7.5px" : perCol > 7 ? "8px" : "9px";
    const rankSize = perCol > 12 ? "11px" : perCol > 9 ? "12px" : perCol > 7 ? "14px" : "16px";
    const rankFs = perCol > 12 ? "6px" : perCol > 9 ? "6.5px" : perCol > 7 ? "7px" : "8px";
    const headerPad = perCol > 12 ? "1px 2px" : perCol > 9 ? "2px 3px" : "3px 4px";
    const headerFs = perCol > 12 ? "5px" : perCol > 9 ? "5.5px" : "6px";

    return (
      <div key={t.id} ref={cardIdx === activeIdxRef.current ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: "1/1", scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "20px" }} />}
        <div className="relative z-10 px-3 py-3 h-full flex flex-col">
          <div className="text-center mb-2">
            <h2 className="text-base font-bold tracking-wide" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</h2>
            <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}>
              <span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>📋 Slot Assignments</span>
            </div>
            {tournament.splitEnabled && groupFilter !== "all" && (
              <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}>
                <span className="text-[9px] font-bold" style={{ color: t.badgeText }}>{groupFilter === "final" ? "🏆 Final" : `Group ${groupFilter}`}</span>
              </div>
            )}
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
                    <span className="inline-flex items-center justify-center rounded font-black" style={{ width: rankSize, height: rankSize, fontSize: rankFs, flexShrink: 0, marginRight: "3px", background: t.rankDefault, color: t.rankDefaultText }}>{s.slot}</span>
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
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={onClose} className="text-white/70 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl transition-all"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest text-white/30">SLOTS</span>
          {tournament.splitEnabled && <GroupFilterDropdown value={groupFilter} onChange={setGroupFilter} groupCount={tournament.groupCount ?? 2} showFinal={tournament.teams.some(t => t.group === "final")} />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg">
            <span className="text-[10px] text-white/50">Start</span>
            <input type="number" value={startSlot} onChange={(e) => setStartSlot(Math.max(1, parseInt(e.target.value) || 1))} className="w-8 bg-transparent text-xs text-white text-center focus:outline-none" min={1} />
          </div>
          <ExportPopover onShare={() => capture(false)} onDownload={() => capture(true)} />
        </div>
      </div>
      <ThemeCarousel renderCard={renderCard} />
    </div>
  );
}
