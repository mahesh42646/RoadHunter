"use client";

import { BsBarChart, BsCashCoin, BsBoxArrowRight, BsCreditCard, BsWallet2, BsReceipt } from "react-icons/bs";

export default function PaymentAdminSidebar({ activeTab, setActiveTab, onLogout }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BsBarChart },
    { id: "transactions", label: "Transactions", icon: BsCashCoin },
    { id: "payments", label: "Payments", icon: BsCreditCard },
    { id: "wallets", label: "Wallets", icon: BsWallet2 },
    { id: "reports", label: "Reports", icon: BsReceipt },
  ];

  return (
    <div
      style={{
        width: "260px",
        minHeight: "100vh",
        background: "rgba(0, 0, 0, 0.3)",
        borderRight: "1px solid rgba(255, 255, 255, 0.1)",
        padding: "1.5rem 0",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 1000,
      }}
    >
      {/* Logo/Title */}
      <div style={{ padding: "0 1.5rem", marginBottom: "2rem" }}>
        <h4 style={{ color: "var(--accent)", fontWeight: "bold", margin: 0 }}>
          Payment Admin
        </h4>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
          Payment Center
        </p>
      </div>

      {/* Menu Items */}
      <nav style={{ flex: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                width: "100%",
                padding: "0.75rem 1.5rem",
                background: isActive ? "rgba(255, 45, 149, 0.2)" : "transparent",
                border: "none",
                borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                color: isActive ? "var(--accent)" : "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.target.style.background = "rgba(255, 255, 255, 0.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.target.style.background = "transparent";
                }
              }}
            >
              <Icon size={20} />
              <span style={{ fontWeight: isActive ? "600" : "400" }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div style={{ padding: "0 1.5rem", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "1rem" }}>
        <button
          onClick={onLogout}
          style={{
            width: "100%",
            padding: "0.75rem 1.5rem",
            background: "rgba(220, 53, 69, 0.2)",
            border: "1px solid rgba(220, 53, 69, 0.3)",
            color: "#dc3545",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "rgba(220, 53, 69, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "rgba(220, 53, 69, 0.2)";
          }}
        >
          <BsBoxArrowRight size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

