"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

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

      <div className="px-4">
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
