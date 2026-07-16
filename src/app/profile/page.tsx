"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, Key, Copy, Check, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [syncKey, setSyncKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchSyncKey = async () => {
    if (syncKey) { setShowKey(!showKey); return; }
    try {
      const res = await authFetch("/api/sync-key");
      const data = await res.json();
      setSyncKey(data.key);
      setShowKey(true);
    } catch { /* ignore */ }
  };

  const copyKey = () => {
    if (!syncKey) return;
    navigator.clipboard.writeText(syncKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="px-4 pt-10 pb-6 flex flex-col items-center gap-3">
        {session.user?.image ? (
          <img src={session.user.image} className="h-20 w-20 rounded-full ring-2 ring-zinc-700" alt="" />
        ) : (
          <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-400">
            {session.user?.name?.[0] ?? "?"}
          </div>
        )}
        <div className="text-center">
          <p className="text-base font-bold text-white">{session.user?.name}</p>
          <p className="text-xs text-zinc-500">{session.user?.email}</p>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {/* Sync Key */}
        <button
          onClick={fetchSyncKey}
          className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-semibold hover:bg-violet-500/15 transition-colors"
        >
          <Key className="h-4 w-4" />
          <span className="flex-1 text-left">Sync Key</span>
          <ChevronRight className={`h-4 w-4 transition-transform ${showKey ? "rotate-90" : ""}`} />
        </button>

        {showKey && syncKey && (
          <div className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <p className="text-[11px] text-zinc-500">Share this key with collaborators so they can join and sync data with your account.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-violet-300 font-mono bg-zinc-800 px-3 py-2 rounded-lg break-all select-all">
                {syncKey}
              </code>
              <button
                onClick={copyKey}
                className="p-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-violet-300" />}
              </button>
            </div>
          </div>
        )}

        {/* Log Out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/15 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </div>
  );
}
