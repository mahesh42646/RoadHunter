"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import adminApiClient from "@/lib/adminApiClient";
import useAdminAuthStore from "@/store/useAdminAuthStore";
import AdminLogin from "./components/AdminLogin";
import AdminSidebar from "./components/AdminSidebar";
import AdminTopBar from "./components/AdminTopBar";
import AdminDashboard from "./components/AdminDashboard";
import UsersManagement from "./components/UsersManagement";
import TransactionsManagement from "./components/TransactionsManagement";
import GameManagement from "./components/GameManagement";
import GamesHistory from "./components/GamesHistory";
import ReferralsManagement from "./components/ReferralsManagement";
import ProjectSettings from "./components/ProjectSettings";

export default function AdminPage() {
  const router = useRouter();
  const { adminToken, admin, isAuthenticated, setAdminAuth, clearAdminAuth } = useAdminAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Check authentication on mount - strict validation
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    const adminData = localStorage.getItem("adminData");
    
    // Must have both token and admin data
    if (!token || !adminData) {
      clearAdminAuth();
      setLoading(false);
      return;
    }
    
    try {
      const parsedAdmin = JSON.parse(adminData);
      // Validate admin data has required fields
      if (!parsedAdmin || !parsedAdmin.email || !parsedAdmin._id) {
        clearAdminAuth();
        setLoading(false);
        return;
      }
      setAdminAuth(token, parsedAdmin);
    } catch (e) {
      console.error("Error parsing admin data:", e);
      clearAdminAuth();
    }
    setLoading(false);
  }, [setAdminAuth, clearAdminAuth]);

  // Handle login
  const handleLogin = async (loginData) => {
    try {
      const { token, admin: adminData } = loginData;
      localStorage.setItem("adminToken", token);
      localStorage.setItem("adminData", JSON.stringify(adminData));
      setAdminAuth(token, adminData);
    } catch (error) {
      throw error;
    }
  };

  // Handle logout
  const handleLogout = () => {
    clearAdminAuth();
    setActiveTab("dashboard");
    router.push("/admin");
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  // Strict check: Must have both token and authenticated state
  if (!isAuthenticated || !adminToken || !admin) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", display: "flex" }}>
      {/* Sidebar */}
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div style={{ marginLeft: "260px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Top Bar */}
        <AdminTopBar />

        {/* Content */}
        <div style={{ marginTop: "70px", padding: "2rem", flex: 1, overflowY: "auto" }}>
          {activeTab === "dashboard" && <AdminDashboard adminToken={adminToken} />}
          {activeTab === "users" && <UsersManagement adminToken={adminToken} />}
          {activeTab === "transactions" && <TransactionsManagement adminToken={adminToken} />}
          {activeTab === "cars" && <GameManagement adminToken={adminToken} />}
          {activeTab === "games" && <GamesHistory adminToken={adminToken} />}
          {activeTab === "referrals" && <ReferralsManagement adminToken={adminToken} />}
          {activeTab === "settings" && <ProjectSettings adminToken={adminToken} />}
        </div>
      </div>
    </div>
  );
}
