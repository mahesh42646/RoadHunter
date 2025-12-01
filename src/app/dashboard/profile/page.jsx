"use client";

import { Card, Col, Form, Row } from "react-bootstrap";

import useAuthStore from "@/store/useAuthStore";

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);

  return (
    <Card className="bg-transparent border-light">
      <Card.Body>
        <Row className="gy-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Display name</Form.Label>
              <Form.Control value={user?.account?.displayName ?? ""} readOnly />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Email</Form.Label>
              <Form.Control value={user?.account?.email ?? ""} readOnly />
            </Form.Group>
          </Col>
        </Row>
        <Row className="gy-3 mt-1">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Profile status</Form.Label>
              <Form.Control
                value={user?.account?.profileCompleted ? "Complete" : "Incomplete"}
                readOnly
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Referral code</Form.Label>
              <Form.Control value={user?.referralCode ?? "Pending"} readOnly />
            </Form.Group>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}

