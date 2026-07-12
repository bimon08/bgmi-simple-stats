"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Tournament, PointSystem } from "@/lib/types";

interface Props {
  tournament: Tournament;
  editingPoints: PointSystem;
  setEditingPoints: (fn: (p: PointSystem) => PointSystem) => void;
  showMorePositions: boolean;
  setShowMorePositions: (fn: (v: boolean) => boolean) => void;
  save: (t: Tournament) => void;
  onClose: () => void;
}

export default function PointSystemModal({
  tournament, editingPoints, setEditingPoints,
  showMorePositions, setShowMorePositions,
  save, onClose,
}: Props) {
  const pts100 = Array.from({ length: 100 }, (_, i) => editingPoints.positionPoints[i] ?? 0);

  const setPos = (idx: number, val: number) => {
    const updated = [...pts100]; updated[idx] = val;
    setEditingPoints(p => ({ ...p, positionPoints: updated }));
  };

  const sliderStyle = (val: number, max: number) =>
    ({ "--fill": `${(val / max) * 100}%` }) as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ background: "#1a0d33" }}>
      <div className="max-w-md mx-auto px-5 py-6">
        <div className="flex items-center mb-8">
          <button onClick={onClose} className="p-2 -ml-2 rounded-xl press-scale" style={{ color: "#a78bfa" }}>
            <ChevronDown className="h-6 w-6 rotate-90" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm" style={{ color: "rgba(167,139,250,0.5)" }}>Choose your</p>
            <h1 className="text-xl font-black text-white">Point System</h1>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex gap-2 mb-8">
          <div className="px-6 py-2 rounded-full text-sm font-bold text-white" style={{ border: "1.5px solid #a78bfa" }}>BGMI</div>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold text-white mb-4">Kills point</p>
          <div className="flex items-center gap-4">
            <input type="range" min={0} max={10} step={1} value={editingPoints.killPoints} onChange={e => setEditingPoints(p => ({ ...p, killPoints: +e.target.value }))} className="pc-slider flex-1" style={sliderStyle(editingPoints.killPoints, 10)} />
            <span className="text-base font-black w-6 text-right shrink-0" style={{ color: "#c4b5fd" }}>{editingPoints.killPoints}</span>
          </div>
        </div>

        <div className="mb-2">
          <p className="text-sm font-semibold text-white mb-5">Position points</p>
          <div className="space-y-5">
            {pts100.slice(0, 8).map((val, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <span className="text-sm font-bold w-8 shrink-0" style={{ color: "rgba(167,139,250,0.65)" }}>#{idx + 1}</span>
                <input type="range" min={0} max={15} step={1} value={val} onChange={e => setPos(idx, +e.target.value)} className="pc-slider flex-1" style={sliderStyle(val, 15)} />
                <span className="text-base font-black w-7 text-right shrink-0" style={{ color: "#c4b5fd" }}>{val}</span>
              </div>
            ))}
          </div>

          <button onClick={() => setShowMorePositions(m => !m)} className="flex items-center gap-2 mt-6 mb-1 press-scale" style={{ color: "#a78bfa" }}>
            <ChevronDown className="h-4 w-4" style={{ transform: showMorePositions ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 280ms" }} />
            <span className="text-sm font-semibold">{showMorePositions ? "Hide" : "More"} positions (#9 – #100)</span>
          </button>

          <div style={{ display: "grid", gridTemplateRows: showMorePositions ? "1fr" : "0fr", transition: "grid-template-rows 300ms cubic-bezier(0.4,0,0.2,1)" }}>
            <div style={{ overflow: "hidden" }}>
              <div className="space-y-5 pt-4">
                {pts100.slice(8).map((val, i) => {
                  const idx = i + 8;
                  return (
                    <div key={idx} className="flex items-center gap-4">
                      <span className="text-sm font-bold w-8 shrink-0" style={{ color: "rgba(167,139,250,0.65)" }}>#{idx + 1}</span>
                      <input type="range" min={0} max={15} step={1} value={val} onChange={e => setPos(idx, +e.target.value)} className="pc-slider flex-1" style={sliderStyle(val, 15)} />
                      <span className="text-base font-black w-7 text-right shrink-0" style={{ color: "#c4b5fd" }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <button
            onClick={() => {
              let trimmed = [...pts100];
              while (trimmed.length > 8 && trimmed[trimmed.length - 1] === 0) trimmed.pop();
              const updated = { ...tournament, pointSystem: { ...editingPoints, positionPoints: trimmed } };
              save(updated);
              onClose();
              toast.success("Point system saved!");
            }}
            className="w-full py-4 rounded-2xl text-base font-bold text-white press-scale"
            style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
          >Continue</button>
        </div>
      </div>
    </div>
  );
}
