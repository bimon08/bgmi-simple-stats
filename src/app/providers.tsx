"use client";

import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#1a1a1a", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" },
        }}
      />
      {children}
    </>
  );
}
