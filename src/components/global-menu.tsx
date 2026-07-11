"use client";
import { useState } from "react";
import { Menu, X, BookOpen, ChevronRight, Home, Trophy } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function GlobalMenu() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const hidden = path.startsWith("/pay/") || path.startsWith("/login");
  const close = () => setOpen(false);
  const go = (href: string) => { close(); router.push(href); };

  if (hidden) return null;

  const items = [
    { href: "/", icon: <Home className="h-4 w-4" />, label: "Home", desc: "All tournaments" },
    { href: "/rules", icon: <BookOpen className="h-4 w-4" />, label: "Rules", desc: "Edit tournament rules" },
  ];

  return (
    <>
      {/* Real sticky top app bar — not floating */}
      <header
        className="fixed top-0 left-0 right-0 z-30 flex items-center h-12"
        style={{
          background: "rgba(12,9,20,0.92)",
          borderBottom: "1px solid rgba(124,58,237,0.15)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <button
          onClick={() => setOpen(true)}
          className="h-12 w-12 flex items-center justify-center transition-all active:scale-90"
          style={{ color: "#a78bfa" }}
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Drawer — above everything */}
      {open && (
        <div className="fixed inset-0 z-[80] flex anim-fade-in" onClick={close}>
          {/* Panel */}
          <div
            className="w-full max-w-xs h-full flex flex-col shadow-2xl anim-sheet-up"
            style={{
              background: "#120c1e",
              borderRight: "1px solid rgba(124,58,237,0.2)",
              animation: "slideInLeft 280ms cubic-bezier(0.22,1,0.36,1) both",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(124,58,237,0.15)" }}>
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}>
                <Trophy className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-black text-white">ScoreCalc</span>
                <p className="text-[10px]" style={{ color: "rgba(167,139,250,0.5)" }}>Tournament Manager</p>
              </div>
              <button onClick={close} className="p-1.5 rounded-lg" style={{ color: "rgba(167,139,250,0.5)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Menu items */}
            <div className="flex-1 overflow-y-auto py-3 px-2">
              {items.map((item) => (
                <button
                  key={item.href}
                  onClick={() => go(item.href)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left mb-1 active:scale-95"
                  style={{
                    background: path === item.href ? "rgba(124,58,237,0.2)" : "transparent",
                    border: path === item.href ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
                  }}
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa" }}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="text-[10px]" style={{ color: "rgba(167,139,250,0.5)" }}>{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4" style={{ color: "rgba(124,58,237,0.4)" }} />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(124,58,237,0.15)" }}>
              <p className="text-[10px] text-center" style={{ color: "rgba(167,139,250,0.3)" }}>ScoreCalc · Tournament Toolkit</p>
            </div>
          </div>

          {/* Dimmed overlay */}
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.6)" }} />
        </div>
      )}
    </>
  );
}
