"use client";

import { Zap } from "lucide-react";
import Link from "next/link";

export function NavBar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800/50" style={{ background: "rgba(9,9,11,0.85)", backdropFilter: "blur(20px) saturate(180%)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Zap className="h-3.5 w-3.5 text-black" strokeWidth={3} />
          </div>
          <span className="font-extrabold text-base tracking-tight text-white">
            BGMI Stats
          </span>
        </Link>
      </div>
    </nav>
  );
}
