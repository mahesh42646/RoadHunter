"use client";

import Link from "next/link";
import { Container, Row, Col } from "react-bootstrap";

export default function Footer() {
  return (
    <footer 
      className="mt-5 py-4"
      style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        background: "rgba(10, 14, 26, 0.5)",
        backdropFilter: "blur(10px)"
      }}
    >
      <Container>
        <Row className="gy-3 align-items-center">
          <Col md={6}>
            <p className="mb-0" style={{ color: "var(--text-muted)" }}>
              © {new Date().getFullYear()} Road Hunter. All rights reserved.
            </p>
          </Col>
          <Col md={6} className="text-md-end">
            <Link className="me-3" href="/privacy" style={{ color: "var(--text-muted)" }}>
              Privacy
            </Link>
            <Link href="/terms" style={{ color: "var(--text-muted)" }}>
              Terms
            </Link>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}

