"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import useAuthStore from "@/store/useAuthStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

// Global socket for wallet updates and other non-party-specific events
export default function useGlobalSocket(callbacks = {}) {
  const socketRef = useRef(null);
  const token = useAuthStore((state) => state.token);
  const { onWalletUpdated } = callbacks;

  useEffect(() => {
    if (!token) return;

    // Reuse existing socket if available
    if (socketRef.current && socketRef.current.connected) {
      return;
    }

    // Reconnect if disconnected
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("user:join");
    });

    socket.on("wallet:updated", (data) => {
      if (onWalletUpdated) {
        onWalletUpdated(data);
      }
    });

    return () => {
      // Don't disconnect - keep connection alive for other components
      // Only remove listeners
      socket.off("wallet:updated");
    };
  }, [token, onWalletUpdated]);

  return socketRef.current;
}

