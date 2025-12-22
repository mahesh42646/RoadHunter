"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Offcanvas } from "react-bootstrap";
import { BsList, BsX, BsCoin, BsPerson, BsHouse, BsGear } from "react-icons/bs";

import useAuthStore, { selectIsAuthenticated } from "@/store/useAuthStore";
import useAuthActions from "@/app/user/hooks/useAuthActions";
import apiClient from "@/lib/apiClient";
import AuthPanel from "@/app/user/components/AuthPanel";

export default function Header() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const { logout } = useAuthActions();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Load wallet balance
  useEffect(() => {
    if (isAuthenticated && hydrated) {
      loadBalance();
      // Refresh balance periodically
      const interval = setInterval(loadBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, hydrated]);

  const loadBalance = async () => {
    if (!isAuthenticated) return;
    setLoadingBalance(true);
    try {
      const response = await apiClient.get("/wallet/balance");
      setWalletBalance(response.data.partyCoins || 0);
    } catch (error) {
      console.error("Failed to load balance", error);
    } finally {
      setLoadingBalance(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toLocaleString();
  };

  const menuItems = [
    { label: "Home", href: "/", icon: <BsHouse /> },
    { label: "Party Rooms", href: "/", icon: "🎉" },
    { label: "Dashboard", href: "/dashboard", icon: <BsPerson />, requireAuth: true },
    { label: "Settings", href: "/settings", icon: <BsGear />, requireAuth: true },
    { label: "About Us", href: "/aboutus", icon: null },
    { label: "How It Works", href: "/howitworks", icon: null },
    { label: "Contact Us", href: "/contactus", icon: null },
    { label: "FAQ", href: "/faq", icon: null },
  ];

  return (
    <>
      <nav
        className="position-fixed top-0 start-0 end-0"
        style={{
          background: "rgba(10, 14, 26, 0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          zIndex: 1000,
          padding: "0.75rem 1rem",
        }}
      >
        <div className="d-flex justify-content-between align-items-center">
          {/* Logo */}
          <Link
            href="/"
            className="text-decoration-none fw-bold fs-4"
            style={{ color: "var(--accent-secondary, #00f5ff)" }}
          >
            Road Hunter
          </Link>

          {/* Right side: Wallet/Login + Menu Toggle */}
          <div className="d-flex align-items-center gap-3">
            {/* Wallet Balance or Login */}
            {hydrated && (
              <>
                {isAuthenticated ? (
                  <Button
                    variant="outline-light"
                    size="sm"
                    className="d-flex align-items-center gap-2"
                    style={{
                      background: "rgba(255, 215, 0, 0.1)",
                      border: "1px solid rgba(255, 215, 0, 0.3)",
                      color: "#ffd700",
                    }}
                    onClick={() => setShowSidebar(true)}
                  >
                    <BsCoin style={{ fontSize: "1rem" }} />
                    <span className="small fw-semibold">
                      {loadingBalance ? "..." : formatNumber(walletBalance)}
                    </span>
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowLoginModal(true)}
                  >
                    Login
                  </Button>
                )}
              </>
            )}

            {/* Menu Toggle */}
            <Button
              variant="outline-light"
              size="sm"
              onClick={() => setShowSidebar(true)}
              style={{
                minWidth: "40px",
                padding: "0.5rem",
              }}
            >
              <BsList style={{ fontSize: "1.25rem" }} />
            </Button>
          </div>
        </div>
      </nav>

      {/* Sidebar from Right */}
      <Offcanvas
        show={showSidebar}
        onHide={() => setShowSidebar(false)}
        placement="end"
        style={{
          background: "rgba(10, 14, 26, 0.98)",
          backdropFilter: "blur(20px)",
        }}
      >
        <Offcanvas.Header
          style={{
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            padding: "1rem",
          }}
        >
          <Offcanvas.Title
            className="fw-bold"
            style={{ color: "var(--accent-secondary, #00f5ff)" }}
          >
            Menu
          </Offcanvas.Title>
          <Button
            variant="link"
            onClick={() => setShowSidebar(false)}
            style={{ color: "var(--text-primary)", padding: 0, minWidth: "auto" }}
          >
            <BsX style={{ fontSize: "1.5rem" }} />
          </Button>
        </Offcanvas.Header>
        <Offcanvas.Body style={{ padding: 0 }}>
          {/* User Info Section */}
          {isAuthenticated && user && (
            <div
              style={{
                padding: "1rem",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(0, 245, 255, 0.05)",
              }}
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                <BsPerson style={{ fontSize: "1.5rem", color: "var(--accent-secondary)" }} />
                <div>
                  <div className="fw-bold" style={{ color: "var(--text-primary)" }}>
                    {user?.account?.displayName || user?.account?.email || "User"}
                  </div>
                  <div className="small" style={{ color: "var(--text-muted)" }}>
                    {user?.account?.email}
                  </div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <BsCoin style={{ color: "#ffd700", fontSize: "1rem" }} />
                <span className="fw-semibold" style={{ color: "#ffd700" }}>
                  {loadingBalance ? "Loading..." : formatNumber(walletBalance)} coins
                </span>
              </div>
            </div>
          )}

          {/* Menu Items */}
          <div style={{ padding: "0.5rem 0" }}>
            {menuItems.map((item) => {
              if (item.requireAuth && !isAuthenticated) return null;
              const isActive = pathname === item.href || (item.href === "/" && pathname === "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowSidebar(false)}
                  className="text-decoration-none d-block"
                  style={{
                    padding: "0.75rem 1.5rem",
                    color: isActive ? "var(--accent-secondary)" : "var(--text-primary)",
                    background: isActive ? "rgba(0, 245, 255, 0.1)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--accent-secondary)" : "3px solid transparent",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    {typeof item.icon === "string" ? (
                      <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
                    ) : item.icon ? (
                      <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
                    ) : null}
                    <span className="fw-semibold">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Auth Actions */}
          {isAuthenticated ? (
            <div style={{ padding: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <Button
                variant="outline-danger"
                className="w-100"
                onClick={() => {
                  logout();
                  setShowSidebar(false);
                }}
              >
                Logout
              </Button>
            </div>
          ) : (
            <div style={{ padding: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <Button
                variant="primary"
                className="w-100 mb-2"
                onClick={() => {
                  setShowSidebar(false);
                  setShowLoginModal(true);
                }}
              >
                Login
              </Button>
              <Button
                variant="outline-primary"
                className="w-100"
                as={Link}
                href="/user/signup"
                onClick={() => setShowSidebar(false)}
              >
                Sign Up
              </Button>
            </div>
          )}
        </Offcanvas.Body>
      </Offcanvas>

      {/* Login Modal */}
      {showLoginModal && (
        <div
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center"
          style={{
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            zIndex: 2000,
            padding: "1rem",
          }}
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="glass-card rounded p-4"
            style={{
              maxWidth: "400px",
              width: "100%",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0" style={{ color: "var(--text-primary)" }}>
                Login
              </h5>
              <Button
                variant="link"
                onClick={() => setShowLoginModal(false)}
                style={{ color: "var(--text-primary)", padding: 0, minWidth: "auto" }}
              >
                <BsX style={{ fontSize: "1.5rem" }} />
              </Button>
            </div>
            <AuthPanel
              initialTab="login"
              onLoginSuccess={() => {
                setShowLoginModal(false);
                loadBalance();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
