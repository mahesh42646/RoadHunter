"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import FloatingHelp from "./FloatingHelp";
import Footer from "./Footer";
import Header from "./Header";
import MobileBottomNav from "./MobileBottomNav";

const chromeFreeRoutes = ["/party", "/game"];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const hideChrome = useMemo(
    () => {
      // Hide chrome on party/game routes or exact root route
      if (pathname === "/") return true;
      return chromeFreeRoutes.some((route) => pathname.startsWith(route));
    },
    [pathname],
  );

  return (
    <>
      {!hideChrome && <Header />}
      <main 
        style={{ 
          paddingTop: hideChrome ? "0" : "70px", // Space for fixed header
          paddingBottom: hideChrome ? "0" : "80px", // Space for bottom nav
          minHeight: hideChrome ? "100vh" : "calc(100vh - 70px)", // Full height minus header
          display: hideChrome ? "block" : "flex",
          flexDirection: hideChrome ? "block" : "column",
          // For chrome-free routes (like /game), ensure full viewport
          ...(hideChrome ? {
            height: "100dvh",
            width: "100dvw",
            overflow: "hidden",
            margin: 0,
            padding: 0,
          } : {})
        }}
      >
        {children}
        {!hideChrome && <Footer />}
      </main>
      {!hideChrome && <FloatingHelp />}
      {/* Hide bottom nav on chrome-free routes (party, game) */}
      {!hideChrome && <MobileBottomNav />}
    </>
  );
}

