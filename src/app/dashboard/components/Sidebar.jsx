"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nav, Button } from "react-bootstrap";
import { FaBars, FaTimes } from "react-icons/fa";

const items = [
  { label: "Profile", href: "/dashboard/profile", icon: "👤" },
  { label: "Following", href: "/dashboard/friends", icon: "👥" },
  { label: "Follow Requests", href: "/dashboard/friends/requests", icon: "📩" },
  { label: "Wallet", href: "/dashboard/wallet", icon: "💰" },
  { label: "Transactions", href: "/dashboard/transactions", icon: "📊" },
  { label: "Referrals", href: "/dashboard/referrals", icon: "🎯" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      <Button
        variant="transparent"
        className="d-md-none position-fixed top-0 start-0 m-3 z-3"
        style={{ color: "#FFFFFF", zIndex: 1050 }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <FaTimes size={24} /> : <FaBars size={24} />}
      </Button>

      <aside 
        className={`p-4 ${isCollapsed ? "d-none" : ""} d-md-block`}
        style={{ 
          minWidth: isCollapsed ? 0 : 260,
          width: isCollapsed ? 0 : "auto",
          background: "rgba(10, 14, 26, 0.8)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderRight: "1px solid rgba(255, 255, 255, 0.1)",
          transition: "all 0.3s ease",
          position: "relative",
          zIndex: 1000,
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3 d-md-none">
          <h5 className="fw-bold rainbow-text mb-0">Dashboard</h5>
          <Button
            variant="transparent"
            className="p-0"
            style={{ color: "#FFFFFF" }}
            onClick={() => setIsCollapsed(true)}
          >
            <FaTimes />
          </Button>
        </div>
      <div className="mb-5">
        <p className="text-uppercase small mb-2" style={{ color: "var(--accent-secondary)", letterSpacing: "2px", fontWeight: 600 }}>
          Player Center
        </p>
        <h5 className="fw-bold rainbow-text">Dashboard</h5>
      </div>
      <Nav className="flex-column gap-2">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Nav.Link
              as={Link}
              href={item.href}
              key={item.href}
              className="px-3 py-3 rounded"
              style={{
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                background: isActive 
                  ? "linear-gradient(135deg, rgba(255, 45, 149, 0.2), rgba(0, 245, 255, 0.2))" 
                  : "transparent",
                border: isActive 
                  ? "1px solid rgba(255, 45, 149, 0.4)" 
                  : "1px solid transparent",
                fontWeight: isActive ? 600 : 500,
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                }
              }}
            >
              <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
              <span>{item.label}</span>
            </Nav.Link>
          );
        })}
      </Nav>
      </aside>

      {isCollapsed && (
        <div
          className="position-fixed top-0 start-0 h-100 bg-dark bg-opacity-75"
          style={{ width: "100%", zIndex: 999 }}
          onClick={() => setIsCollapsed(false)}
        />
      )}
    </>
  );
}

