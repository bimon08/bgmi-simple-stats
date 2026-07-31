"use client";
import { useState, useRef, useEffect } from "react";
import { Share2, Download } from "lucide-react";

interface Props {
  onShare: () => void;
  onDownload: () => void;
  disabled?: boolean;
}

export default function ExportPopover({ onShare, onDownload, disabled }: Props) {
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
      <button onClick={() => setOpen(!open)} disabled={disabled} className="text-white/70 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl transition-all disabled:opacity-50">
        <Share2 className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 rounded-xl overflow-hidden anim-fade-in" style={{ background: "#110b1e", border: "1px solid rgba(124,58,237,0.18)", boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
          <button onClick={() => { onShare(); setOpen(false); }} className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white/80 hover:bg-white/5 w-full text-left whitespace-nowrap">
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
          <button onClick={() => { onDownload(); setOpen(false); }} className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white/80 hover:bg-white/5 w-full text-left whitespace-nowrap">
            <Download className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      )}
    </div>
  );
}
