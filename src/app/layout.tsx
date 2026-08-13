import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { PostHogProvider } from "@/components/posthog-provider";
import { BottomNav } from "@/components/bottom-nav";
import { GlobalMenu } from "@/components/global-menu";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "ScrimCalc — Tournament Toolkit",
  description: "Free BGMI tournament points calculator, standings, warhead & fragger cards",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  themeColor: "#0a0d1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual" />
        <meta name="theme-color" content="#0a0d1a" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Dancing+Script:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PostHogProvider>
          <AuthProvider>
            <Providers>
              <main>
                {children}
              </main>
              <GlobalMenu />
              <BottomNav />
            </Providers>
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
