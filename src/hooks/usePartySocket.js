"use client";

import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

import useAuthStore from "@/store/useAuthStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5030";

export default function usePartySocket(partyId, callbacks = {}) {
  const socketRef = useRef(null);
  const token = useAuthStore((state) => state.token);

  const {
    onParticipantJoined,
    onParticipantLeft,
    onParticipantOffline,
    onChatMessage,
    onJoinRequest,
    onJoinRequestApproved,
    onPartyEnded,
    onHostTransferred,
    onParticipantRemoved,
    onParticipantMuted,
    onGiftSent,
    onWalletUpdated,
    onHostMicToggled,
    onHostCameraToggled,
    onStreamState,
  } = callbacks;

  useEffect(() => {
    if (!partyId || !token) {
      console.log("[Socket] Missing partyId or token, skipping connection");
      return;
    }

    // If socket already exists and is connected, don't create a new one
    if (socketRef.current && socketRef.current.connected) {
      console.log("[Socket] Socket already connected, reusing existing connection");
      return;
    }

    // If socket exists but disconnected, try to reconnect
    if (socketRef.current && !socketRef.current.connected) {
      console.log("[Socket] Socket exists but disconnected, reconnecting...");
      socketRef.current.connect();
      return;
    }

    console.log(`[Socket] Creating new socket connection to ${SOCKET_URL} for party ${partyId}`);
    console.log(`[Socket] Token available: ${!!token}`);
    
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
      console.log(`[Socket] ✅ Connected! Socket ID: ${socket.id}`);
      socket.emit("party:join", { partyId });
      console.log(`[Socket] Joined party room: ${partyId}`);
    });

    socket.on("connect_error", (error) => {
      // Only log websocket errors if they're not just connection attempts
      if (error.message && !error.message.includes("websocket error")) {
      console.error("[Socket] ❌ Connection error:", error.message);
      } else if (error.type === "TransportError") {
        // This is expected during initial connection attempts
        console.log("[Socket] 🔄 Connection attempt (will retry with polling if websocket fails)");
      }
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] ⚠️ Disconnected:", reason);
      if (reason === "io server disconnect") {
        // Server forcibly disconnected, try to reconnect
        socket.connect();
      }
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`[Socket] 🔄 Reconnect attempt ${attemptNumber}`);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log(`[Socket] ✅ Reconnected after ${attemptNumber} attempts`);
      socket.emit("party:join", { partyId });
    });

    socket.on("party:participantJoined", (data) => {
      if (data.partyId === partyId && onParticipantJoined) {
        onParticipantJoined(data);
      }
    });

    socket.on("party:participantLeft", (data) => {
      if (data.partyId === partyId && onParticipantLeft) {
        onParticipantLeft(data);
      }
    });

    socket.on("party:participantOffline", (data) => {
      if (data.partyId === partyId && onParticipantOffline) {
        onParticipantOffline(data);
      }
    });

    socket.on("party:chatMessage", (data) => {
      if (data.partyId === partyId && onChatMessage) {
        onChatMessage(data);
      }
    });

    socket.on("party:joinRequest", (data) => {
      if (data.partyId === partyId && onJoinRequest) {
        onJoinRequest(data);
      }
    });

    socket.on("party:joinRequestApproved", (data) => {
      if (data.partyId === partyId && onJoinRequestApproved) {
        onJoinRequestApproved(data);
      }
    });

    socket.on("party:ended", (data) => {
      if (data.partyId === partyId && onPartyEnded) {
        onPartyEnded(data);
      }
    });

    socket.on("party:hostTransferred", (data) => {
      if (data.partyId === partyId && onHostTransferred) {
        onHostTransferred(data);
      }
    });

    socket.on("party:participantRemoved", (data) => {
      if (data.partyId === partyId && onParticipantRemoved) {
        onParticipantRemoved(data);
      }
    });

    socket.on("party:participantMuted", (data) => {
      if (data.partyId === partyId && onParticipantMuted) {
        onParticipantMuted(data);
      }
    });

    socket.on("party:giftSent", (data) => {
      if (data.partyId === partyId && onGiftSent) {
        onGiftSent(data);
      }
    });

    socket.on("wallet:updated", (data) => {
      if (onWalletUpdated) {
        onWalletUpdated(data);
      }
    });

    socket.on("party:hostMicToggled", (data) => {
      if (data.partyId === partyId && onHostMicToggled) {
        onHostMicToggled(data);
      }
    });

    socket.on("party:hostCameraToggled", (data) => {
      if (data.partyId === partyId && onHostCameraToggled) {
        onHostCameraToggled(data);
      }
    });

    socket.on("party:stream-state", (data) => {
      if (data.partyId === partyId && onStreamState) {
        console.log("[Socket] Received stream state:", data);
        onStreamState(data);
      }
    });

    return () => {
      // Don't disconnect on every unmount - only on component destruction
      console.log("[Socket] Component unmounting, preserving socket connection");
    };
  }, [partyId, token]); // Only depend on partyId and token

  // Separate cleanup effect that runs on final unmount
  useEffect(() => {
    const currentSocket = socketRef.current;
    return () => {
      if (currentSocket && currentSocket.connected) {
        console.log("[Socket] Final cleanup - disconnecting");
        currentSocket.emit("party:leave", { partyId });
        currentSocket.disconnect();
      }
    };
  }, [partyId]);

  return socketRef.current;
}

