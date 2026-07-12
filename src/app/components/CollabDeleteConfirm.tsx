"use client";
import { Trash2 } from "lucide-react";

interface Props {
  tournamentId: string;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}

export default function CollabDeleteConfirm({ tournamentId, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-3xl p-6 anim-slide-up" style={{ background: "#13092b", border: "1px solid rgba(239,68,68,0.25)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="h-11 w-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)" }}>
            <Trash2 className="h-5 w-5" style={{ color: "#f87171" }} />
          </div>
          <p className="text-base font-bold text-white">Remove shared tournament?</p>
        </div>
        <p className="text-sm text-center mb-5" style={{ color: "rgba(196,181,253,0.5)" }}>
          This will only delete it <span className="text-white font-semibold">for you</span>. The original tournament won&apos;t be affected.
        </p>
        <button onClick={() => { onConfirm(tournamentId); onCancel(); }} className="w-full py-3.5 rounded-xl font-bold text-sm text-white press-scale mb-2" style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
          Delete for me
        </button>
        <button onClick={onCancel} className="w-full py-2.5 rounded-xl text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Keep it</button>
      </div>
    </div>
  );
}
