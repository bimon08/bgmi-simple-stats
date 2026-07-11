"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, Trash2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function RulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/rules").then(r => r.json()).then(d => {
      setRules(d.rules ?? []);
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    if (res.ok) { toast.success("Rules saved!"); router.back(); }
    else toast.error("Failed to save");
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/60 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white">Tournament Rules</h1>
          <p className="text-[10px] text-zinc-500">Visible to all players</p>
        </div>
        <button
          onClick={save}
          disabled={saving || !loaded}
          className="px-4 py-1.5 rounded-lg bg-amber-500 text-xs font-bold text-black disabled:opacity-40 hover:bg-amber-400 transition-all"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 space-y-3 max-w-2xl mx-auto w-full">
        {!loaded && (
          <div className="flex justify-center py-16">
            <div className="h-5 w-5 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
          </div>
        )}

        {loaded && rules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
              <Plus className="h-5 w-5 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 font-medium">No rules yet</p>
            <p className="text-xs text-zinc-600 mt-1">Add your first rule below</p>
          </div>
        )}

        {loaded && rules.map((rule, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-xs text-zinc-600 mt-3 w-5 text-right shrink-0 font-mono">{i + 1}</span>
            <textarea
              value={rule}
              rows={2}
              placeholder={`Rule ${i + 1}`}
              onChange={e => { const u = [...rules]; u[i] = e.target.value; setRules(u); }}
              className="flex-1 px-3.5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none resize-none transition-all leading-relaxed"
            />
            <button
              onClick={() => setRules(rules.filter((_, idx) => idx !== i))}
              className="p-2 mt-1.5 rounded-xl hover:bg-zinc-900 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {loaded && (
          <button
            onClick={() => setRules([...rules, ""])}
            className="w-full py-3 rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-600 hover:text-zinc-300 hover:border-zinc-700 transition-all mt-2"
          >
            + Add rule
          </button>
        )}
      </div>
    </div>
  );
}
