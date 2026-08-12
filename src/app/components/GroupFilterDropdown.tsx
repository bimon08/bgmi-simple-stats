"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { groupLabels } from "@/lib/groups";

interface Props {
  value: string;
  onChange: (v: string) => void;
  groupCount: number;
  showFinal?: boolean;
  /** Optional accent colour from the active theme */
  accentColor?: string;
}

export default function GroupFilterDropdown({ value, onChange, groupCount, showFinal, accentColor = "#f97316" }: Props) {
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
      {/* Trigger — same glass pill as the three-dot button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white/80 hover:text-white transition-all text-[11px] font-bold"
      >
        {current.label}
        <ChevronDown
          className="h-3 w-3 text-white/50 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {/* Dropdown — matches three-dot menu exactly */}
      {open && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-30 rounded-2xl overflow-hidden min-w-[140px]"
          style={{
            background: "rgba(0,0,0,0.82)",
            border: "1px solid rgba(255,255,255,0.13)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
            backdropFilter: "blur(20px)",
          }}
        >
          {options.map((opt, i) => {
            const isSelected = value === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className={`flex items-center justify-between w-full px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/10 ${i < options.length - 1 ? "border-b border-white/[0.07]" : ""}`}
                style={{ color: isSelected ? accentColor : "rgba(255,255,255,0.75)" }}
              >
                {opt.label}
                {isSelected && (
                  <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
