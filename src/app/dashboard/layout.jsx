"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "./components/Sidebar";

import Header from "@/app/common/components/Header";
import MobileBottomNav from "@/app/common/components/MobileBottomNav";
import useAuthStore, { selectIsAuthenticated } from "@/store/useAuthStore";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const markActive = useAuthStore((state) => state.markActive);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!isAuthenticated) {
      clearSession();
      router.replace("/user/login");
      return;
    }
    markActive();
    setChecking(false);
  }, [clearSession, hydrated, isAuthenticated, markActive, router]);

  if (!hydrated || checking) {
    return (
      <div 
        className="d-flex justify-content-center align-items-center min-vh-100"
        style={{ color: "var(--text-primary)" }}
      >
        <div className="text-center">
          <div className="spinner-border mb-3" style={{ color: "var(--accent)" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p style={{ color: "var(--text-muted)" }}>Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* <Header /> */}
      <div 
        className="d-flex flex-grow-1" 
        style={{ 
          marginTop: "0px", 
          minHeight: "calc(100vh - 80px)"
        }}
      >
        <Sidebar />
        <section 
          className="flex-grow-1 p-4 pb-5 pb-md-4" 
          style={{ 
            background: "transparent"
          }}
        >
          {children}
        </section>
      </div>
      {/* <MobileBottomNav /> */}
    </div>
  );
}

