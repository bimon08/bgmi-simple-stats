"use client";
import { useRef, useCallback } from "react";
import { X } from "lucide-react";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import { Tournament, StandingRow } from "@/lib/types";
import standingsThemes from "@/lib/standingsThemes";
import GroupFilterDropdown from "./GroupFilterDropdown";
import ExportPopover from "./ExportPopover";
import ThemeCarousel from "./ThemeCarousel";

const APP_NAME = "ScoreCalc";
type Theme = typeof standingsThemes[0];

interface Props {
  tournament: Tournament;
  standings: StandingRow[];
  standingsTab: "table" | "warhead" | "fraggers";
  groupFilter: string;
  setGroupFilter: (v: string) => void;
  onClose: () => void;
}

export default function StandingsModal({ tournament, standings, standingsTab, groupFilter, setGroupFilter, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef(0);

  // Group-aware filtering
  const filteredStandings = tournament.splitEnabled && groupFilter !== "all"
    ? standings.filter(row => { const team = tournament.teams.find(t => t.id === row.teamId); return team?.group === groupFilter; })
    : standings;

  const warheadData = [...filteredStandings].sort((a, b) => b.totalKills - a.totalKills);

  const filteredTeamIds = tournament.splitEnabled && groupFilter !== "all"
    ? new Set(tournament.teams.filter(t => t.group === groupFilter).map(t => t.id))
    : null;

  const killMap = new Map<string, number>();
  tournament.geminiData?.groups.forEach((group) => {
    if (filteredTeamIds) {
      const assignedTeamId = tournament.assignments?.[group.group];
      if (assignedTeamId && !filteredTeamIds.has(assignedTeamId)) return;
    }
    group.matches.forEach((match) => Object.entries(match.playerKills).forEach(([p, k]) => killMap.set(p, (killMap.get(p) || 0) + k)));
  });
  const topFraggers = [...killMap.entries()].map(([name, kills]) => ({ name, kills })).sort((a, b) => b.kills - a.kills).slice(0, 20);

  // Image capture
  const capture = useCallback(async (download: boolean) => {
    const el = cardRef.current; if (!el) return;
    try {
      const canvas = await html2canvas(el, { useCORS: true, allowTaint: true, scale: window.devicePixelRatio || 2, backgroundColor: null, logging: false, imageTimeout: 5000 });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      if (download) { const a = document.createElement("a"); a.download = `${tournament.name}-${standingsTab}.jpg`; a.href = dataUrl; a.click(); toast.success("Downloaded!"); return; }
      const res = await fetch(dataUrl); const blob = await res.blob();
      const file = new File([blob], `${tournament.name}-${standingsTab}.jpg`, { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ "image/jpeg": blob })]); toast.success("Copied!"); }
      else { const a = document.createElement("a"); a.download = `${tournament.name}-${standingsTab}.jpg`; a.href = dataUrl; a.click(); }
    } catch (err: unknown) { if ((err as Error).name !== "AbortError") toast.error("Failed"); }
  }, [tournament.name, standingsTab]);

  // Helpers
  const groupSuffix = tournament.splitEnabled && groupFilter !== "all" ? ` · ${groupFilter === "final" ? "Final" : `Group ${groupFilter}`}` : "";
  const badgeLabel = (standingsTab === "table" ? "🏆 Overall Rankings" : standingsTab === "warhead" ? "💀 Team Kills" : "🔫 Top Fraggers") + groupSuffix;

  const renderTitle = (t: Theme) => {
    const titleProps = { name: tournament.name, badge: badgeLabel, count: filteredStandings.length };
    switch (t.layout) {
      case "banner": return <div className="mb-2"><div style={{ borderLeft: `4px solid ${t.accentColor}`, paddingLeft: "12px" }}><h2 className="text-lg font-black tracking-wider uppercase" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{titleProps.name}</h2><span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: t.accentColor }}>{titleProps.badge}</span></div></div>;
      case "bold": return <div className="text-center mb-2"><h2 className="text-xl font-black tracking-widest uppercase" style={{ color: t.titleColor, textShadow: t.titleShadow, letterSpacing: "0.15em" }}>{titleProps.name}</h2><div className="mt-1 flex items-center justify-center gap-3"><div className="h-0.5 w-8" style={{ background: t.accentColor }} /><span className="text-[9px] font-black uppercase tracking-widest" style={{ color: t.accentColor }}>{titleProps.badge}</span><div className="h-0.5 w-8" style={{ background: t.accentColor }} /></div></div>;
      case "minimal": return <div className="mb-2"><h2 className="text-sm font-bold tracking-wider uppercase" style={{ color: t.titleColor, opacity: 0.7 }}>{titleProps.name}</h2><span className="text-[8px] font-medium uppercase tracking-widest" style={{ color: t.legendText }}>{titleProps.badge}</span></div>;
      case "accent-bar": return <div className="text-center mb-2"><div className="inline-block px-4 py-1.5 rounded-lg mb-1" style={{ background: t.accentColor }}><h2 className="text-sm font-black tracking-wide" style={{ color: "#000", textShadow: "none" }}>{titleProps.name}</h2></div><div><span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>{titleProps.badge}</span></div></div>;
      case "compact": return <div className="flex items-center justify-between mb-2"><div><h2 className="text-sm font-bold" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{titleProps.name}</h2><span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: t.legendText }}>{titleProps.badge}</span></div><div className="px-2 py-1 rounded-md" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}><span className="text-[10px] font-black" style={{ color: t.accentColor }}>{titleProps.count}</span></div></div>;
      case "split": return <div className="text-center mb-2"><h2 className="text-base font-bold italic tracking-wide" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{titleProps.name}</h2><div className="mt-1 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}><span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>{titleProps.badge}</span></div></div>;
      default: return <div className="text-center mb-2"><h2 className="text-base font-bold tracking-wide" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{titleProps.name}</h2><div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}><span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>{titleProps.badge}</span></div></div>;
    }
  };

  const renderTable = (t: Theme) => {
    if (filteredStandings.length === 0) return <div className="flex flex-col items-center justify-center py-12 gap-2"><span style={{ fontSize: "36px" }}>📊</span><p style={{ color: t.cellText, fontWeight: 700, fontSize: "14px" }}>No standings yet</p></div>;
    const total = filteredStandings.length;
    const perCol = Math.ceil(total / 2);
    const cols: typeof filteredStandings[] = [];
    for (let c = 0; c < 2; c++) { const s = filteredStandings.slice(c * perCol, (c + 1) * perCol); if (s.length > 0) cols.push(s); }
    const isBold = t.layout === "bold", isMinimal = t.layout === "minimal", isAccentBar = t.layout === "accent-bar";
    const fs = perCol > 12 ? "7px" : perCol > 9 ? "7.5px" : perCol > 7 ? "8px" : "9px";
    const scoreFs = perCol > 12 ? "7.5px" : perCol > 9 ? "8px" : perCol > 7 ? "9px" : "10px";
    const rankSize = perCol > 12 ? "11px" : perCol > 9 ? "12px" : perCol > 7 ? "14px" : isBold ? "22px" : "16px";
    const rankFs = perCol > 12 ? "6px" : perCol > 9 ? "6.5px" : perCol > 7 ? "7px" : isBold ? "10px" : "8px";
    const headerPad = perCol > 12 ? "1px 2px" : perCol > 9 ? "2px 3px" : "3px 4px";
    const headerFs = perCol > 12 ? "5px" : perCol > 9 ? "5.5px" : "6px";
    const rowPad = perCol > 12 ? "1px 2px" : perCol > 9 ? "1px 3px" : perCol > 7 ? "2px 3px" : "3px 4px";
    const getRankBg = (r: number) => r === 1 ? t.rank1 : r === 2 ? t.rank2 : r === 3 ? t.rank3 : t.rankDefault;
    const getRankText = (r: number) => r === 1 ? "#000" : r === 2 ? "#000" : r === 3 ? "#fff" : t.rankDefaultText;
    const hTextColor = isMinimal ? t.legendText : t.headerText;
    return (
      <div style={{ display: "flex", gap: "6px" }}>
        {cols.map((col, ci) => (
          <div key={ci} className="flex-1 overflow-hidden" style={{ borderRadius: isBold ? "12px" : "8px", backgroundColor: isMinimal ? "transparent" : t.tableBg, border: isMinimal ? "none" : isBold ? `2px solid ${t.accentColor}` : `1px solid ${t.tableBorder}` }}>
            <div style={{ backgroundColor: isMinimal ? "transparent" : t.headerBg, borderBottom: isBold ? `2px solid ${t.accentColor}` : `1px solid ${isMinimal ? t.rowBorder + "40" : t.headerBorder}`, padding: headerPad, display: "flex", alignItems: "center" }}>
              <span style={{ width: "18px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: hTextColor }}>#</span>
              <span style={{ flex: 1, fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", color: hTextColor }}>Team</span>
              <span style={{ width: "14px", fontSize: headerFs, fontWeight: 800, textAlign: "center", color: hTextColor }}>🍗</span>
              <span style={{ width: "16px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: hTextColor }}>PP</span>
              <span style={{ width: "16px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: hTextColor }}>MP</span>
              <span style={{ width: "16px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: hTextColor }}>K</span>
              <span style={{ width: "20px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", textAlign: "right", color: t.accentColor }}>T</span>
            </div>
            {col.map((row, idx) => {
              const rank = ci * perCol + idx + 1;
              return (
                <div key={row.teamId} className="flex items-center" style={{ padding: rowPad, borderBottom: isMinimal ? `1px solid ${t.rowBorder}20` : `1px solid ${t.rowBorder}`, background: isMinimal ? "transparent" : idx % 2 === 0 ? t.rowEven : t.rowOdd }}>
                  {isAccentBar && <div style={{ width: "2px", alignSelf: "stretch", background: rank <= 3 ? t.accentColor : "transparent", marginRight: "2px" }} />}
                  {isMinimal ? (
                    <span style={{ width: "16px", textAlign: "center", color: rank <= 3 ? t.accentColor : t.legendText, fontSize: fs, fontWeight: 900, fontFamily: "monospace" }}>{rank}</span>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded font-black" style={{ width: rankSize, height: rankSize, fontSize: rankFs, background: getRankBg(rank), color: getRankText(rank), flexShrink: 0, marginRight: "3px" }}>{rank}</span>
                  )}
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>{row.teamName.slice(0, 7)}</span>
                  <span style={{ width: "14px", textAlign: "center", fontSize: fs, fontWeight: 700, fontFamily: "monospace", color: row.chickenDinners > 0 ? "#facc15" : "rgba(255,255,255,0.2)" }}>{row.chickenDinners}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontWeight: 600, fontFamily: "monospace" }}>{row.placementPoints}</span>
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

  const renderList = (t: Theme, data: Array<{ teamName?: string; name?: string; totalKills?: number; kills?: number }>, type: "warhead" | "fraggers") => {
    const medalStyle = (r: number) => r === 1 ? { bg: t.rank1, color: "#000" } : r === 2 ? { bg: t.rank2, color: "#000" } : r === 3 ? { bg: t.rank3, color: "#fff" } : { bg: t.rankDefault, color: t.rankDefaultText };
    const icon = type === "warhead" ? "💀" : "🔫";
    if (t.layout === "minimal") {
      return <div>{data.map((item, idx) => { const label = type === "warhead" ? item.teamName : item.name; const val = type === "warhead" ? item.totalKills : item.kills; return <div key={label} className="flex items-center" style={{ padding: "5px 8px", borderBottom: `1px solid ${t.rowBorder}20` }}><span style={{ width: "18px", textAlign: "center", color: idx < 3 ? t.accentColor : t.legendText, fontSize: "10px", fontWeight: 900, marginRight: "8px" }}>{idx + 1}</span><span style={{ flex: 1, color: t.cellText, fontSize: "11px", fontWeight: 600 }}>{label}</span><span style={{ color: idx === 0 ? t.accentColor : t.cellText, fontSize: "13px", fontWeight: 900, fontFamily: "monospace" }}>{val}</span></div>; })}</div>;
    }
    return (
      <div className="overflow-hidden rounded-xl" style={{ backgroundColor: t.tableBg, border: `1px solid ${t.tableBorder}` }}>
        <div style={{ background: `linear-gradient(90deg,${t.headerBg},transparent)`, padding: "7px 12px", borderBottom: `1px solid ${t.rowBorder}` }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: t.headerText }}><span>Rank · {type === "warhead" ? "Team" : "Player"}</span><span>Kills</span></div></div>
        {data.map((item, idx) => { const m = medalStyle(idx + 1); const label = type === "warhead" ? item.teamName : item.name; const val = type === "warhead" ? item.totalKills : item.kills; return <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", borderBottom: `1px solid ${t.rowBorder}`, background: idx % 2 === 0 ? t.rowEven : t.rowOdd }}><span style={{ background: m.bg, color: m.color, borderRadius: "6px", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 900, flexShrink: 0 }}>{idx + 1}</span><span style={{ flex: 1, color: t.cellText, fontSize: "12px", fontWeight: 700 }}>{label}</span><span style={{ color: idx === 0 ? t.accentColor : t.cellText, fontSize: "14px", fontWeight: 900, fontFamily: "monospace" }}>{val}</span><span style={{ color: t.legendText, fontSize: "9px" }}>{icon}</span></div>; })}
      </div>
    );
  };

  const renderFooter = (t: Theme) => {
    if (t.layout === "banner") return <div className="mt-1 text-right"><span className="text-[8px] font-bold tracking-widest" style={{ color: t.footerText, opacity: 0.5 }}>By {APP_NAME}</span></div>;
    if (t.layout === "minimal") return <div className="mt-2 pt-1" style={{ borderTop: `1px solid ${t.rowBorder}20` }}><span className="text-[8px] font-medium" style={{ color: t.footerText, opacity: 0.4 }}>{APP_NAME}</span></div>;
    return <div className="mt-2 flex items-center justify-center gap-2 text-[9px]"><div className="h-px w-6" style={{ background: `linear-gradient(to right,transparent,${t.footerAccent})` }} /><span className="font-medium" style={{ color: t.footerText }}>{APP_NAME}</span><div className="h-px w-6" style={{ background: `linear-gradient(to left,transparent,${t.footerAccent})` }} /></div>;
  };

  const renderCard = (t: Theme, cardIdx: number) => {
    const borderDecor = t.layout === "accent-bar" ? { borderLeft: `5px solid ${t.accentColor}` } : t.layout === "bold" ? { border: `3px solid ${t.accentColor}30` } : {};
    return (
      <div key={t.id} ref={cardIdx === activeIdxRef.current ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: "1/1", scrollSnapAlign: "center", borderRadius: t.layout === "bold" ? "24px" : "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}), ...borderDecor }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "20px" }} />}
        <div className="relative z-10 px-3 py-3 h-full flex flex-col">
          {renderTitle(t)}
          <div className="flex-1">
            {standingsTab === "table" && renderTable(t)}
            {standingsTab === "warhead" && renderList(t, warheadData, "warhead")}
            {standingsTab === "fraggers" && renderList(t, topFraggers, "fraggers")}
          </div>
          {standingsTab === "table" && t.layout !== "minimal" && t.layout !== "compact" && <div style={{ textAlign: "center", marginTop: "2px", fontSize: "6px", color: t.legendText }}>🍗 Dinners · M Matches · P Placement · E Eliminations · T Total</div>}
          {renderFooter(t)}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col" style={{ background: "#0a0a0a" }}>
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={onClose} className="text-white/70 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl transition-all"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold tracking-widest text-white/30">STANDINGS</p>
          {tournament.splitEnabled && <GroupFilterDropdown value={groupFilter} onChange={setGroupFilter} groupCount={tournament.groupCount ?? 2} showFinal={tournament.teams.some(t => t.group === "final")} />}
        </div>
        <ExportPopover onShare={() => capture(false)} onDownload={() => capture(true)} />
      </div>
      <ThemeCarousel renderCard={renderCard} />
    </div>
  );
}
