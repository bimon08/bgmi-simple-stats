"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Users, LogIn } from "lucide-react";

const COLLAB_KEY = "sc_collab_key";

export default function LoginPage() {
  const [showCollab, setShowCollab] = useState(false);
  const [collabInput, setCollabInput] = useState("");
  const [error, setError] = useState("");

  const handleCollabJoin = () => {
    const key = collabInput.trim();
    if (key.length !== 32 || !/^[0-9a-f]+$/i.test(key)) {
      setError("That doesn't look like a valid sync key. Check with your admin.");
      return;
    }
    localStorage.setItem(COLLAB_KEY, key);
    // Also set as cookie so server middleware can verify
    document.cookie = `sc_collab_key=${key}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div>
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-violet-500/25">
            <span className="text-2xl font-black text-white">SC</span>
          </div>
          <h1 className="text-xl font-bold text-white">ScoreCalc</h1>
          <p className="text-sm text-zinc-500 mt-1">Tournament Management</p>
          <p className="text-xs text-amber-400/70 mt-2">Login to save your data</p>
        </div>

        {!showCollab ? (
          <>
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-100 active:scale-95 transition-all shadow-lg"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
              <div className="relative flex justify-center"><span className="px-3 text-xs text-zinc-600 bg-zinc-950">or</span></div>
            </div>

            <button
              onClick={() => setShowCollab(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm font-semibold hover:bg-violet-500/15 active:scale-95 transition-all"
            >
              <Users className="h-4 w-4" />
              Join as Collaborator
            </button>
            <p className="text-[11px] text-zinc-600">Each organizer sees only their own players</p>
          </>
        ) : (
          <div className="space-y-4">
            <div className="text-left">
              <p className="text-sm text-zinc-300 font-medium mb-1">Sync Key</p>
              <p className="text-xs text-zinc-500 mb-3">Ask the admin to share their sync key from Profile → Sync Key</p>
              <input
                value={collabInput}
                onChange={e => { setCollabInput(e.target.value); setError(""); }}
                placeholder="Paste 32-character key…"
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-600 focus:border-violet-500/60 focus:outline-none font-mono"
                autoFocus
              />
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            </div>
            <button
              onClick={handleCollabJoin}
              disabled={!collabInput.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 active:scale-95 transition-all disabled:opacity-40"
            >
              <LogIn className="h-4 w-4" />
              Join
            </button>
            <button
              onClick={() => { setShowCollab(false); setError(""); setCollabInput(""); }}
              className="w-full text-xs text-zinc-500 hover:text-zinc-400 py-2"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
