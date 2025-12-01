"use client";

import useAdminAuthStore from "@/store/useAdminAuthStore";

export default function AdminTopBar() {
  const { admin } = useAdminAuthStore();

  return (
    <div
      style={{
        height: "70px",
        background: "rgba(0, 0, 0, 0.2)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        padding: "0 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "fixed",
        top: 0,
        left: "260px",
        right: 0,
        zIndex: 999,
      }}
    >
      <div>
        <h5 style={{ margin: 0, color: "var(--text-primary)", fontWeight: "600" }}>
          Admin Dashboard
        </h5>
        {admin && (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Logged in as: {admin.name || admin.email}
          </p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>
    </div>
  );
}

