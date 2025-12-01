"use client";

import Link from "next/link";
import { Button, Card, Col, Container, Row } from "react-bootstrap";

const features = [
  {
    title: "Realtime Wallets",
    copy: "USD to Party Coins in a tap. Secure custody, instant payouts, audited trails.",
    icon: "💰",
  },
  {
    title: "Referral Engine",
    copy: "10-digit referral codes, XP boosts, and cross-platform invites baked in.",
    icon: "🎯",
  },
  {
    title: "Clans & Voice",
    copy: "Squad up with live presence indicators and in-game voice bridges.",
    icon: "🎮",
  },
];

export default function LandingPage() {
  return (
    <div className="pt-5">
      <section className="py-5">
        <Container className="py-5">
          <Row className="align-items-center gy-4">
            <Col lg={6}>
              <p className="text-uppercase fw-semibold mb-2" style={{ color: "var(--accent-secondary)", letterSpacing: "2px" }}>
                Next-gen Social Gaming
              </p>
              <h1 className="display-4 fw-bold rainbow-text mb-4">Bring your party to  Party Verse</h1>
              <p className="lead mt-3" style={{ color: "var(--text-muted)", fontSize: "1.25rem", lineHeight: "1.8" }}>
                Wallets, referrals, and XP levels in one realtime platform. Built with secure APIs,
                Firebase Auth, and Socket.IO for lightning-fast sync.
              </p>
              <div className="d-flex gap-3 mt-5">
                <Button as={Link} href="/user/signup" size="lg" className="px-4 py-3">
                  Get Started
                </Button>
                <Button as={Link} href="/dashboard" variant="outline-light" size="lg" className="px-4 py-3">
                  Live Demo
                </Button>
              </div>
            </Col>
            <Col lg={6}>
              <div className="glass-card p-5">
                <span className="badge mb-3 px-3 py-2" style={{ 
                  background: "rgba(0, 245, 255, 0.2)", 
                  color: "var(--accent-secondary)",
                  border: "1px solid rgba(0, 245, 255, 0.3)"
                }}>
                  Live snapshot
                </span>
                <h3 className="fw-bold mb-3" style={{ color: "var(--text-secondary)" }}>Wallet Performance</h3>
                <p className="mb-4" style={{ color: "var(--text-muted)" }}>
                  Track balances, conversions, and payouts across multiple data centers.
                </p>
                <Row className="gy-3">
                  <Col xs={6}>
                    <div className="glass-card p-4" style={{ border: "1px solid rgba(255, 45, 149, 0.3)" }}>
                      <p className="mb-2" style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Party Coins</p>
                      <h4 className="fw-bold neon-glow" style={{ color: "var(--accent)", fontSize: "1.75rem" }}>1,248,220</h4>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="glass-card p-4" style={{ border: "1px solid rgba(0, 245, 255, 0.3)" }}>
                      <p className="mb-2" style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Active Clans</p>
                      <h4 className="fw-bold neon-glow-cyan" style={{ color: "var(--accent-secondary)", fontSize: "1.75rem" }}>312</h4>
                    </div>
                  </Col>
                </Row>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="py-5" style={{ background: "rgba(0, 0, 0, 0.2)", backdropFilter: "blur(10px)" }}>
        <Container>
          <div className="text-center mb-5">
            <h2 className="fw-bold mb-3" style={{ color: "var(--text-secondary)" }}>Platform Features</h2>
            <p style={{ color: "var(--text-muted)" }}>Everything you need for next-level gaming</p>
          </div>
          <Row className="gy-4">
            {features.map((feature) => (
              <Col key={feature.title} md={4}>
                <Card className="glass-card h-100 border-0">
                  <Card.Body className="p-4">
                    <div className="mb-3" style={{ fontSize: "3rem" }}>{feature.icon}</div>
                    <Card.Title className="fw-bold mb-3" style={{ color: "var(--text-secondary)" }}>
                      {feature.title}
                    </Card.Title>
                    <Card.Text style={{ color: "var(--text-muted)", lineHeight: "1.7" }}>
                      {feature.copy}
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Android App Download Section */}
      <section className="py-5" style={{ background: "rgba(0, 0, 0, 0.3)", backdropFilter: "blur(10px)" }}>
        <Container>
          <Row className="align-items-center gy-4">
            <Col lg={6} className="order-lg-2">
              <div className="text-center">
                <h2 className="fw-bold mb-3" style={{ color: "var(--text-secondary)" }}>
                  Download Road Hunter Android App
                </h2>
                <p className="lead mb-4" style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
                  Get better performance and access to extra features with our native Android app
                </p>
                <div className="d-flex flex-column align-items-center gap-3">
                  <Button 
                    href="https://play.google.com/store/apps/details?id=com.roadhunter.app" 
                    target="_blank"
                    rel="noopener noreferrer"
                    size="lg" 
                    className="px-5 py-3"
                    style={{
                      background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                      boxShadow: "0 4px 15px rgba(0, 245, 255, 0.3)"
                    }}
                  >
                    📱 Download on Google Play
                  </Button>
                  <p className="text-muted small mt-2">
                    Scan QR code to download directly to your device
                  </p>
                </div>
              </div>
            </Col>
            <Col lg={6} className="order-lg-1">
              <div className="glass-card p-5 text-center">
                <h3 className="fw-bold mb-4" style={{ color: "var(--text-secondary)" }}>
                  Scan QR Code
                </h3>
                <div 
                  className="mx-auto"
                  style={{
                    width: "250px",
                    height: "250px",
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "2px solid rgba(0, 245, 255, 0.3)",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px"
                  }}
                >
                  {/* QR Code Image Placeholder */}
                  <div style={{ 
                    width: "100%", 
                    height: "100%",
                    background: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)"
                  }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📱</div>
                    <p style={{ fontSize: "0.9rem", margin: 0 }}>QR Code Image</p>
                    <p style={{ fontSize: "0.75rem", margin: 0, opacity: 0.7 }}>Place your QR code here</p>
                  </div>
                </div>
                <p className="mt-4 mb-0" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Scan with your Android device camera
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  );
}

