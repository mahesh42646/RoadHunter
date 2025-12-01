"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nav } from "react-bootstrap";

const items = [
  { label: "Profile", href: "/dashboard/profile", icon: "👤" },
  { label: "Wallet", href: "/dashboard/wallet", icon: "💰" },
  { label: "Transactions", href: "/dashboard/transactions", icon: "📊" },
  { label: "Referrals", href: "/dashboard/referrals", icon: "🎯" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside 
      className="p-4" 
      style={{ 
        minWidth: 260,
        background: "rgba(10, 14, 26, 0.8)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderRight: "1px solid rgba(255, 255, 255, 0.1)"
      }}
    >
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
  );
}

