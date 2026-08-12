"use client";
import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import standingsThemes from "@/lib/standingsThemes";

type Theme = typeof standingsThemes[0];

interface Props {
  renderCard: (theme: Theme, index: number) => ReactNode;
  activeRef?: React.RefObject<HTMLDivElement | null>;
  align?: "center" | "start";
  onActiveIndexChange?: (index: number) => void;
}

export default function ThemeCarousel({ renderCard, activeRef, align = "center", onActiveIndexChange }: Props) {
  const [idx, setIdx] = useState(0);
  // Track touch start to detect intentional left/right swipe vs. vertical scroll
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(i, standingsThemes.length - 1));
    setIdx(clamped);
    onActiveIndexChange?.(clamped);
  };

  // Block only horizontal swipe on the strip itself (not vertical scroll inside cards)
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      // Only block if it's more horizontal than vertical (i.e. trying to swipe the carousel)
      if (dx > dy) e.preventDefault();
    };

    strip.addEventListener("touchstart", onTouchStart, { passive: true });
    strip.addEventListener("touchmove",  onTouchMove,  { passive: false });
    return () => {
      strip.removeEventListener("touchstart", onTouchStart);
      strip.removeEventListener("touchmove",  onTouchMove);
    };
  }, []);

  const currentTheme = standingsThemes[idx];
  // Transform: each card is (100vw - 48px) wide + 16px gap = (100vw - 32px) per step
  // Start offset = 24px (padding) so card 0 is centred
  const translateX = `calc(24px - ${idx} * (100vw - 32px))`;

  return (
    <div className={`flex-1 flex flex-col overflow-hidden relative ${align === "start" ? "justify-start" : "justify-center"}`}>
      {/* Arrows */}
      {idx > 0 && (
        <button onClick={() => goTo(idx - 1)} className="absolute left-1 z-20 p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:bg-black/70 transition-all" style={{ top: "45%", transform: "translateY(-50%)" }}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {idx < standingsThemes.length - 1 && (
        <button onClick={() => goTo(idx + 1)} className="absolute right-1 z-20 p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:bg-black/70 transition-all" style={{ top: "45%", transform: "translateY(-50%)" }}>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Cards strip — transform-based, no scroll container */}
      <div className="overflow-hidden py-2" ref={stripRef}>
        <div
          className="flex gap-4 items-start will-change-transform"
          style={{
            transform: `translateX(${translateX})`,
            transition: "transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
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
              onClick={() => goTo(i)}
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
