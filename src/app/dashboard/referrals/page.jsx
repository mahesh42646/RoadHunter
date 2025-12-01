"use client";

import { Card } from "react-bootstrap";

import useAuthStore from "@/store/useAuthStore";

export default function ReferralsPage() {
  const referralCode = useAuthStore((state) => state.user?.referralCode);

  return (
    <Card className="bg-transparent border-light">
      <Card.Body>
        <Card.Title>Referral Program</Card.Title>
        <p className="text-light-50">
          Share your unique code to earn 5% XP boost on every friend&apos;s activity.
        </p>
        <div className="d-flex align-items-center gap-3">
          <h2 className="fw-bold mb-0">{referralCode ?? "Complete profile to unlock"}</h2>
        </div>
      </Card.Body>
    </Card>
  );
}

