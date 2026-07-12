"use client";
import { X, Flag, ArrowRight, Trophy } from "lucide-react";
import { Tournament } from "@/lib/types";

interface Props {
  tournaments: Tournament[];
  createName: string;
  setCreateName: (v: string) => void;
  roundRobin: boolean;
  setRoundRobin: (fn: (v: boolean) => boolean) => void;
  onClose: () => void;
  onCreate: () => void;
  onClone: (t: Tournament) => void;
}

export default function CreateScreen({
  tournaments, createName, setCreateName,
  roundRobin, setRoundRobin,
  onClose, onCreate, onClone,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col anim-fade-in" style={{ background: "#0a0614" }}>
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-2 rounded-full press-scale"
        style={{ background: "rgba(255,255,255,0.07)", color: "rgba(196,181,253,0.7)" }}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-col flex-1 overflow-y-auto px-6 pt-16 pb-10">
        <h1 className="text-3xl mb-8 text-white" style={{ fontFamily: "'Dancing Script', cursive", fontWeight: 700, letterSpacing: "0.01em" }}>
          Create a tournament
        </h1>

        <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Flag className="h-4 w-4 shrink-0" style={{ color: "rgba(196,181,253,0.55)" }} />
          <input
            autoFocus
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && createName.trim()) onCreate(); }}
            placeholder="Enter Tourney Name"
            className="flex-1 bg-transparent text-white text-sm focus:outline-none"
            style={{ caretColor: "#a78bfa" }}
          />
        </div>

        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setRoundRobin((v) => !v)} className="relative shrink-0 press-scale" style={{ width: 48, height: 28 }}>
            <div className="absolute inset-0 rounded-full transition-colors duration-200" style={{ background: roundRobin ? "rgba(124,58,237,0.9)" : "rgba(255,255,255,0.15)" }} />
            <div className="absolute top-1 left-1 transition-transform duration-200 h-5 w-5 rounded-full bg-white shadow" style={{ transform: roundRobin ? "translateX(20px)" : "translateX(0)" }} />
          </button>
          <span className="text-sm font-medium" style={{ color: roundRobin ? "#c4b5fd" : "rgba(196,181,253,0.5)" }}>Round Robin</span>
          <button onClick={onCreate} disabled={!createName.trim()} className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-30 press-scale" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
            GO <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {tournaments.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed" }} />
              <span className="text-xs font-semibold tracking-widest" style={{ color: "rgba(196,181,253,0.45)" }}>OR</span>
              <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed" }} />
            </div>
            <p className="text-xs text-center italic mb-4" style={{ color: "rgba(196,181,253,0.4)" }}>Create from existing tourney</p>
            <div className="space-y-2 pb-4">
              {tournaments.map((t) => (
                <button key={t.id} onClick={() => onClone(t)} className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left press-scale transition-colors" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}>
                  <div className="h-11 w-11 rounded-xl shrink-0 flex items-center justify-center" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }}>
                    <Trophy className="h-5 w-5" style={{ color: "#a78bfa" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-tight truncate">{t.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(196,181,253,0.5)" }}>Total teams: {String(t.teams.length).padStart(2, "0")}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
