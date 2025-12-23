"use client";

import usePaymentAdminAuthStore from "@/store/usePaymentAdminAuthStore";

export default function PaymentAdminTopBar() {
  const { paymentAdmin } = usePaymentAdminAuthStore();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "260px",
        right: 0,
        height: "70px",
        background: "rgba(0, 0, 0, 0.4)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
        zIndex: 999,
      }}
    >
      <h5 style={{ color: "var(--text-primary)", margin: 0, fontWeight: "600" }}>
        Payment Administrator Dashboard
      </h5>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          {paymentAdmin?.name || paymentAdmin?.email || "Payment Admin"}
        </span>
      </div>
    </div>
  );
}

