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
    () => chromeFreeRoutes.some((route) => pathname.startsWith(route)),
    [pathname],
  );

  const mainClass = hideChrome ? "" : "pt-5 mt-5";

  return (
    <>
      {!hideChrome && <Header />}
      <main 
        className={mainClass} 
        style={{ 
          paddingBottom: hideChrome ? "0" : "80px",
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
      </main>
      {!hideChrome && <Footer />}
      {!hideChrome && <FloatingHelp />}
      {/* Always show bottom nav, even on chrome-free routes */}
      <MobileBottomNav />
    </>
  );
}

