"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { groupLabels } from "@/lib/groups";

interface Props {
  value: string;  // "all" | "A" | "B" | "C" ... | "final"
  onChange: (v: string) => void;
  groupCount: number;
  showFinal?: boolean;
}

export default function GroupFilterDropdown({ value, onChange, groupCount, showFinal }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [open]);

  const options = [
    { key: "all", label: "All" },
    ...groupLabels(groupCount).map(l => ({ key: l, label: `Group ${l}` })),
    ...(showFinal ? [{ key: "final", label: "🏆 Final" }] : []),
  ];

  const current = options.find(o => o.key === value) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg press-scale"
        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)", color: "#c4b5fd" }}
      >
        {current.label}
        <ChevronDown className="h-3 w-3" style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30 rounded-xl overflow-hidden anim-fade-in min-w-[120px]"
          style={{ background: "#110b1e", border: "1px solid rgba(124,58,237,0.18)", boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}
        >
          {options.map(opt => (
            <button
              key={opt.key}
              onClick={() => { onChange(opt.key); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3.5 py-2.5 text-left text-xs font-medium transition-colors"
              style={{
                color: value === opt.key ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                background: value === opt.key ? "rgba(124,58,237,0.2)" : "transparent",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
