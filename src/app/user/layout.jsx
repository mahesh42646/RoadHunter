"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import useAuthStore, { selectIsAuthenticated } from "@/store/useAuthStore";

export default function UserLayout({ children }) {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 text-light">
        Loading...
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 text-light">
        Redirecting to dashboard...
      </div>
    );
  }

  return children;
}

