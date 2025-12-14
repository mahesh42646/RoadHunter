"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";

import useCallStore from "@/store/useCallStore";
import useAuthStore from "@/store/useAuthStore";
import CallNotification from "./CallNotification";
import CallView from "./CallView";
import apiClient from "@/lib/apiClient";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

export default function CallManager() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  
  const {
    callStatus,
    friendId,
    friend,
    isCaller,
    localStream,
    remoteStream,
    isMicEnabled,
    isVideoEnabled,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    setCallStatus,
    setFriend,
    setLocalStream,
    setRemoteStream,
    setIsCaller,
  } = useCallStore();

  // Initialize socket connection
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    socket.on("connect", () => {
      console.log("[CallManager] Socket connected, emitting user:join");
      socket.emit("user:join");
    });

    // Handle incoming call - use once to prevent duplicate handlers
    const handleIncomingCall = async (data) => {
      try {
        console.log("[CallManager] ===== INCOMING CALL RECEIVED =====");
        console.log("[CallManager] From user ID:", data.fromUserId);
        console.log("[CallManager] Friend ID:", data.friendId);
        console.log("[CallManager] Call ID:", data.callId);
        console.log("[CallManager] Call Type:", data.callType);
        console.log("[CallManager] Full data:", JSON.stringify(data, null, 2));
        
        // Check if we're already in a call
        const currentCallStatus = useCallStore.getState().callStatus;
        if (currentCallStatus === "connected" || currentCallStatus === "calling") {
          console.log("[CallManager] Already in a call, rejecting incoming call");
          socket.emit("friend:call:reject", { friendId: data.fromUserId, callId: data.callId });
          return;
        }
        
        console.log("[CallManager] Fetching caller profile...");
        const response = await apiClient.get(`/friends/profile/${data.fromUserId}`);
        const callerFriend = response.data.user;
        
        console.log("[CallManager] Caller friend data loaded:", callerFriend.account?.displayName);
        console.log("[CallManager] Starting call with friend:", callerFriend);
        
        startCall(data.fromUserId, callerFriend, false);
        setCallStatus("ringing");
        
        // Store callId in a way we can access it later
        if (data.callId) {
          useCallStore.setState({ callId: data.callId });
        }
        
        console.log("[CallManager] ✅ Call status set to 'ringing'");
        console.log("[CallManager] Friend in store:", useCallStore.getState().friend);
        console.log("[CallManager] Call status in store:", useCallStore.getState().callStatus);
      } catch (error) {
        console.error("[CallManager] ❌ Failed to load caller info:", error);
        console.error("[CallManager] Error details:", error.response?.data || error.message);
      }
    };
    
    socket.on("friend:call:incoming", handleIncomingCall);

    // Handle call errors
    socket.on("friend:call:error", (data) => {
      console.error("[CallManager] Call error:", data.error);
      alert(data.error || "Call failed");
      endCall();
    });

    // Handle call accepted
    socket.on("friend:call:accepted", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        setCallStatus("connected");
        // Start peer connection if not already started
        if (!peerRef.current) {
          if (isCaller) {
            startPeerConnection(true);
          } else {
            startPeerConnection(false);
          }
        }
      }
    });

    // Handle call rejected
    socket.on("friend:call:rejected", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        endCall();
        alert("Call rejected");
      }
    });

    // Handle call ended
    socket.on("friend:call:ended", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        endCall();
      }
    });

    // Handle WebRTC signaling
    socket.on("friend:webrtc:signal", (data) => {
      if (data.fromUserId === friendId && peerRef.current) {
        peerRef.current.signal(data.signal);
      }
    });

    socketRef.current = socket;
    
    // Make socket available globally for CallNotification
    if (typeof window !== 'undefined') {
      window.io = socket;
    }

    return () => {
      // Only cleanup on unmount
      console.log("[CallManager] Component unmounting, cleaning up socket");
      if (socketRef.current) {
        // Clear heartbeat interval
        if (socketRef.current.heartbeatInterval) {
          clearInterval(socketRef.current.heartbeatInterval);
        }
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.io = null;
      }
    };
  }, [token]); // Only depend on token, not friendId or isCaller

  // Restore call state on mount and reconnect peer if needed
  useEffect(() => {
    if (callStatus === "connected" || callStatus === "calling" || callStatus === "ringing") {
      if (friendId && !friend) {
        // Restore friend data
        apiClient.get(`/friends/profile/${friendId}`)
          .then((response) => {
            setFriend(response.data.user);
          })
          .catch(console.error);
      }
      
      // If call is connected but no peer connection, restore it
      if (callStatus === "connected" && !peerRef.current && friendId) {
        if (isCaller) {
          startPeerConnection(true);
        } else {
          startPeerConnection(false);
        }
      }
    }
  }, [callStatus, friendId, friend, isCaller]);

  const startPeerConnection = async (initiator) => {
    try {
      // Don't start if peer already exists
      if (peerRef.current) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled !== false,
        audio: isMicEnabled !== false,
      });
      
      streamRef.current = stream;
      setLocalStream(stream);

      const Peer = (await import("simple-peer")).default;
      const peer = new Peer({
        initiator,
        trickle: false,
        stream,
      });

      peer.on("signal", (signal) => {
        if (socketRef.current && friendId) {
          socketRef.current.emit("friend:webrtc:signal", {
            friendId,
            signal,
          });
        }
      });

      peer.on("stream", (remoteStreamData) => {
        setRemoteStream(remoteStreamData);
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
      });

      peer.on("close", () => {
        console.log("Peer connection closed");
        peerRef.current = null;
      });

      peerRef.current = peer;
    } catch (error) {
      console.error("Error starting peer connection:", error);
      alert("Failed to access camera/microphone");
      endCall();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  return (
    <>
      <CallNotification />
      {(callStatus === "connected" || callStatus === "calling" || callStatus === "ringing") && <CallView />}
    </>
  );
}
