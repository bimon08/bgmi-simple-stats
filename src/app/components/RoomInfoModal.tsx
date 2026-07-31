"use client";
import { useState } from "react";
import { Tournament } from "@/lib/types";
import { groupLabels } from "@/lib/groups";

interface Props {
  tournament: Tournament;
  save: (t: Tournament) => void;
  onClose: () => void;
}

const WaIcon = ({ size = "h-4 w-4", fill = "#25d366" }: { size?: string; fill?: string }) => (
  <svg viewBox="0 0 24 24" className={`${size} shrink-0`} fill={fill}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.859L0 24l6.335-1.518A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.371l-.36-.214-3.722.892.934-3.617-.236-.373A9.818 9.818 0 0112 2.182c5.418 0 9.818 4.4 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818z" /></svg>
);

export default function RoomInfoModal({ tournament, save, onClose }: Props) {
  const [waGroupLink, setWaGroupLink] = useState(tournament.waGroup ?? "");
  const defaultMsg = `Hi *{team}*! 🎮\nPlease join this group to get ID and Password for *${tournament.name}*:\n{link}`;
  const savedMsg = (tournament.waMessage ?? "")
    .replace(/\*the tournament\*/g, `*${tournament.name}*`)
    .replace(/for the tournament/g, `for *${tournament.name}*`)
    .replace(/\bjilr\b|\bjillr\b/g, "join");
  const [waMessage, setWaMessage] = useState(savedMsg || defaultMsg);
  const [waGroupLinks, setWaGroupLinks] = useState<Record<string, string>>(tournament.waGroupLinks ?? {});
  const [waLinkTab, setWaLinkTab] = useState(0);
  const sentIds = new Set(tournament.waGroupSent ?? []);

  const gc = tournament.groupCount ?? 2;
  const allLabels = groupLabels(gc);
  const hasFinals = tournament.teams.some(t => t.group === "final");
  const gLabels = groupLabels(gc);

  // Map tab index to group label
  const tabToLabel = (i: number): string | null => {
    if (i === 0) return null;
    if (i <= gLabels.length) return gLabels[i - 1];
    return "final";
  };

  const activeLabel = tournament.splitEnabled && waLinkTab > 0 ? tabToLabel(waLinkTab) : null;

  const buildMsg = (team: typeof tournament.teams[number]) => {
    const teamGroup = activeLabel ?? (team.group && team.group !== "waiting" ? team.group : null);
    const link = teamGroup ? (waGroupLinks[teamGroup] ?? "").trim() || waGroupLink.trim() : waGroupLink.trim();
    let msg = waMessage.replace(/\{team\}/g, team.name).replace(/\{link\}/g, link || "—");
    if (teamGroup) msg = msg.replace("join this group", `join the *Group ${teamGroup}* group`);
    return msg;
  };

  const sendToLeader = (team: typeof tournament.teams[number]) => {
    const clean = (team.phone ?? "").replace(/\D/g, "");
    if (!clean) return;
    const waPhone = clean.length === 10 ? `91${clean}` : clean;
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(buildMsg(team))}`, "_blank", "noopener,noreferrer");
    const newSent = [...new Set([...sentIds, team.id])];
    const updated = {
      ...tournament, waGroup: waGroupLink.trim(), waMessage, waGroupSent: newSent,
      ...(tournament.splitEnabled ? { waGroupLinks } : {}),
    };
    save(updated as Tournament & { waGroup: string; waMessage: string; waGroupSent: string[] });
    sentIds.add(team.id);
  };

  const visibleTeams = tournament.teams.filter(tm => !tm.out && (!activeLabel || tm.group === activeLabel));
  const withNumber = visibleTeams.filter(t => t.phone).length;

  // Tab UI
  const tabs = tournament.splitEnabled
    ? ["Main", ...gLabels.map(l => `Group ${l}`), ...(hasFinals ? ["🏆 Final"] : [])]
    : [];
  const currentLabel = tabToLabel(waLinkTab);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl anim-slide-up flex flex-col" style={{ background: "#13092b", border: "1px solid rgba(124,58,237,0.3)", maxHeight: "88dvh" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 shrink-0 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <WaIcon size="h-5 w-5" />
            <p className="text-xs font-bold tracking-widest" style={{ color: "rgba(167,139,250,0.6)" }}>WHATSAPP GROUP</p>
          </div>

          {/* Group tabs */}
          {tournament.splitEnabled && tabs.length > 0 && (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                {tabs.map((tab, i) => (
                  <button key={tab} onClick={() => setWaLinkTab(i)} className="shrink-0 px-3 py-1 rounded-lg text-[10px] font-bold transition-all" style={{ background: waLinkTab === i ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${waLinkTab === i ? "rgba(37,211,102,0.3)" : "rgba(255,255,255,0.06)"}`, color: waLinkTab === i ? "#4ade80" : "rgba(255,255,255,0.35)" }}>
                    {tab}
                  </button>
                ))}
              </div>
              {waLinkTab === 0 ? (
                <input value={waGroupLink} onChange={(e) => { setWaGroupLink(e.target.value); save({ ...tournament, waGroup: e.target.value.trim(), waMessage } as Tournament & { waGroup: string; waMessage: string }); }} placeholder="https://chat.whatsapp.com/..." className="w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none" style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", caretColor: "#25d366" }} />
              ) : (
                <input value={waGroupLinks[currentLabel!] ?? ""} onChange={(e) => { const updated = { ...waGroupLinks, [currentLabel!]: e.target.value }; setWaGroupLinks(updated); save({ ...tournament, waGroupLinks: updated }); }} placeholder={`${currentLabel === "final" ? "Final" : `Group ${currentLabel}`} link...`} className="w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", caretColor: "#a78bfa" }} />
              )}
            </>
          )}

          {/* Single link (non-split) */}
          {!tournament.splitEnabled && (
            <div>
              <p className="text-[10px] font-bold mb-1 uppercase" style={{ color: "rgba(167,139,250,0.45)" }}>Group Invite Link</p>
              <input value={waGroupLink} onChange={(e) => { setWaGroupLink(e.target.value); save({ ...tournament, waGroup: e.target.value.trim(), waMessage } as Tournament & { waGroup: string; waMessage: string }); }} placeholder="https://chat.whatsapp.com/..." className="w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none" style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", caretColor: "#25d366" }} />
            </div>
          )}

          {/* Message template */}
          <div>
            {activeLabel ? (() => {
              const groupLink = (waGroupLinks[activeLabel] ?? "").trim() || "{link}";
              const preview = waMessage.replace(/\{team\}/g, "TeamName").replace(/\{link\}/g, groupLink).replace("join this group", `join the *Group ${activeLabel}* group`);
              return <>
                <p className="text-[10px] font-bold mb-1 uppercase" style={{ color: "rgba(167,139,250,0.45)" }}>Message Preview · Group {activeLabel}</p>
                <div className="w-full px-3 py-2 rounded-xl text-sm whitespace-pre-wrap" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "rgba(229,213,255,0.6)", lineHeight: 1.5, minHeight: "3.5rem" }}>{preview}</div>
              </>;
            })() : <>
              <p className="text-[10px] font-bold mb-1 uppercase" style={{ color: "rgba(167,139,250,0.45)" }}>Default Message <span style={{ color: "rgba(167,139,250,0.3)" }}>— use &#123;team&#125; and &#123;link&#125;</span></p>
              <textarea value={waMessage} onChange={(e) => { setWaMessage(e.target.value); save({ ...tournament, waGroup: waGroupLink.trim(), waMessage: e.target.value } as Tournament & { waGroup: string; waMessage: string }); }} rows={3} className="w-full px-3 py-2 rounded-xl text-sm resize-none focus:outline-none" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#e9d5ff", caretColor: "#a78bfa" }} />
            </>}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px shrink-0" style={{ background: "rgba(124,58,237,0.12)" }} />

        {/* Leaders */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <p className="text-[10px] font-bold" style={{ color: "rgba(167,139,250,0.5)" }}>
            LEADERS{activeLabel ? ` · GROUP ${activeLabel}` : ""} — {withNumber}/{visibleTeams.length} with number
          </p>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
          {visibleTeams.map((team) => {
            const hasPhone = !!team.phone?.trim();
            const sent = sentIds.has(team.id);
            const gBadge = tournament.splitEnabled && team.group && team.group !== "waiting" && !activeLabel ? team.group : "";
            return (
              <div key={team.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: sent ? "rgba(37,211,102,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${sent ? "rgba(37,211,102,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: sent ? "#4ade80" : "white" }}>
                    {gBadge && <span className="mr-1 text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>{gBadge}</span>}{team.name}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: hasPhone ? "rgba(167,139,250,0.5)" : "rgba(167,139,250,0.2)" }}>{hasPhone ? team.phone : "No number"}</p>
                </div>
                {hasPhone ? (
                  <button onClick={() => sendToLeader(team)} disabled={!sent && !(activeLabel ? (waGroupLinks[activeLabel] ?? "").trim() || waGroupLink.trim() : waGroupLink.trim())} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white press-scale disabled:opacity-30 disabled:cursor-not-allowed" style={{ background: sent ? "rgba(37,211,102,0.2)" : "linear-gradient(135deg,#25d366,#128c7e)", border: sent ? "1px solid rgba(37,211,102,0.4)" : "none", color: sent ? "#4ade80" : "white" }}>
                    {sent ? "✓ Sent" : <><WaIcon size="h-4 w-4" fill="white" /> Send</>}
                  </button>
                ) : (
                  <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(167,139,250,0.2)" }}>No #</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-6 pb-5 pt-2 shrink-0">
          <button onClick={onClose} className="w-full py-2 text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Close</button>
        </div>
      </div>
    </div>
  );
}
