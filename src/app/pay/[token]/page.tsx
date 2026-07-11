"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { use } from "react";

type Transaction = { id: string; amount: number; note: string; createdAt: string };
type Wallet = { id: string; playerName: string; balance: number; transactions: Transaction[] };

export default function PlayerWalletPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/pay/${token}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!data) setNotFound(true); else setWallet(data); setLoading(false); });
  }, [token]);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><p className="text-zinc-600 text-sm">Loading...</p></div>;
  if (notFound) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center"><p className="text-2xl mb-2">🔗</p><p className="text-white font-semibold">Invalid link</p><p className="text-zinc-500 text-sm mt-1">This wallet link doesn't exist</p></div>
    </div>
  );

  const balance = wallet!.balance;

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="px-4 pt-10 pb-6 text-center border-b border-zinc-800/50">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-3 text-2xl font-black text-black shadow-lg shadow-amber-500/25">
          {wallet!.playerName[0].toUpperCase()}
        </div>
        <h1 className="text-lg font-bold text-white">{wallet!.playerName}</h1>
        <p className="text-xs text-zinc-500 mt-0.5">BGMI Tournament Wallet</p>
      </div>

      <div className="px-4 py-6">
        <div className={`rounded-2xl p-6 text-center ${balance < 0 ? "bg-red-500/10 border border-red-500/20" : balance > 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-zinc-900 border border-zinc-800"}`}>
          <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Your Balance</p>
          <p className={`text-4xl font-black ${balance < 0 ? "text-red-400" : balance > 0 ? "text-emerald-400" : "text-zinc-400"}`}>₹{Math.abs(balance)}</p>
          <p className={`text-sm mt-2 font-medium ${balance < 0 ? "text-red-400/70" : balance > 0 ? "text-emerald-400/70" : "text-zinc-500"}`}>
            {balance < 0 ? "You owe the organiser" : balance > 0 ? "Organiser owes you" : "All settled! ✓"}
          </p>
        </div>
      </div>

      <div className="px-4 pb-10">
        <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5">Transaction History</p>
        {wallet!.transactions.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-1.5">
            {wallet!.transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${t.amount < 0 ? "bg-red-500/15" : "bg-emerald-500/15"}`}>
                  {t.amount < 0 ? <TrendingDown className="h-3.5 w-3.5 text-red-400" /> : <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">{t.note}</p>
                  <p className="text-[10px] text-zinc-600">{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${t.amount < 0 ? "text-red-400" : "text-emerald-400"}`}>{t.amount < 0 ? "−" : "+"}₹{Math.abs(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-center pb-8"><p className="text-[10px] text-zinc-700">BGMI × Simple Stats</p></div>
    </div>
  );
}
