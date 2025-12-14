"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nav, Button } from "react-bootstrap";
import { FaBars, FaTimes } from "react-icons/fa";

const items = [
  { label: "Profile", href: "/dashboard/profile", icon: "👤" },
  { label: "Following", href: "/dashboard/friends", icon: "👥" },
  { label: "Follow Requests", href: "/dashboard/friends/requests", icon: "📩" },
  { label: "Calls", href: "/dashboard/calls", icon: "📞" },
  { label: "Wallet", href: "/dashboard/wallet", icon: "💰" },
  { label: "Transactions", href: "/dashboard/transactions", icon: "📊" },
  { label: "Referrals", href: "/dashboard/referrals", icon: "🎯" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Auto-collapse on mobile when navigating
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true);
    }
  }, [pathname, isMobile]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="transparent"
        className="d-md-none position-fixed top-0 start-0 m-3 z-3"
        style={{ 
          color: "#FFFFFF", 
          zIndex: 1050,
          backgroundColor: "rgba(10, 14, 26, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "8px",
          padding: "8px 12px"
        }}
        onClick={toggleSidebar}
      >
        {isCollapsed ? <FaBars size={20} /> : <FaTimes size={20} />}
      </Button>

      {/* Overlay for mobile */}
      {!isCollapsed && isMobile && (
        <div
          className="position-fixed top-0 start-0 h-100 bg-dark bg-opacity-75"
          style={{ 
            width: "100%", 
            zIndex: 1039,
            transition: "opacity 0.3s ease"
          }}
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`p-4 ${isMobile && isCollapsed ? "d-none" : ""} ${isMobile ? "position-fixed" : ""} d-md-block`}
        style={{ 
          minWidth: isMobile ? (isCollapsed ? 0 : 280) : 260,
          width: isMobile ? (isCollapsed ? 0 : "280px") : "auto",
          maxWidth: isMobile ? "280px" : "none",
          background: "rgba(10, 14, 26, 0.95)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderRight: "1px solid rgba(255, 255, 255, 0.1)",
          transition: isMobile ? "all 0.3s ease" : "none",
          position: isMobile ? "fixed" : "relative",
          zIndex: isMobile ? 1040 : 1000,
          height: isMobile ? "100vh" : "auto",
          top: isMobile ? 0 : "auto",
          left: isMobile ? (isCollapsed ? "-280px" : 0) : "auto",
          overflowY: isMobile ? "auto" : "visible",
          boxShadow: isMobile && !isCollapsed ? "2px 0 10px rgba(0, 0, 0, 0.3)" : "none"
        }}
      >
        {/* Mobile Header */}
        <div className="d-flex justify-content-between align-items-center mb-3 d-md-none">
          <h5 className="fw-bold rainbow-text mb-0">Dashboard</h5>
          <Button
            variant="transparent"
            className="p-0"
            style={{ color: "#FFFFFF" }}
            onClick={() => setIsCollapsed(true)}
          >
            <FaTimes size={20} />
          </Button>
        </div>

        {/* Desktop Header */}
        <div className="mb-5 d-none d-md-block">
          <p 
            className="text-uppercase small mb-2" 
            style={{ 
              color: "var(--accent-secondary)", 
              letterSpacing: "2px", 
              fontWeight: 600 
            }}
          >
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
                  textDecoration: "none",
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
                onClick={() => {
                  // Close sidebar on mobile when item is clicked
                  if (isMobile) {
                    setIsCollapsed(true);
                  }
                }}
            >
                <span style={{ fontSize: "1.25rem", minWidth: "24px", textAlign: "center" }}>
                  {item.icon}
                </span>
              <span>{item.label}</span>
            </Nav.Link>
          );
        })}
      </Nav>
      </aside>
    </>
  );
}
