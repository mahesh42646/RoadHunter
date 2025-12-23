"use client";

import { useState } from "react";
import { Card, Form, Button, Alert } from "react-bootstrap";
import paymentAdminApiClient from "@/lib/paymentAdminApiClient";

export default function PaymentAdminLogin({ onLogin }) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await paymentAdminApiClient.post("/payment-admin/login", formData);
      
      if (!response.data) {
        throw new Error("Invalid response from server");
      }
      
      const { token, paymentAdmin } = response.data;
      
      if (!token || !paymentAdmin) {
        throw new Error("Missing token or payment admin data in response");
      }
      
      try {
        await onLogin({ token, paymentAdmin });
      } catch (loginError) {
        console.error("[PaymentAdminLogin] Error in onLogin callback:", loginError);
        throw new Error(loginError.message || "Failed to complete login process");
      }
    } catch (err) {
      console.error("[PaymentAdminLogin] Login error:", err);
      const errorMessage = err.response?.data?.error || err.message || "Login failed. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <Card className="glass-card" style={{ width: "100%", maxWidth: "400px" }}>
        <Card.Body>
          <h3 className="text-center mb-4">Payment Administrator Login</h3>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
              />
            </Form.Group>
            <Button type="submit" variant="primary" className="w-100" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </Form>
          <div className="mt-3 text-center text-muted small">
            Enter your payment administrator credentials to continue
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

