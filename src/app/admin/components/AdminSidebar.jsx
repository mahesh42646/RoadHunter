"use client";

import { BsBarChart, BsPeople, BsCashCoin, BsTrophy, BsGear, BsPersonCheck, BsBoxArrowRight, BsShieldLock, BsCameraVideo } from "react-icons/bs";

export default function AdminSidebar({ activeTab, setActiveTab, onLogout }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BsBarChart },
    { id: "users", label: "Users", icon: BsPeople },
    { id: "parties", label: "Parties", icon: BsCameraVideo },
    { id: "transactions", label: "Transactions", icon: BsCashCoin },
    { id: "payment-admins", label: "Payment Admins", icon: BsShieldLock },
    { id: "payment-methods", label: "Payment Methods", icon: BsCashCoin },
    { id: "cars", label: "Game Management", icon: BsTrophy },
    { id: "games", label: "Games History", icon: BsTrophy },
    { id: "referrals", label: "Referrals", icon: BsPersonCheck },
    // { id: "settings", label: "Settings", icon: BsGear },
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
          Admin Panel
        </h4>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
          Control Center
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
                background: isActive ? "rgba(242, 236, 238, 0.22)" : "transparent",
                border: "none",
                borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                color: isActive ? "#ff2d95" : "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                cursor: "pointer",
              
                textAlign: "left",
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

