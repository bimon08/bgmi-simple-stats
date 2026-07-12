"use client";
interface Props {
  importCode: string;
  setImportCode: (v: string) => void;
  importLoading: boolean;
  onImport: () => void;
  onClose: () => void;
}

export default function ImportCodeModal({ importCode, setImportCode, importLoading, onImport, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl p-6 anim-slide-up" style={{ background: "#13092b", border: "1px solid rgba(124,58,237,0.3)" }} onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-bold tracking-widest text-center mb-1" style={{ color: "rgba(167,139,250,0.6)" }}>IMPORT TOURNAMENT</p>
        <p className="text-sm text-center mb-5" style={{ color: "rgba(196,181,253,0.5)" }}>Enter the 6-character code</p>
        <input
          type="text"
          value={importCode}
          onChange={(e) => setImportCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="ABC123"
          maxLength={6}
          autoFocus
          className="w-full text-center text-3xl font-black tracking-[0.3em] py-4 rounded-2xl mb-4 bg-transparent focus:outline-none"
          style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", color: "white", caretColor: "#a78bfa", fontFamily: "monospace" }}
          onKeyDown={(e) => { if (e.key === "Enter" && importCode.length === 6) onImport(); }}
        />
        <button onClick={onImport} disabled={importCode.length !== 6 || importLoading} className="w-full py-3.5 rounded-xl font-bold text-sm text-white press-scale disabled:opacity-40" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}>
          {importLoading ? "Importing…" : "Import"}
        </button>
        <button onClick={() => { onClose(); setImportCode(""); }} className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "rgba(196,181,253,0.4)" }}>Cancel</button>
      </div>
    </div>
  );
}
