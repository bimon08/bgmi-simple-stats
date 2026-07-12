"use client";
import { Pen, UserPlus, Pencil, ListX, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tournament, PointSystem, DEFAULT_BGMI_POINTS } from "@/lib/types";

interface Props {
  tournament: Tournament;
  save: (t: Tournament) => void;
  onClose: () => void;
  onEditTeams: () => void;
  onOpenPointSystem: () => void;
  onDelete: (id: string) => void;
}

export default function EditSheet({
  tournament, save, onClose, onEditTeams, onOpenPointSystem, onDelete,
}: Props) {
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState(tournament.name);

  const actions = [
    {
      icon: <Pen className="h-5 w-5" />, label: "Rename tournament",
      action: () => { setRenameValue(tournament.name); setShowRename(r => !r); }
    },
    {
      icon: <UserPlus className="h-5 w-5" />, label: "Edit teams",
      action: () => { onClose(); onEditTeams(); }
    },
    {
      icon: <Pencil className="h-5 w-5" />, label: "Change point system",
      action: () => { onClose(); onOpenPointSystem(); }
    },
    {
      icon: <ListX className="h-5 w-5" />, label: "Delete Points by match",
      action: () => {
        save({ ...tournament, geminiData: undefined, assignments: {} });
        onClose();
        toast.success("Match data cleared");
      }
    },
    {
      icon: <Trash2 className="h-5 w-5" />, label: "Delete tournament", danger: true,
      action: () => { onDelete(tournament.id); onClose(); }
    },
  ] as { icon: React.ReactNode; label: string; danger?: boolean; action: () => void }[];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center anim-fade-in" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => { onClose(); setShowRename(false); }}>
      <div className="w-full max-w-md rounded-t-3xl flex flex-col anim-sheet-up" style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.2)", maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-5 pt-3 pb-4" style={{ borderBottom: "1px solid rgba(124,58,237,0.12)" }}>
          <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "rgba(124,58,237,0.35)" }} />
          <p className="text-base font-bold text-white">Edit — {tournament.name}</p>
        </div>
        <div className="overflow-y-auto flex-1">
          {actions.map((item, idx) => (
            <div key={idx}>
              <button onClick={item.action} className="w-full flex items-center gap-4 px-5 py-4 text-left press-scale" style={{ borderBottom: "1px solid rgba(124,58,237,0.08)" }}>
                <span className="w-6 flex items-center justify-center shrink-0" style={{ color: item.danger ? "#f87171" : "rgba(196,181,253,0.7)" }}>{item.icon}</span>
                <span className="text-sm font-medium" style={{ color: item.danger ? "#f87171" : "#e2d9f3" }}>{item.label}</span>
              </button>
              {item.label === "Rename tournament" && showRename && (
                <div className="px-5 pb-4 flex gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && renameValue.trim()) {
                        save({ ...tournament, name: renameValue.trim() });
                        setShowRename(false);
                        toast.success("Renamed!");
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)", caretColor: "#a78bfa" }}
                    placeholder="New name..."
                  />
                  <button onClick={() => { if (!renameValue.trim()) return; save({ ...tournament, name: renameValue.trim() }); setShowRename(false); toast.success("Renamed!"); }} className="px-4 py-2 rounded-xl text-sm font-bold text-white press-scale" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}>Save</button>
                </div>
              )}
            </div>
          ))}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
