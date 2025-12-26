"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Card, Col, Container, Form, Row, Tab, Tabs } from "react-bootstrap";

import useAuthActions from "@/app/user/hooks/useAuthActions";
import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";
import { hasSessionExpired } from "@/app/user/lib/security";

export default function AuthPanel({ initialTab = "login", isModal = false, onLoginSuccess, onClose }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [quickLoginName, setQuickLoginName] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [referralCode, setReferralCode] = useState(null);
  const [quickLoginLoading, setQuickLoginLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const { loginWithGoogle, loginWithEmail, registerWithEmail, loading, error, setError } =
    useAuthActions();

  // Get referral code from URL query parameter
  useEffect(() => {
    const ref = searchParams?.get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, [searchParams]);

  // Auto-login quick user if cached quickLoginId exists (only on mount, not every render)
  // But don't auto-login if user just logged out
  useEffect(() => {
    // Check if user just logged out - if so, don't auto-login
    const justLoggedOut = sessionStorage.getItem("justLoggedOut");
    if (justLoggedOut === "true") {
      sessionStorage.removeItem("justLoggedOut");
      return; // Don't auto-login after logout
    }

    const cachedQuickLoginId = localStorage.getItem("quickLoginId");
    const authState = useAuthStore.getState();
    const isAuthenticated = authState.token && !hasSessionExpired(authState.lastActiveAt);
    
    // Only auto-login if:
    // 1. User is on login tab (not register)
    // 2. Not already authenticated
    // 3. Has cached quickLoginId
    // 4. Not currently loading
    // 5. Not in a modal (only auto-login on login page, not in popup)
    if (cachedQuickLoginId && !isAuthenticated && activeTab === "login" && !quickLoginLoading && !isModal) {
      // Try to auto-login with cached ID (silently, no name needed)
      const autoLogin = async () => {
        try {
          const response = await apiClient.post("/users/quick-login", {
            quickLoginId: cachedQuickLoginId,
          });
          const { token, user } = response.data;
          useAuthStore.getState().setSession({ token, user });
          useAuthStore.getState().markActive();
          if (onLoginSuccess) onLoginSuccess();
          if (!isModal) {
            router.push("/dashboard");
          }
        } catch (err) {
          // If auto-login fails, clear cache and let user login manually
          localStorage.removeItem("quickLoginId");
        }
      };
      autoLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (activeTab === "login") {
      await loginWithEmail(email, password, referralCode);
    } else {
      await registerWithEmail(email, password, referralCode);
    }
    if (onLoginSuccess) onLoginSuccess();
    if (isModal && onClose) onClose();
  };

  const handleGoogleLogin = () => {
    loginWithGoogle(referralCode);
    if (onLoginSuccess) onLoginSuccess();
    if (isModal && onClose) onClose();
  };

  const handleQuickLogin = async () => {
    setQuickLoginLoading(true);
    setError(null);

    try {
      // Check for cached quickLoginId
      const cachedQuickLoginId = localStorage.getItem("quickLoginId");
      
      const response = await apiClient.post("/users/quick-login", {
        name: quickLoginName.trim() || null, // Name is optional, will be generated randomly if not provided
        quickLoginId: cachedQuickLoginId || null,
        referralCode: referralCode || null,
      });

      const { token, user, quickLoginId } = response.data;

      // Store quickLoginId in cache
      if (quickLoginId) {
        localStorage.setItem("quickLoginId", quickLoginId);
      }

      // Set auth session
      useAuthStore.getState().setSession({ token, user });
      useAuthStore.getState().markActive();

      if (onLoginSuccess) onLoginSuccess();
      if (isModal && onClose) onClose();
      
      if (!isModal) {
        router.push("/dashboard");
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Quick login failed";
      setError(message);
    } finally {
      setQuickLoginLoading(false);
    }
  };

  const content = (
    <>
      {/* Logo/Header */}
      <div className="text-center mb-5">
        <h1 
          className="fw-bold mb-0" 
          style={{ 
            color: "var(--accent-secondary, #00f5ff)",
            fontSize: "2.5rem",
            letterSpacing: "2px",
            textShadow: "0 0 20px rgba(0, 245, 255, 0.5)"
          }}
        >
          RoadHunter
        </h1>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible className="mb-4">
          {error}
        </Alert>
      )}

      {/* Quick Login Button */}
      <div className="mb-3">
        <Button
          variant="primary"
          className="w-100"
          onClick={handleQuickLogin}
          disabled={quickLoginLoading}
          style={{
            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)",
            border: "none",
            padding: "0.875rem",
            fontWeight: "600",
            fontSize: "1rem",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0, 245, 255, 0.3)",
          }}
        >
          {quickLoginLoading ? "Logging in..." : "⚡ Quick Login"}
        </Button>
        {activeTab === "login" && (
          <Form.Group className="mt-2">
            <Form.Control
              type="text"
              placeholder="Enter your name (optional)"
              value={quickLoginName}
              onChange={(e) => setQuickLoginName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleQuickLogin();
                }
              }}
              disabled={quickLoginLoading}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "var(--text-primary)",
                borderRadius: "8px",
              }}
            />
          </Form.Group>
        )}
      </div>

      {/* Google Login Button */}
      <div className="mb-3">
        <Button
          variant="outline-light"
          className="w-100"
          onClick={handleGoogleLogin}
          disabled={loading || quickLoginLoading}
          style={{
            padding: "0.875rem",
            fontWeight: "600",
            fontSize: "1rem",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google (Sign In)
        </Button>
      </div>

      {/* More Options Button */}
      <div className="mb-4">
        <Button
          variant="outline-secondary"
          className="w-100"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          style={{
            padding: "0.75rem",
            fontWeight: "500",
            fontSize: "0.9rem",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            color: "var(--text-muted)",
          }}
        >
          {showMoreOptions ? "Less" : "More"}
        </Button>
      </div>

      {/* Email/Password Form (shown when More is clicked) */}
      {showMoreOptions && (
        <div className="mt-4">
          <Tabs
            activeKey={activeTab}
            onSelect={(key) => key && setActiveTab(key)}
            justify
            className="mb-3"
          >
            <Tab eventKey="login" title="Login" />
            <Tab eventKey="register" title="Register" />
          </Tabs>
          <Form onSubmit={handleSubmit} className="mb-3">
            <Form.Group className="mb-3" controlId="email">
              <Form.Label style={{ color: "var(--text-primary)" }}>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "var(--text-primary)",
                  borderRadius: "8px",
                }}
              />
            </Form.Group>
            <Form.Group className="mb-4" controlId="password">
              <Form.Label style={{ color: "var(--text-primary)" }}>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "var(--text-primary)",
                  borderRadius: "8px",
                }}
              />
              <Form.Text className="text-light-50 small">
                Tip: Use at least 8 characters, mix letters and numbers.
              </Form.Text>
            </Form.Group>
            <Button 
              type="submit" 
              className="w-100" 
              disabled={loading}
              style={{
                padding: "0.875rem",
                fontWeight: "600",
                borderRadius: "12px",
              }}
            >
              {loading
                ? "Please wait..."
                : activeTab === "login"
                  ? "Login with email"
                  : "Create account"}
            </Button>
          </Form>
          {referralCode && (
            <Alert variant="info" className="mb-3">
              <small>You're signing up with a referral code!</small>
            </Alert>
          )}
        </div>
      )}

      {/* Terms and Privacy */}
      <p className="small text-center text-light-50 mb-0 mt-4">
        By continuing you agree to our{" "}
        <Link href="/terms" className="text-decoration-underline" style={{ color: "var(--accent-secondary)" }}>
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-decoration-underline" style={{ color: "var(--accent-secondary)" }}>
          Privacy Policy
        </Link>
        .
      </p>
    </>
  );

  if (isModal) {
    return (
      <div style={{ maxWidth: "100%", width: "100%" }}>
        {content}
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex align-items-center py-5">
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={5}>
            <Card className="glass-card border-0">
              <Card.Body className="p-4 p-md-5">
                {content}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

