"use client";

import { Card, Col, Row } from "react-bootstrap";

import useAuthStore from "@/store/useAuthStore";

export default function DashboardHome() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="text-light">
      <div className="mb-4">
        <p className="text-muted small mb-1">Player overview</p>
        <h2 className="fw-bold">Welcome back, {user?.account?.displayName ?? "Player"}</h2>
        <p className="text-light-50">
          Keep your profile complete to unlock wallet access, referral bonuses, and level boosts.
        </p>
      </div>
      <Row className="gy-3">
        <Col md={4}>
          <Card className="bg-transparent border-light">
            <Card.Body>
              <Card.Title>Level</Card.Title>
              <Card.Text className="display-5 fw-bold">{user?.progress?.level ?? 1}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="bg-transparent border-light">
            <Card.Body>
              <Card.Title>Party Coins</Card.Title>
              <Card.Text className="display-5 fw-bold">{user?.wallet?.partyCoins ?? 0}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="bg-transparent border-light">
            <Card.Body>
              <Card.Title>Referral Code</Card.Title>
              <Card.Text className="display-5 fw-bold">
                {user?.referralCode ?? "Pending profile"}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

