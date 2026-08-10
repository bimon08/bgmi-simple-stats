"use client";
import { useState, useRef, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import standingsThemes from "@/lib/standingsThemes";

type Theme = typeof standingsThemes[0];

interface Props {
  renderCard: (theme: Theme, index: number) => ReactNode;
  activeRef?: React.RefObject<HTMLDivElement | null>;
  align?: "center" | "start";
}

export default function ThemeCarousel({ renderCard, activeRef, align = "center" }: Props) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const cw = el.firstElementChild?.clientWidth ?? 300;
    el.scrollBy({ left: dir * (cw + 16), behavior: "smooth" });
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const cardW = el.firstElementChild?.clientWidth ?? 300;
    const i = Math.round(el.scrollLeft / (cardW + 16));
    setIdx(Math.max(0, Math.min(i, standingsThemes.length - 1)));
  };

  const jumpTo = (i: number) => {
    setIdx(i);
    const el = scrollRef.current;
    if (el) {
      const cardW = el.firstElementChild?.clientWidth ?? 300;
      el.scrollTo({ left: i * (cardW + 16), behavior: "smooth" });
    }
  };

  // Expose active index to parent via ref callback
  const currentTheme = standingsThemes[idx];

  return (
    <div className={`flex-1 flex flex-col overflow-hidden relative ${align === "start" ? "justify-start" : "justify-center"}`}>
      {/* Arrows */}
      {idx > 0 && (
        <button onClick={() => scroll(-1)} className="absolute left-1 z-20 p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:bg-black/70 transition-all" style={{ top: "45%", transform: "translateY(-50%)" }}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {idx < standingsThemes.length - 1 && (
        <button onClick={() => scroll(1)} className="absolute right-1 z-20 p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:bg-black/70 transition-all" style={{ top: "45%", transform: "translateY(-50%)" }}>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Cards */}
      <div className="overflow-hidden">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto px-6 py-2 no-scrollbar w-full items-center"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingBottom: "20px", marginBottom: "-20px" }}
          onScroll={onScroll}
        >
          {standingsThemes.map((t, i) => renderCard(t, i))}
        </div>
      </div>

      {/* Theme name + dots */}
      <div className="pt-1.5 pb-0 px-4">
        <p className="text-center text-sm font-bold text-white mb-1.5">{currentTheme.name}</p>
        <div className="flex justify-center gap-1.5 flex-wrap">
          {standingsThemes.map((t, i) => (
            <button
              key={t.id}
              onClick={() => jumpTo(i)}
              className="transition-all duration-300"
              style={{
                width: idx === i ? "20px" : "6px",
                height: "6px",
                borderRadius: "3px",
                background: idx === i ? t.previewColors[1] : "rgba(255,255,255,0.2)",
                boxShadow: idx === i ? `0 0 8px ${t.previewColors[1]}60` : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
