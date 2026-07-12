"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { Plus, Search, ChevronRight, ArrowLeft, Copy, Trash2, X, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatIndianPhone } from "@/lib/phone";

type Transaction = { id: string; walletId: string; amount: number; note: string; createdAt: string };
type Wallet = { id: string; playerName: string; shareToken: string; phone: string | null; balance: number; transactions: Transaction[]; createdAt: string };

function WalletInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Wallet | null>(null);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showTxn, setShowTxn] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnNote, setTxnNote] = useState("");
  const [txnType, setTxnType] = useState<"owe" | "paid">("owe");
  const [sort, setSort] = useState<"debt" | "credit" | "az">("debt");
  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchWallets = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const res = await fetch("/api/wallets");
    const data = await res.json();
    setWallets(data);
    setLoading(false);
  }, [session]);

  useEffect(() => { if (session) fetchWallets(); }, [session, fetchWallets]);

  // Reset pagination when search/sort changes
  useEffect(() => { setPage(1); }, [search, sort]);
  useEffect(() => {
    const playerId = searchParams.get("player");
    if (playerId && wallets.length > 0 && !selected) {
      const w = wallets.find(x => x.id === playerId);
      if (w) openWallet(w);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  // Click player → show detail instantly, then fetch transactions only
  const openWallet = async (w: Wallet) => {
    router.replace(`/wallet?player=${w.id}`, { scroll: false });
    setSelected({ ...w, transactions: [] }); // instant — shows balance/name right away
    setTxnsLoading(true);
    const res = await fetch(`/api/wallets/${w.id}`);
    const full = await res.json();
    setSelected(full);
    setTxnsLoading(false);
  };

  const closeWallet = () => {
    router.replace("/wallet", { scroll: false });
    setSelected(null);
    setShowTxn(false);
  };

  const addWallet = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    const dup = wallets.find(w => w.phone === newPhone);
    if (dup) { toast.error(`${dup.playerName} already has this number`); return; }
    const res = await fetch("/api/wallets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerName: newName.trim(), phone: newPhone.trim() || null }) });
    if (!res.ok) { toast.error("Failed"); return; }
    toast.success("Player added!");
    setNewName(""); setNewPhone(""); setShowAdd(false);
    fetchWallets();
  };

  const addTransaction = async () => {
    if (!selected || !txnAmount) return;
    const amt = parseInt(txnAmount);
    if (isNaN(amt) || amt <= 0) return;
    const finalAmt = txnType === "owe" ? -amt : amt;
    const note = txnNote.trim() || (txnType === "owe" ? "Entry Fee" : "Prize");
    const res = await fetch(`/api/wallets/${selected.id}/transactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: finalAmt, note }) });
    if (!res.ok) { toast.error("Failed"); return; }
    toast.success("Added!");
    setTxnAmount(""); setTxnNote(""); setShowTxn(false);
    // Refresh transactions only
    const updated = await (await fetch(`/api/wallets/${selected.id}`)).json();
    setSelected(updated);
    fetch("/api/wallets").then(r => r.json()).then(setWallets);
  };

  const deleteTransaction = async (txnId: string) => {
    await fetch(`/api/transactions/${txnId}`, { method: "DELETE" });
    const updated = await (await fetch(`/api/wallets/${selected!.id}`)).json();
    setSelected(updated);
    fetch("/api/wallets").then(r => r.json()).then(setWallets);
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${token}`);
    toast.success("Link copied!");
  };

  const filtered = wallets
    .filter((w) => {
      const q = search.trim();
      if (!q) return true;

      const nameLower = w.playerName.toLowerCase();
      const phoneDigits = (w.phone ?? "").replace(/\D/g, ""); // strip non-digits from stored phone
      const qDigits = q.replace(/\D/g, ""); // strip non-digits from query

      // 1. Phone search: if query is all digits (possibly with +/-/ spaces), match against phone digits
      if (qDigits && /^[\d\s\+\-\(\)]+$/.test(q)) {
        // Exact prefix or suffix match on phone digits (e.g. "9876" matches "9876543210" or ending "43210")
        return phoneDigits.startsWith(qDigits) ||
               phoneDigits.endsWith(qDigits) ||
               phoneDigits.includes(qDigits);
      }

      // 2. Mixed query (e.g. "+91 sorry") — try phone part + name part separately
      const qLower = q.toLowerCase();

      // 3. Fuzzy name: every word in query must appear (as substring) in the name
      const words = qLower.split(/\s+/).filter(Boolean);
      const fuzzyMatch = words.every(word => nameLower.includes(word));
      if (fuzzyMatch) return true;

      // 4. Full query as substring of name (handles single-word partial)
      if (nameLower.includes(qLower)) return true;

      // 5. Phone digits contained in wallet phone (for mixed queries strip non-digits from query)
      if (qDigits.length >= 3 && phoneDigits.includes(qDigits)) return true;

      return false;
    })
    .sort((a, b) => {
      if (sort === "debt") return a.balance - b.balance;
      if (sort === "credit") return b.balance - a.balance;
      return a.playerName.localeCompare(b.playerName);
    });
  const paged = filtered.slice(0, page * PAGE_SIZE);
  const totalNet = wallets.reduce((s, w) => s + w.balance, 0);
  const negativeTotal = wallets.reduce((s, w) => s + (w.balance < 0 ? w.balance : 0), 0);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setPage(p => p + 1);
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [sentinelRef.current, filtered.length]);

  // ── Detail View ──
  if (selected) return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/50 px-4 py-3 flex items-center gap-3">
        <button onClick={closeWallet} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"><ArrowLeft className="h-4 w-4 text-zinc-400" /></button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-white">{selected.playerName}</h2>
          {selected.phone && <p className="text-[10px] text-zinc-500">{selected.phone}</p>}
        </div>
        <button onClick={() => copyLink(selected.shareToken)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors">
          <Copy className="h-3 w-3" /> Share Link
        </button>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Balance Card — instant */}
        <div className={`rounded-2xl p-5 text-center ${selected.balance < 0 ? "bg-red-500/10 border border-red-500/20" : selected.balance > 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-zinc-900 border border-zinc-800"}`}>
          <p className="text-xs text-zinc-500 mb-1">Current Balance</p>
          <p className={`text-3xl font-black ${selected.balance < 0 ? "text-red-400" : selected.balance > 0 ? "text-emerald-400" : "text-zinc-400"}`}>
            {selected.balance !== 0 ? `₹${Math.abs(selected.balance)}` : "₹0"}
          </p>
          <p className="text-[11px] mt-1.5 text-zinc-500">
            {selected.balance < 0 ? "This player owes you" : selected.balance > 0 ? "You owe this player" : "All settled ✓"}
          </p>
        </div>

        {/* Quick Actions */}
        {selected.phone && (
          <div className="grid grid-cols-3 gap-2">
            <a href={`tel:${selected.phone}`} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.18a16 16 0 0 0 6.29 6.29l1.25-1.25a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span className="text-[10px] text-zinc-500 font-medium">Call</span>
            </a>
            <a href={`https://wa.me/${selected.phone.replace(/\D/g, "")}?text=Hi`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-[#25D366]/40 active:scale-95 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              <span className="text-[10px] text-zinc-500 font-medium">WhatsApp</span>
            </a>
            <a href={`sms:${selected.phone}?body=Hi`} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="text-[10px] text-zinc-500 font-medium">Message</span>
            </a>
          </div>
        )}

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

        {/* History — lazy loaded */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider px-1">History</p>
          {txnsLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-4 w-4 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
            </div>
          ) : selected.transactions.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">No transactions yet</p>
          ) : selected.transactions.map((t) => (
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

  // ── List View ──
  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/50 px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <h1 className="text-base font-bold text-white">Wallet</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
          <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none" />
          {search && <button onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-zinc-500" /></button>}
          <button
            onClick={() => setSort(s => s === "debt" ? "credit" : s === "credit" ? "az" : "debt")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all border ${
              sort === "debt" ? "bg-red-500/15 text-red-400 border-red-500/25" :
              sort === "credit" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
              "bg-zinc-800 text-zinc-400 border-zinc-700"
            }`}
          >
            {sort === "debt" ? "-₹" : sort === "credit" ? "+₹" : "A–Z"}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/15 p-3">
            <p className="text-[10px] text-zinc-500 mb-0.5">Total</p>
            <p className={`text-xl font-black ${totalNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>{totalNet.toLocaleString()} BP</p>
          </div>
          <div className="rounded-xl bg-red-500/8 border border-red-500/15 p-3">
            <p className="text-[10px] text-zinc-500 mb-0.5">Negative</p>
            <p className="text-xl font-black text-red-400">{negativeTotal.toLocaleString()} BP</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-5 w-5 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
            </div>
          ) : filtered.length === 0 && search ? (
            <div className="text-center py-12 text-zinc-600 text-sm">No players found</div>
          ) : paged.map((w, i) => (
            <button key={w.id} onClick={() => openWallet(w)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/60 transition-all text-left">
              <span className="text-[10px] text-zinc-600 w-5 text-right shrink-0 font-mono">{i + 1}</span>
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-amber-400">{w.playerName[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{w.playerName}</p>
                {w.phone && <p className="text-[10px] text-zinc-600">{w.phone}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${w.balance < 0 ? "text-red-400" : w.balance > 0 ? "text-emerald-400" : "text-zinc-500"}`}>
                  {w.balance === 0 ? "Settled" : `${w.balance > 0 ? "+" : "-"}₹${Math.abs(w.balance)}`}
                </p>
                <p className="text-[10px] text-zinc-600">{w.transactions.length} txns</p>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-700 shrink-0" />
            </button>
          ))}
          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {!loading && paged.length < filtered.length && (
              <div className="h-4 w-4 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => setShowAdd(true)} className="fixed bottom-20 right-5 z-50 h-14 w-14 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30 flex items-center justify-center hover:bg-amber-400 active:scale-95 transition-all">
        <Plus className="h-6 w-6 text-black" />
      </button>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => { setShowAdd(false); setNewName(""); setNewPhone(""); }}>
          <div className="w-full bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-5 pb-24 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />
            <h3 className="text-sm font-bold text-white">Add Player</h3>
            <input autoFocus type="text" placeholder="Player name *" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addWallet()}
              className="w-full px-3.5 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50" />
            <input type="tel" placeholder="Phone number *" value={newPhone} onChange={e => setNewPhone(formatIndianPhone(e.target.value))} onKeyDown={e => e.key === "Enter" && addWallet()}
              className="w-full px-3.5 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50" />
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowAdd(false); setNewName(""); setNewPhone(""); }} className="flex-1 py-3 rounded-xl bg-zinc-800 text-sm text-zinc-400 font-medium">Cancel</button>
              <button onClick={addWallet} className="flex-1 py-3 rounded-xl bg-amber-500 text-sm font-bold text-black hover:bg-amber-400 transition-colors">Add Player</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <WalletInner />
    </Suspense>
  );
}
