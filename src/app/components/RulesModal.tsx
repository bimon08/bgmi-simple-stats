"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Tournament } from "@/lib/types";

interface Props {
  tournament: Tournament;
  save: (t: Tournament) => void;
  onClose: () => void;
}

export default function RulesModal({ tournament, save, onClose }: Props) {
  const [rulesText, setRulesText] = useState((tournament.rules ?? []).join("\n"));

  const saveRules = () => {
    const rules = rulesText.split("\n").map(r => r.trim()).filter(Boolean);
    save({ ...tournament, rules });
    return rules;
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl p-6 anim-slide-up" style={{ background: "#13092b", border: "1px solid rgba(124,58,237,0.3)" }} onClick={e => e.stopPropagation()}>
        <p className="text-xs font-bold tracking-widest text-center mb-1" style={{ color: "rgba(167,139,250,0.6)" }}>RULES</p>
        <p className="text-base font-bold text-white text-center mb-4">{tournament.name}</p>
        <p className="text-[10px] mb-1.5" style={{ color: "rgba(167,139,250,0.5)" }}>ONE RULE PER LINE</p>
        <textarea
          autoFocus
          value={rulesText}
          onChange={e => setRulesText(e.target.value)}
          placeholder={"No teaming\nNo emulator\nSquad only\n..."}
          rows={7}
          className="w-full rounded-xl p-3 text-sm resize-none focus:outline-none mb-4"
          style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#e9d5ff", caretColor: "#a78bfa" }}
        />
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              const rules = saveRules();
              const msg = `📋 *${tournament.name} — Rules*\n\n${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nGood luck! 🎮`;
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
              onClose();
            }}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white press-scale flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#25d366,#128c7e)" }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.859L0 24l6.335-1.518A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.371l-.36-.214-3.722.892.934-3.617-.236-.373A9.818 9.818 0 0112 2.182c5.418 0 9.818 4.4 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818z" /></svg>
            Save & Share on WhatsApp
          </button>
          <button onClick={() => { saveRules(); onClose(); toast.success("Rules saved"); }} className="w-full py-2.5 rounded-xl text-sm font-bold press-scale" style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.3)" }}>Save only</button>
          <button onClick={onClose} className="w-full py-2 text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
