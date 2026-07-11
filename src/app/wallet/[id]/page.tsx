"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Copy, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";

type Transaction = { id: string; walletId: string; amount: number; note: string; createdAt: string };
type Wallet = { id: string; playerName: string; shareToken: string; phone: string | null; balance: number; transactions: Transaction[] };

export default function WalletDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTxn, setShowTxn] = useState(false);
  const [txnAmount, setTxnAmount] = useState("");
  const [txnNote, setTxnNote] = useState("");
  const [txnType, setTxnType] = useState<"owe" | "paid">("owe");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchWallet = useCallback(async () => {
    const res = await fetch(`/api/wallets/${id}`);
    if (!res.ok) { router.push("/wallet"); return; }
    const data = await res.json();
    setWallet({ ...data, balance: data.transactions.reduce((s: number, t: Transaction) => s + t.amount, 0) });
    setLoading(false);
  }, [id, router]);

  useEffect(() => { if (session) fetchWallet(); }, [session, fetchWallet]);

  const copyLink = () => {
    if (!wallet) return;
    navigator.clipboard.writeText(`${window.location.origin}/pay/${wallet.shareToken}`);
    toast.success("Link copied!");
  };

  const addTransaction = async () => {
    if (!wallet || !txnAmount) return;
    const amt = parseInt(txnAmount);
    if (isNaN(amt) || amt <= 0) return;
    const finalAmt = txnType === "owe" ? -amt : amt;
    const note = txnNote.trim() || (txnType === "owe" ? "Entry Fee" : "Prize");
    const res = await fetch(`/api/wallets/${wallet.id}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: finalAmt, note }),
    });
    if (!res.ok) { toast.error("Failed"); return; }
    toast.success("Added!");
    setTxnAmount(""); setTxnNote(""); setShowTxn(false);
    fetchWallet();
  };

  const deleteTransaction = async (txnId: string) => {
    await fetch(`/api/transactions/${txnId}`, { method: "DELETE" });
    fetchWallet();
  };

  if (loading || !wallet) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="h-5 w-5 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="h-4 w-4 text-zinc-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-white">{wallet.playerName}</h2>
          {wallet.phone && <p className="text-[10px] text-zinc-500">{wallet.phone}</p>}
        </div>
        <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors">
          <Copy className="h-3 w-3" /> Share Link
        </button>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Balance Card */}
        <div className={`rounded-2xl p-5 text-center ${wallet.balance < 0 ? "bg-red-500/10 border border-red-500/20" : wallet.balance > 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-zinc-900 border border-zinc-800"}`}>
          <p className="text-xs text-zinc-500 mb-1">Current Balance</p>
          <p className={`text-3xl font-black ${wallet.balance < 0 ? "text-red-400" : wallet.balance > 0 ? "text-emerald-400" : "text-zinc-400"}`}>
            {wallet.balance !== 0 ? `₹${Math.abs(wallet.balance)}` : "₹0"}
          </p>
          <p className="text-[11px] mt-1.5 text-zinc-500">
            {wallet.balance < 0 ? "This player owes you" : wallet.balance > 0 ? "You owe this player" : "All settled ✓"}
          </p>
        </div>

        {/* Add Transaction */}
        {showTxn ? (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setTxnType("owe")} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${txnType === "owe" ? "bg-red-500/20 border border-red-500/40 text-red-400" : "bg-zinc-800 border border-zinc-700 text-zinc-500"}`}>Debit</button>
              <button onClick={() => setTxnType("paid")} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${txnType === "paid" ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400" : "bg-zinc-800 border border-zinc-700 text-zinc-500"}`}>Credit</button>
            </div>
            <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700">
              <span className="text-zinc-500 text-sm">₹</span>
              <input autoFocus type="number" placeholder="Amount" value={txnAmount} onChange={e => setTxnAmount(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none" />
            </div>
            <input type="text" placeholder="Note (e.g. Entry Fee #13)" value={txnNote} onChange={e => setTxnNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-600 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setShowTxn(false)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-400">Cancel</button>
              <button onClick={addTransaction} className="flex-1 py-2 rounded-lg bg-amber-500 text-xs font-bold text-black">Add</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowTxn(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-zinc-700 hover:border-amber-500/50 hover:bg-amber-500/5 text-zinc-500 hover:text-amber-400 transition-all text-sm font-medium">
            <Plus className="h-4 w-4" /> Add Transaction
          </button>
        )}

        {/* History */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider px-1">History</p>
          {wallet.transactions.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">No transactions yet</p>
          ) : wallet.transactions.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/60 transition-all">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${t.amount < 0 ? "bg-red-500/15" : "bg-emerald-500/15"}`}>
                {t.amount < 0 ? <TrendingDown className="h-3.5 w-3.5 text-red-400" /> : <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-300 truncate">{t.note}</p>
                <p className="text-[10px] text-zinc-600">{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <span className={`text-sm font-bold shrink-0 ${t.amount < 0 ? "text-red-400" : "text-emerald-400"}`}>{t.amount > 0 ? "+" : ""}₹{t.amount}</span>
              <button onClick={() => deleteTransaction(t.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-800 transition-all">
                <Trash2 className="h-3 w-3 text-zinc-600" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
