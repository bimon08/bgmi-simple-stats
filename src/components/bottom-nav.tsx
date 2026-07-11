"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, UserCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export function BottomNav() {
  const path = usePathname();
  const { data: session } = useSession();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY.current && y > 60);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (path.startsWith("/pay/")) return null;

  const tabs = [
    { href: "/", label: "Home", icon: Home },
    { href: "/wallet", label: "Wallet", icon: Wallet },
  ];

  const profileActive = path.startsWith("/profile");

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${hidden ? "translate-y-full" : "translate-y-0"}`}
      style={{ background: "rgba(12,9,20,0.95)", borderTop: "1px solid rgba(124,58,237,0.2)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex max-w-md mx-auto">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors"
              style={{ color: active ? "#a78bfa" : "rgba(167,139,250,0.35)" }}>
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </Link>
          );
        })}

        <Link href="/profile"
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors"
          style={{ color: profileActive ? "#a78bfa" : "rgba(167,139,250,0.35)" }}>
          {session?.user?.image ? (
            <img src={session.user.image} className="h-5 w-5 rounded-full" style={{ boxShadow: profileActive ? "0 0 0 2px #a78bfa" : "0 0 0 1px rgba(124,58,237,0.3)" }} alt="" />
          ) : (
            <UserCircle className="h-5 w-5" />
          )}
          <span className="text-[10px] font-semibold tracking-wide">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
