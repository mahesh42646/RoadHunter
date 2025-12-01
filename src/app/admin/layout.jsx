"use client";

export default function AdminLayout({ children }) {
  return (
    <div style={{ margin: 0, padding: 0, minHeight: "100vh", background: "var(--bg-dark)", width: "100%", overflowX: "hidden", position: "relative" }}>
      {children}
    </div>
  );
}

