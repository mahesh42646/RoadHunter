"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import FloatingHelp from "./FloatingHelp";
import Footer from "./Footer";
import Header from "./Header";
import MobileBottomNav from "./MobileBottomNav";

const chromeFreeRoutes = ["/party"];

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
      <main className={mainClass} style={{ paddingBottom: hideChrome ? "0" : "80px" }}>{children}</main>
      {!hideChrome && <Footer />}
      {!hideChrome && <FloatingHelp />}
      {!hideChrome && <MobileBottomNav />}
    </>
  );
}

