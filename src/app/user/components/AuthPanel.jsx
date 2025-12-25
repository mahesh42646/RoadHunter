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
      <div className="text-center mb-4">
        <p className="text-uppercase fw-semibold mb-2" style={{ color: "var(--accent-secondary)", letterSpacing: "2px" }}>
          {activeTab === "login" ? "Welcome back" : "Player onboarding"}
        </p>
        <h3 className="fw-bold" style={{ color: "var(--text-secondary)" }}>
          {activeTab === "login" ? "Sign in to Road Hunter" : "Create your Road Hunter Account"}
        </h3>
      </div>
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      {/* Quick Login Section */}
      <div className="mb-4">
        <Button
          variant="primary"
          className="w-100 mb-3"
          onClick={handleQuickLogin}
          disabled={quickLoginLoading}
          style={{
            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)",
            border: "none",
            padding: "0.75rem",
            fontWeight: "600",
          }}
        >
          {quickLoginLoading ? "Logging in..." : "⚡ Quick Login"}
        </Button>
        {activeTab === "login" && (
          <Form.Group className="mb-3">
            <Form.Control
              type="text"
              placeholder="Enter your name (optional - random name will be generated)"
              value={quickLoginName}
              onChange={(e) => setQuickLoginName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleQuickLogin();
                }
              }}
              disabled={quickLoginLoading}
            />
            <Form.Text className="text-light-50 small">
              One-click login. No email or password needed. Name is optional - random name will be generated if left empty. Account stored in browser cache.
            </Form.Text>
          </Form.Group>
        )}
      </div>

      <div className="text-center my-3">
        <p className="text-light-50 mb-1">or</p>
      </div>

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
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Form.Group>
        <Form.Group className="mb-4" controlId="password">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <Form.Text className="text-light-50">
            Tip: Use at least 8 characters, mix letters and numbers.
          </Form.Text>
        </Form.Group>
        <Button type="submit" className="w-100" disabled={loading}>
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
      <div className="text-center my-3">
        <p className="text-light-50 mb-1">or</p>
        <Button variant="outline-light" className="w-100" onClick={handleGoogleLogin} disabled={loading}>
          Continue with Google
        </Button>
      </div>
      <p className="small text-center text-light-50 mb-0">
        By continuing you agree to our{" "}
        <Link href="/terms" className="text-decoration-underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-decoration-underline">
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

