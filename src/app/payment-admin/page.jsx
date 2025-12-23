"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import paymentAdminApiClient from "@/lib/paymentAdminApiClient";
import usePaymentAdminAuthStore from "@/store/usePaymentAdminAuthStore";
import PaymentAdminLogin from "./components/PaymentAdminLogin";
import PaymentAdminSidebar from "./components/PaymentAdminSidebar";
import PaymentAdminTopBar from "./components/PaymentAdminTopBar";
import PaymentAdminDashboard from "./components/PaymentAdminDashboard";

export default function PaymentAdminPage() {
  const router = useRouter();
  const { paymentAdminToken, paymentAdmin, isAuthenticated, setPaymentAdminAuth, clearPaymentAdminAuth } = usePaymentAdminAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem("paymentAdminToken");
    const paymentAdminData = localStorage.getItem("paymentAdminData");
    
    if (!token || !paymentAdminData) {
      clearPaymentAdminAuth();
      setLoading(false);
      return;
    }
    
    try {
      const parsedPaymentAdmin = JSON.parse(paymentAdminData);
      if (!parsedPaymentAdmin || !parsedPaymentAdmin.email || !parsedPaymentAdmin._id) {
        clearPaymentAdminAuth();
        setLoading(false);
        return;
      }
      setPaymentAdminAuth(token, parsedPaymentAdmin);
    } catch (e) {
      console.error("Error parsing payment admin data:", e);
      clearPaymentAdminAuth();
    }
    setLoading(false);
  }, [setPaymentAdminAuth, clearPaymentAdminAuth]);

  // Handle login
  const handleLogin = async (loginData) => {
    try {
      if (!loginData) {
        throw new Error("No login data provided");
      }
      
      const { token, paymentAdmin: paymentAdminData } = loginData;
      
      if (!token) {
        throw new Error("No token provided");
      }
      
      if (!paymentAdminData) {
        throw new Error("No payment admin data provided");
      }
      
      if (!paymentAdminData._id || !paymentAdminData.email) {
        throw new Error("Invalid payment admin data structure");
      }
      
      // Save to localStorage
      localStorage.setItem("paymentAdminToken", token);
      localStorage.setItem("paymentAdminData", JSON.stringify(paymentAdminData));
      
      // Update auth store
      setPaymentAdminAuth(token, paymentAdminData);
    } catch (error) {
      console.error("[PaymentAdminPage] Error in handleLogin:", error);
      throw error;
    }
  };

  // Handle logout
  const handleLogout = () => {
    clearPaymentAdminAuth();
    setActiveTab("dashboard");
    router.push("/payment-admin");
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!isAuthenticated || !paymentAdminToken || !paymentAdmin) {
    return <PaymentAdminLogin onLogin={handleLogin} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", display: "flex" }}>
      {/* Sidebar */}
      <PaymentAdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div style={{ marginLeft: "260px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Top Bar */}
        <PaymentAdminTopBar />

        {/* Content */}
        <div style={{ marginTop: "70px", padding: "2rem", flex: 1, overflowY: "auto" }}>
          {activeTab === "dashboard" && <PaymentAdminDashboard paymentAdminToken={paymentAdminToken} />}
          {activeTab === "transactions" && (
            <div>
              <h3 style={{ color: "var(--text-primary)" }}>Transactions</h3>
              <p style={{ color: "var(--text-muted)" }}>Transaction management will be implemented here.</p>
            </div>
          )}
          {activeTab === "payments" && (
            <div>
              <h3 style={{ color: "var(--text-primary)" }}>Payments</h3>
              <p style={{ color: "var(--text-muted)" }}>Payment management will be implemented here.</p>
            </div>
          )}
          {activeTab === "wallets" && (
            <div>
              <h3 style={{ color: "var(--text-primary)" }}>Wallets</h3>
              <p style={{ color: "var(--text-muted)" }}>Wallet management will be implemented here.</p>
            </div>
          )}
          {activeTab === "reports" && (
            <div>
              <h3 style={{ color: "var(--text-primary)" }}>Reports</h3>
              <p style={{ color: "var(--text-muted)" }}>Reports will be implemented here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

