"use client";
import { toast } from "sonner";

interface ShareInfo { code: string; url: string; name: string; }
interface Props {
  shareInfo: ShareInfo;
  onClose: () => void;
}

export default function ShareCodeModal({ shareInfo, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl p-6 anim-slide-up" style={{ background: "#13092b", border: "1px solid rgba(124,58,237,0.3)" }} onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-bold tracking-widest text-center mb-1" style={{ color: "rgba(167,139,250,0.6)" }}>SHARE TOURNAMENT</p>
        <p className="text-white font-bold text-center mb-5 truncate">{shareInfo.name}</p>
        <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)" }}>
          <p className="text-xs mb-2" style={{ color: "rgba(196,181,253,0.5)" }}>Share code</p>
          <p className="text-4xl font-black tracking-[0.25em] text-white" style={{ fontFamily: "monospace" }}>{shareInfo.code}</p>
          <p className="text-[10px] mt-2" style={{ color: "rgba(196,181,253,0.4)" }}>Others can enter this code to import</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(shareInfo.code); toast.success("Code copied!"); }} className="flex-1 py-3 rounded-xl font-bold text-sm press-scale" style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.3)" }}>Copy code</button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: shareInfo.name, text: `Use code ${shareInfo.code} to import my tournament!`, url: shareInfo.url }).catch(() => {});
              } else { navigator.clipboard.writeText(shareInfo.url); toast.success("Link copied!"); }
            }}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white press-scale"
            style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}
          >Share link</button>
        </div>
        <button onClick={onClose} className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Close</button>
      </div>
    </div>
  );
}
