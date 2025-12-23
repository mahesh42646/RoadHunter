"use client";

import { useState, useEffect } from "react";
import { Card } from "react-bootstrap";
import paymentAdminApiClient from "@/lib/paymentAdminApiClient";

export default function PaymentAdminDashboard({ paymentAdminToken }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await paymentAdminApiClient.get("/payment-admin/dashboard", {
          headers: {
            Authorization: `Bearer ${paymentAdminToken}`,
          },
        });
        setDashboardData(response.data);
      } catch (error) {
        console.error("[PaymentAdminDashboard] Error fetching dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    if (paymentAdminToken) {
      fetchDashboard();
    }
  }, [paymentAdminToken]);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  const overview = dashboardData?.overview || {
    totalTransactions: 0,
    pendingPayments: 0,
    completedPayments: 0,
    totalRevenue: 0,
  };

  return (
    <div>
      <h3 className="mb-4" style={{ color: "var(--text-primary)" }}>
        Dashboard Overview
      </h3>

      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <Card className="glass-card">
            <Card.Body>
              <h6 style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Total Transactions
              </h6>
              <h3 style={{ color: "var(--accent)", margin: 0 }}>
                {overview.totalTransactions.toLocaleString()}
              </h3>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="glass-card">
            <Card.Body>
              <h6 style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Pending Payments
              </h6>
              <h3 style={{ color: "#ffc107", margin: 0 }}>
                {overview.pendingPayments.toLocaleString()}
              </h3>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="glass-card">
            <Card.Body>
              <h6 style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Completed Payments
              </h6>
              <h3 style={{ color: "#28a745", margin: 0 }}>
                {overview.completedPayments.toLocaleString()}
              </h3>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="glass-card">
            <Card.Body>
              <h6 style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Total Revenue
              </h6>
              <h3 style={{ color: "var(--accent)", margin: 0 }}>
                ₹{overview.totalRevenue.toLocaleString()}
              </h3>
            </Card.Body>
          </Card>
        </div>
      </div>

      <Card className="glass-card">
        <Card.Body>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Payment management features will be added here.
          </p>
        </Card.Body>
      </Card>
    </div>
  );
}

