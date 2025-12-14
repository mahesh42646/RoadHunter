"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Card, Col, Container, Form, Row, Tab, Tabs } from "react-bootstrap";

import useAuthActions from "@/app/user/hooks/useAuthActions";

export default function AuthPanel({ initialTab = "login" }) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [referralCode, setReferralCode] = useState(null);
  const { loginWithGoogle, loginWithEmail, registerWithEmail, loading, error, setError } =
    useAuthActions();

  // Get referral code from URL query parameter
  useEffect(() => {
    const ref = searchParams?.get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, [searchParams]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (activeTab === "login") {
      await loginWithEmail(email, password, referralCode);
    } else {
      await registerWithEmail(email, password, referralCode);
    }
  };

  const handleGoogleLogin = () => {
    loginWithGoogle(referralCode);
  };

  return (
    <div className="min-vh-100 d-flex align-items-center py-5">
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={5}>
            <Card className="glass-card border-0">
              <Card.Body className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <p className="text-uppercase fw-semibold mb-2" style={{ color: "var(--accent-secondary)", letterSpacing: "2px" }}>
                    {activeTab === "login" ? "Welcome back" : "Player onboarding"}
                  </p>
                  <h3 className="fw-bold" style={{ color: "var(--text-secondary)" }}>
                    {activeTab === "login" ? "Sign in to  Road Hunter" : "Create your Road Hunter Account"}
                  </h3>
                </div>
                {error && (
                  <Alert variant="danger" onClose={() => setError(null)} dismissible>
                    {error}
                  </Alert>
                )}
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
                  <Button variant="outline-light" className="w-100" onClick={handleGoogleLogin}>
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
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

