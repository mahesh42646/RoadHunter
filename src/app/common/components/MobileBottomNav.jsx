"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nav } from "react-bootstrap";

const navItems = [
  { label: "Party Rooms", href: "/party", icon: "🎉" },
  { label: "App", href: "/dashboard", icon: "🏠" },
  { label: "Settings", href: "/settings", icon: "⚙️" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="d-md-none position-fixed bottom-0 start-0 end-0"
      style={{
        background: "rgba(10, 14, 26, 0.95)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        padding: "0.75rem 0",
        zIndex: 1000,
      }}
    >
      <div className="d-flex justify-content-around align-items-center">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="text-decoration-none d-flex flex-column align-items-center gap-1"
              style={{
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                transition: "all 0.3s ease",
                padding: "0.5rem 1.5rem",
                borderRadius: "0.375rem",
                background: isActive ? "rgba(255, 45, 149, 0.1)" : "transparent",
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
              <span
                className="small fw-semibold"
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

