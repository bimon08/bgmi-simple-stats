"use client";
import { useState, useRef, useEffect } from "react";
import { Share2, Download, Check } from "lucide-react";

type Format = "square" | "landscape";

interface Props {
  onShare: () => void;
  onDownload: () => void;
  disabled?: boolean;
  format?: Format;
  onFormatChange?: (f: Format) => void;
}

const FORMATS: { key: Format; label: string; icon: React.ReactNode }[] = [
  {
    key: "landscape",
    label: "Landscape",
    icon: (
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
        <rect x="1" y="1" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    key: "square",
    label: "Square",
    icon: (
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
];

export default function ExportPopover({ onShare, onDownload, disabled, format, onFormatChange }: Props) {
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

  return (
    <div ref={ref} className="relative">
      {/* Trigger — same glass pill as SlotsModal three-dot */}
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="p-2 rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white/70 hover:text-white transition-all disabled:opacity-50"
      >
        <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor">
          <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="14" cy="2" r="1.5"/>
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-48 rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "rgba(0,0,0,0.82)", border: "1px solid rgba(255,255,255,0.13)", backdropFilter: "blur(20px)" }}>

            {/* Format selector — only shown if parent provides props */}
            {format && onFormatChange && (
              <>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Format</span>
                </div>
                {FORMATS.map((f, i) => (
                  <button
                    key={f.key}
                    onClick={() => { onFormatChange(f.key); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10 ${i < FORMATS.length - 1 ? "border-b border-white/[0.07]" : ""}`}
                    style={{ color: format === f.key ? "#f59e0b" : "rgba(255,255,255,0.65)" }}
                  >
                    <span className="flex items-center gap-2.5">
                      {f.icon}
                      {f.label}
                    </span>
                    {format === f.key && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
                  </button>
                ))}
                <div className="border-t border-white/10 mt-1" />
              </>
            )}

            {/* Share */}
            <button
              onClick={() => { onShare(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors border-b border-white/[0.07]"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>

            {/* Download */}
            <button
              onClick={() => { onDownload(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <Download className="h-4 w-4" /> Save image
            </button>
          </div>
        </>
      )}
    </div>
  );
}
