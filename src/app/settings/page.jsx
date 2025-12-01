"use client";

import { Container, Card, Row, Col } from "react-bootstrap";

export default function SettingsPage() {
  return (
    <Container className="py-5">
      <h1 className="fw-bold mb-4" style={{ color: "var(--text-secondary)" }}>
        Settings
      </h1>
      <Row>
        <Col md={8}>
          <Card className="glass-card border-0">
            <Card.Body className="p-4">
              <h3 className="fw-bold mb-3" style={{ color: "var(--text-secondary)" }}>
                Coming Soon
              </h3>
              <p style={{ color: "var(--text-muted)" }}>
                Settings page is under development. Check back soon!
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

