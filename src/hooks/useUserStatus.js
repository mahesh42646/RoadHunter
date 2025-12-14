"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

export default function useUserStatus(userId) {
  const [status, setStatus] = useState("offline"); // 'online', 'busy', 'offline'
  const [isOnline, setIsOnline] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!userId || !token) return;

    // Fetch initial status
    const fetchStatus = async () => {
      try {
        const response = await apiClient.get(`/friends/status/${userId}`);
        setStatus(response.data.status);
        setIsOnline(response.data.isOnline);
        setIsBusy(response.data.isBusy);
      } catch (error) {
        console.error("Failed to fetch user status:", error);
      }
    };

    fetchStatus();

    // Listen for online/offline events
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("user:join");
    });

    socket.on("user:online", (data) => {
      if (data.userId === userId) {
        setStatus("online");
        setIsOnline(true);
        setIsBusy(false);
      }
    });

    socket.on("user:offline", (data) => {
      if (data.userId === userId) {
        setStatus("offline");
        setIsOnline(false);
        setIsBusy(false);
      }
    });

    // Poll for status updates every 10 seconds
    const interval = setInterval(fetchStatus, 10000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [userId, token]);

  return { status, isOnline, isBusy };
}
